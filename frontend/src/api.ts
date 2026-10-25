// Thin client for the NestJS API. All paths are relative: in dev Vite proxies
// /api and /uploads to localhost:3000 (see vite.config.ts).

import { getSession, setSession, type AuthUser } from './auth';
import {
  applyPendingStock,
  cacheGet,
  cacheSet,
  findLocal,
  getLocalOrders,
  localAddItems,
  localPay,
  localRemove,
  localToOrder,
  localUpdateItem,
  localUpdateOrder,
  applyOpsToOrders,
  getOfflineState,
  markOffline,
  markOnline,
  paidOptimistically,
  OfflineError,
  queueOp,
  queueOrder,
  setSender,
  sync,
} from './offline';

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  station: 'kitchen' | 'bar';
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: number | null;
  category: Category | null;
}

// Minimal, non-sensitive employee info: who the cashier can pick as the
// waiter responsible for an order (no salary/phone/pin, unlike /employees).
export interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

export type PaymentMethod = 'cash' | 'card';
export type OrderType = 'dine_in' | 'takeaway';
// pending = sent to the kitchen, not paid yet; paid = settled; cancelled = stock restored
export type OrderStatus = 'pending' | 'paid' | 'cancelled';

export interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  ticketNumber: string;
  orderType: OrderType;
  waiterId: number | null;
  waiterName: string | null;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod | null;
  amountPaid: number | null;
  changeGiven: number;
  paidAt: string | null;
  note: string | null;
  items: OrderItem[];
  createdAt: string;
  // Set on orders taken offline and not yet sent to the server
  offline?: boolean;
  clientId?: string | null;
}

export interface OrderLinePayload {
  productId: number;
  quantity: number;
}

export interface PayOrderPayload {
  paymentMethod: PaymentMethod;
  amountPaid?: number;
  discount?: number;
}

export interface CreateOrderPayload {
  items: OrderLinePayload[];
  orderType?: OrderType;
  // The waiter answers for the order and for the money it brings in
  waiterId: number;
  // Kept locally so an offline order can display/print the waiter's name
  waiterName?: string | null;
  note?: string;
  // An order is settled as it is taken; omitting this means cash, exact amount
  payment?: PayOrderPayload;
}

export interface UpdateOrderPayload {
  waiterId?: number | null;
  orderType?: OrderType;
  note?: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Bearer token of the logged-in user, if any
function authHeaders(): Record<string, string> {
  const token = getSession()?.token;
  return token ? { Authorization: 'Bearer ' + token } : {};
}

async function fail(res: Response): Promise<never> {
  // Expired or invalid session: drop it so the app shows the login screen
  if (res.status === 401 && getSession()) setSession(null);
  let message = res.statusText;
  try {
    const body = await res.json();
    message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
  } catch {
    // non-JSON error body: keep statusText
  }
  throw new ApiError(res.status, message);
}

// The server itself never answers these: they come from whatever sits in
// front of it (dev proxy, reverse proxy) when the API is down. A genuine
// Nest error always carries a JSON body, so it is reported normally.
function isUnreachable(res: Response) {
  if (res.status === 502 || res.status === 503 || res.status === 504) return true;
  return res.status === 500 && !(res.headers.get('content-type') ?? '').includes('json');
}

/**
 * Au-dela, le serveur est considere injoignable.
 *
 * Sans limite, fetch attend le verdict du systeme. Quand internet tombe mais
 * que le cable de la caisse reste branche, le routeur n'a plus de route : les
 * paquets ne sont pas refuses, ils sont perdus, et Windows reessaie une
 * vingtaine de secondes avant d'abandonner. La caisse attendait tout cela
 * avant de seulement demander ses tickets. Trois secondes sont tres larges :
 * le VPS repond en 265 ms.
 */
const SERVER_TIMEOUT = 3000;

/**
 * Et quand on sait deja etre hors ligne, inutile de reserver trois secondes a
 * chaque vente : il suffit de laisser au serveur le temps de prouver qu'il est
 * revenu. Sans cette seconde limite, le delai etait repaye a chaque ticket.
 */
const OFFLINE_TIMEOUT = 700;

/** Pour les appels qui sondent le reseau et peuvent legitimement durer. */
const LONG_TIMEOUT = 30_000;

function rawSend(path: string, init: RequestInit, timeoutMs?: number) {
  const limite = timeoutMs ?? (getOfflineState().online ? SERVER_TIMEOUT : OFFLINE_TIMEOUT);
  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), limite);
  return fetch('/api' + path, {
    ...init,
    signal: init.signal ?? stop.signal,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init.headers },
  }).finally(() => clearTimeout(minuteur));
}
setSender(rawSend);

