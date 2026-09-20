// Thin client for the NestJS API. All paths are relative: in dev Vite proxies
// /api and /uploads to localhost:3000 (see vite.config.ts).

import { getSession, setSession, type AuthUser } from './auth';

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
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
  tableNumber: string | null;
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
  tableNumber?: string;
  note?: string;
  // Pay immediately instead of leaving the order open
  payment?: PayOrderPayload;
}

export interface UpdateOrderPayload {
  orderType?: OrderType;
  tableNumber?: string | null;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch('/api' + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) return fail(res);
  return res.json() as Promise<T>;
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

export const api = {
  categories: () => request<Category[]>('/categories'),
  products: () => request<Product[]>('/products'),
  pendingOrders: () => request<Order[]>('/orders?status=pending'),
  createOrder: (payload: CreateOrderPayload) => request<Order>('/orders', json('POST', payload)),
  addItems: (orderId: number, items: OrderLinePayload[]) =>
    request<Order>(`/orders/${orderId}/items`, json('POST', { items })),
  payOrder: (orderId: number, payload: PayOrderPayload) =>
    request<Order>(`/orders/${orderId}/pay`, json('PATCH', payload)),
  cancelOrder: (orderId: number) =>
    request<Order>(`/orders/${orderId}/cancel`, { method: 'PATCH' }),
  updateOrder: (orderId: number, payload: UpdateOrderPayload) =>
    request<Order>(`/orders/${orderId}`, json('PATCH', payload)),
  // quantity 0 removes the line
  updateItem: (orderId: number, itemId: number, quantity: number) =>
    request<Order>(`/orders/${orderId}/items/${itemId}`, json('PATCH', { quantity })),
  deleteOrder: (orderId: number) =>
    request<{ deleted: boolean }>(`/orders/${orderId}`, { method: 'DELETE' }),
};

export const CURRENCY = 'DH';

export function formatPrice(amount: number) {
  return `${amount.toFixed(2)} ${CURRENCY}`;
}

// "Table 4" / "Sur place" / "À emporter" — based on the order type, not on
// whether a table number was typed.
export function orderLabel(order: Pick<Order, 'orderType' | 'tableNumber'>) {
  if (order.orderType === 'takeaway') return 'À emporter';
  return order.tableNumber ? `Table ${order.tableNumber}` : 'Sur place';
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

export interface EmployeePayload {
  firstName: string;
  lastName: string;
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