async function request<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  let res: Response;
  try {
    res = await rawSend(path, init ?? {}, timeoutMs);
  } catch {
    // fetch only throws when the server could not be reached at all
    markOffline();
    throw new OfflineError();
  }
  if (isUnreachable(res)) {
    markOffline();
    throw new OfflineError();
  }
  markOnline();
  if (!res.ok) return fail(res);
  // A handler returning null/undefined (e.g. "no work day open") reaches the
  // browser as an empty body: res.json() would throw on it.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const authApi = {
  login: (credentials: { pin?: string; password?: string }) =>
    request<{ token: string; user: AuthUser }>('/auth/login', json('POST', credentials)),
  me: () => request<AuthUser>('/auth/me'),
};

// Reads the caisse must keep working without the server: the last successful
// response is cached and served when the server is unreachable.
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const value = await load();
    cacheSet(key, value);
    return value;
  } catch (e) {
    if (e instanceof OfflineError) {
      const value = cacheGet<T>(key);
      if (value !== null) return value;
    }
    throw e;
  }
}

// An order taken offline lives in the outbox and carries a negative id.
const isLocal = (orderId: number) => orderId < 0;

const cachedOrder = (orderId: number): Order | null =>
  (cacheGet<Order[]>('pendingOrders') ?? []).find((o) => o.id === orderId) ?? null;

const localAsOrder = (localId: number): Order => {
  const local = findLocal(localId);
  if (!local) throw new Error('Commande hors ligne introuvable');
  return localToOrder(local, cacheGet<Product[]>('products') ?? []);
};

export const api = {
  categories: () => cached('categories', () => request<Category[]>('/categories')),
  // Stock shown offline accounts for what was already sold from the outbox
  products: async () => applyPendingStock(await cached('products', () => request<Product[]>('/products'))),
  staff: () => cached('staff', () => request<StaffMember[]>('/staff')),

  // Orders settled since the business day opened (not the calendar day: a
  // day that runs past midnight stays the same day until closed by hand),
  // plus those still waiting in the outbox. Newest last.
  recentOrders: async (sinceIso: string | null): Promise<Order[]> => {
    const products = cacheGet<Product[]>('products') ?? [];
    const locals = getLocalOrders().map((l) => localToOrder(l, products));
    if (!sinceIso) return locals;
    try {
      const server = await request<Order[]>(
        `/orders?status=paid&since=${encodeURIComponent(sinceIso)}&limit=200`,
      );
      cacheSet('pendingOrders', server);
      return [...applyOpsToOrders(server), ...locals];
    } catch (e) {
      if (e instanceof OfflineError) {
        return [...applyOpsToOrders(cacheGet<Order[]>('pendingOrders') ?? []), ...locals];
      }
      throw e;
    }
  },

  createOrder: async (payload: CreateOrderPayload): Promise<Order> => {
    try {
      return await request<Order>('/orders', json('POST', payload));
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      return localToOrder(queueOrder(payload), cacheGet<Product[]>('products') ?? []);
    }
  },

  addItems: async (orderId: number, items: OrderLinePayload[]): Promise<Order> => {
    if (isLocal(orderId)) {
      localAddItems(orderId, items);
      return localAsOrder(orderId);
    }
    try {
      return await request<Order>(`/orders/${orderId}/items`, json('POST', { items }));
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      queueOp({ orderId, kind: 'addItems', payload: { items } });
      const known = cachedOrder(orderId);
      if (known) return applyOpsToOrders([known])[0] ?? known;
      throw e;
    }
  },

  payOrder: async (orderId: number, payload: PayOrderPayload): Promise<Order> => {
    if (isLocal(orderId)) {
      localPay(orderId, payload);
      return localAsOrder(orderId);
    }
    try {
      return await request<Order>(`/orders/${orderId}/pay`, json('PATCH', payload));
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      const paidAt = new Date().toISOString();
      queueOp({ orderId, kind: 'pay', payload: { ...payload, paidAt } });
      const known = cachedOrder(orderId);
      // The payment is recorded here and will be sent; show the receipt as usual
      if (known) return paidOptimistically(known, payload, paidAt);
      throw e;
    }
  },

  cancelOrder: async (orderId: number): Promise<Order> => {
    if (isLocal(orderId)) {
      const order = localAsOrder(orderId);
      localRemove(orderId); // never sent, so nothing to cancel server-side
      return { ...order, status: 'cancelled' };
    }
    try {
      return await request<Order>(`/orders/${orderId}/cancel`, { method: 'PATCH' });
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      queueOp({ orderId, kind: 'cancel' });
      const known = cachedOrder(orderId);
      if (known) return { ...known, status: 'cancelled', offline: true };
      throw e;
    }
  },

  updateOrder: async (orderId: number, payload: UpdateOrderPayload): Promise<Order> => {
    if (isLocal(orderId)) {
      localUpdateOrder(orderId, payload);
      return localAsOrder(orderId);
    }
    try {
      return await request<Order>(`/orders/${orderId}`, json('PATCH', payload));
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      queueOp({ orderId, kind: 'update', payload });
      const known = cachedOrder(orderId);
      if (known) return { ...known, ...payload, offline: true } as Order;
      throw e;
    }
  },

  // quantity 0 removes the line
  updateItem: async (orderId: number, itemId: number, quantity: number): Promise<Order> => {
    if (isLocal(orderId)) {
      // local item ids are -(index + 1)
      localUpdateItem(orderId, Math.abs(itemId) - 1, quantity);
      return localAsOrder(orderId);
    }
    try {
      return await request<Order>(`/orders/${orderId}/items/${itemId}`, json('PATCH', { quantity }));
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      queueOp({ orderId, kind: 'updateItem', payload: { itemId, body: { quantity } } });
      const known = cachedOrder(orderId);
      if (known) return applyOpsToOrders([known])[0] ?? known;
      throw e;
    }
  },

  deleteOrder: async (orderId: number): Promise<{ deleted: boolean }> => {
    if (isLocal(orderId)) {
      localRemove(orderId);
      return { deleted: true };
    }
    try {
      return await request<{ deleted: boolean }>(`/orders/${orderId}`, { method: 'DELETE' });
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      queueOp({ orderId, kind: 'delete' });
      return { deleted: true };
    }
  },

  syncOutbox: sync,
};

// ---------- Journée de travail (ouverture/clôture manuelle de la caisse) ----------

export interface WaiterTotals {
  waiterId: number | null;
  waiterName: string;
  orders: number;
  items: number;
  revenue: number;
  cash: number;
  card: number;
}

export interface WorkDaySummary {
  orders: number;
  revenue: number;
  cash: number;
  card: number;
  // What each waiter brought in during the day, best first
  byWaiter: WaiterTotals[];
}

export interface WorkDay {
  id: number;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  summary: WorkDaySummary;
}

export const workDayApi = {
  // null = no day currently open. Cached: offline, the caisse trusts the last
  // known state rather than blocking service.
  current: () => cached('workDay', () => request<WorkDay | null>('/work-day/current')),
  open: () => request<WorkDay>('/work-day/open', { method: 'POST' }),
  close: (id: number) => request<WorkDay>(`/work-day/${id}/close`, { method: 'PATCH' }),
};

export const CURRENCY = 'DH';

export function formatPrice(amount: number) {
  return `${amount.toFixed(2)} ${CURRENCY}`;
}

// "Sur place" / "À emporter"
export function orderLabel(order: Pick<Order, 'orderType'>) {
  return order.orderType === 'takeaway' ? 'À emporter' : 'Sur place';
}

// ---------- Admin: products, categories, employees ----------

export interface ProductPayload {
  name: string;
  description?: string | null;
  price: number;
  stock?: number;
  lowStockThreshold?: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  categoryId?: number | null;
}

export interface CategoryPayload {
  name: string;
  icon?: string | null;
  sortOrder?: number;
  station?: 'kitchen' | 'bar';
}

export const EMPLOYEE_ROLES = {
  serveur: 'Serveur',
  caissier: 'Caissier',
  barman: 'Barman',
  cuisinier: 'Cuisinier',
  menage: 'Femme de ménage',
  manager: 'Manager',
} as const;
export type EmployeeRole = keyof typeof EMPLOYEE_ROLES;

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  phone: string | null;
  salary: number | null;
  hireDate: string | null;
  pin: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Nom affiché. Le nom de famille étant facultatif — au café on connaît souvent
 * l'employé par son seul prénom —, un `${firstName} ${lastName}` laissait une
 * espace en trop derrière le prénom.
 */
export const staffName = (s: { firstName: string; lastName?: string | null }) =>
  `${s.firstName} ${s.lastName ?? ''}`.trim();

/** Initiales de la pastille : deux lettres, ou une seule faute de nom. */
export const staffInitials = (s: { firstName: string; lastName?: string | null }) =>
  (s.firstName.charAt(0) + (s.lastName?.charAt(0) ?? '')).toUpperCase();

export interface EmployeePayload {
  firstName: string;
  lastName?: string;
  role: EmployeeRole;
  phone?: string | null;
  salary?: number | null;
  hireDate?: string | null;
  pin?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

// Multipart upload: let the browser set the Content-Type boundary
async function upload<T>(path: string, field: string, file: File): Promise<T> {
  const body = new FormData();
  body.append(field, file);
  const res = await fetch('/api' + path, { method: 'POST', body, headers: authHeaders() });
  if (!res.ok) return fail(res);
  return res.json() as Promise<T>;
}

export const adminApi = {
  createProduct: (payload: ProductPayload) => request<Product>('/products', json('POST', payload)),
  updateProduct: (id: number, payload: Partial<ProductPayload>) =>
    request<Product>(`/products/${id}`, json('PATCH', payload)),
  adjustStock: (id: number, delta: number) =>
    request<Product>(`/products/${id}/stock`, json('PATCH', { delta })),
  uploadProductImage: (id: number, file: File) =>
    upload<Product>(`/products/${id}/image`, 'image', file),
  deleteProduct: (id: number) =>
    request<{ deleted: boolean }>(`/products/${id}`, { method: 'DELETE' }),

  createCategory: (payload: CategoryPayload) =>
    request<Category>('/categories', json('POST', payload)),
  updateCategory: (id: number, payload: Partial<CategoryPayload>) =>
    request<Category>(`/categories/${id}`, json('PATCH', payload)),
  deleteCategory: (id: number) =>
    request<{ deleted: boolean }>(`/categories/${id}`, { method: 'DELETE' }),

  employees: (includeInactive = true) =>
    request<Employee[]>(`/employees${includeInactive ? '?all=1' : ''}`),
  createEmployee: (payload: EmployeePayload) =>
    request<Employee>('/employees', json('POST', payload)),
  updateEmployee: (id: number, payload: Partial<EmployeePayload>) =>
    request<Employee>(`/employees/${id}`, json('PATCH', payload)),
  deleteEmployee: (id: number) =>
    request<{ deleted: boolean }>(`/employees/${id}`, { method: 'DELETE' }),
};

// ---------- Stats (dashboard) ----------

export interface StatsTotals {
  revenue: number;
  orders: number;
  items: number;
  averageTicket: number;
  discounts: number;
  cash: number;
  card: number;
  dineIn: number;
  takeaway: number;
  cancelled: number;
}

export interface ProductStat {
  productId: number | null;
  name: string;
  quantity: number;
  revenue: number;
}

export interface Stats {
  range: { from: string; to: string; days: number };
  totals: StatsTotals;
  previous: StatsTotals;
  byDay: { day: string; revenue: number; orders: number }[];
  byHour: { hour: number; revenue: number; orders: number }[];
  bestSellers: { byQuantity: ProductStat[]; byRevenue: ProductStat[] };
  byCategory: { name: string; quantity: number; revenue: number }[];
  unsold: { productId: number; name: string; price: number; stock: number }[];
}

/**
 * Ce que la caisse a vu la derniere fois, lisible sans reseau. Permet de
 * peindre l'ecran a l'ouverture au lieu d'attendre le serveur : avec un serveur
 * lointain, l'attente se voyait a chaque demarrage, pour des donnees — le menu,
 * les employes — qui n'avaient pas bouge.
 */
export function cachedSnapshot() {
  return {
    categories: cacheGet<Category[]>('categories'),
    products: cacheGet<Product[]>('products'),
    staff: cacheGet<StaffMember[]>('staff'),
    workDay: cacheGet<WorkDay | null>('workDay'),
  };
}

export const statsApi = {
  summary: (from: string, to: string) => request<Stats>(`/stats?from=${from}&to=${to}`),
  orders: (status: OrderStatus, from: string, to: string, limit = 200) =>
    request<Order[]>(`/orders?status=${status}&from=${from}&to=${to}&limit=${limit}`),
};

// ---------- Printing (network thermal printers, driven by the server) ----------

export type PrinterId = 'counter' | 'kitchen' | 'barman';
export type TicketKind = 'kitchen' | 'bill' | 'receipt' | 'barman';

export interface PrinterConfig {
  enabled: boolean;
  host: string;
  port: number;
  width: number;
  /** Network serial number: how the printer is found again if its IP changes. */
  mac: string;
}

export interface FoundPrinter {
  host: string;
  port: number;
  mac: string;
}

export interface PrintingConfig {
  counter: PrinterConfig;
  kitchen: PrinterConfig;
  barman: PrinterConfig;
  autoKitchen: boolean;
  /** Laisse le navigateur imprimer quand le serveur ne le peut pas. */
  browserFallback?: boolean;
  header: {
    name: string;
    subtitle: string;
    address: string;
    phone: string;
    footer: string;
    wifiName?: string;
    wifiPassword?: string;
  };
  // Serveur hébergé à distance : les tickets sont mis en attente pour le
  // relais local plutôt qu'envoyés directement.
  relayEnabled: boolean;
  relayToken: string;
}

export interface PrintResult {
  printed: boolean;
  printer: PrinterId;
  reason?: string;
  host?: string;
  mac?: string;
}

export const printingApi = {
  // Mise en cache comme le reste : sans elle, une caisse rechargée pendant une
  // coupure ignorerait qu'elle a le droit d'imprimer par le navigateur, et
  // aucun ticket ne sortirait — justement quand on en a le plus besoin.
  config: () => cached('printingConfig', () => request<PrintingConfig>('/printing/config')),
  save: (patch: Partial<PrintingConfig>) =>
    request<PrintingConfig>('/printing/config', json('PUT', patch)),
  // Ces deux-la sondent le reseau -- une imprimante lente a repondre, ou un
  // balayage complet. La limite courte les trancherait a tort.
  test: (printer: PrinterId) =>
    request<PrintResult>(`/printing/test/${printer}`, { method: 'POST' }, LONG_TIMEOUT),
  discover: () => request<FoundPrinter[]>('/printing/discover', undefined, LONG_TIMEOUT),
  regenerateRelayToken: async (): Promise<string> =>
    (await request<{ relayToken: string }>('/printing/relay/token', { method: 'POST' })).relayToken,
  // Accessible à la caisse, contrairement au reste de la configuration
  setAutoKitchen: (enabled: boolean) =>
    request<PrintingConfig>('/printing/auto-kitchen', json('PATCH', { enabled })),
  print: (kind: TicketKind, orderId: number) =>
    request<PrintResult>(`/printing/${kind}/${orderId}`, { method: 'POST' }),
};
