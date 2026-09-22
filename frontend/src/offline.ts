import { useEffect, useState } from 'react';
import type {
  CreateOrderPayload,
  Order,
  OrderLinePayload,
  PayOrderPayload,
  Product,
  UpdateOrderPayload,
} from './api';

// ---------------------------------------------------------------------------
// Offline support for the caisse.
//
// When the server is unreachable the caisse keeps taking orders: they are
// written to an "outbox" in localStorage and replayed as soon as the server
// answers again. Every queued order carries a clientId, and the server ignores
// a clientId it already has, so a replay can never create a duplicate.
// ---------------------------------------------------------------------------

const OUTBOX_KEY = 'villano.outbox.v1';
const CACHE_KEY = 'villano.cache.v1';

export class OfflineError extends Error {
  constructor() {
    super('Serveur injoignable');
  }
}

/** An order taken while offline: it does not exist on the server yet. */
export interface LocalOrder {
  localId: number; // negative, so it never collides with a server id
  clientId: string;
  occurredAt: string;
  payload: CreateOrderPayload;
  payment?: PayOrderPayload & { paidAt: string };
  error?: string;
}

/** A change to an order that DOES exist on the server, made while offline. */
export interface PendingOp {
  id: string;
  orderId: number;
  kind: 'pay' | 'cancel' | 'update' | 'addItems' | 'updateItem' | 'delete';
  payload?: unknown;
  error?: string;
}

interface Outbox {
  localOrders: LocalOrder[];
  ops: PendingOp[];
  nextLocalId: number; // counts down: -1, -2, …
  nextLocalNumber: number; // human-facing "Hors ligne #n"
}

const EMPTY: Outbox = { localOrders: [], ops: [], nextLocalId: -1, nextLocalNumber: 1 };

function readOutbox(): Outbox {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Outbox) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

let outbox: Outbox = readOutbox();

function writeOutbox(next: Outbox) {
  outbox = next;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the queue still lives in memory for this session
  }
  notify();
}

// ---------------------------------------------------------------------------
// Subscribers (React)
// ---------------------------------------------------------------------------

export interface OfflineState {
  online: boolean;
  pending: number; // orders + operations waiting to be sent
  syncing: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
}

let online = true;
let syncing = false;
let lastError: string | null = null;
let lastSyncAt: string | null = null;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const getOfflineState = (): OfflineState => ({
  online,
  pending: outbox.localOrders.length + outbox.ops.length,
  syncing,
  lastError,
  lastSyncAt,
});

export function useOffline(): OfflineState {
  const [state, setState] = useState(getOfflineState);
  useEffect(() => {
    const l = () => setState(getOfflineState());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export function markOnline() {
  if (!online) {
    online = true;
    notify();
    void sync(); // back on the network: flush whatever is queued
  }
}

export function markOffline() {
  if (online) {
    online = false;
    notify();
  }
}

/** Ask the server directly; used by the periodic probe. */
export async function probe(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (res.ok) {
      markOnline();
      return true;
    }
  } catch {
    // unreachable
  }
  markOffline();
  return false;
}

/** Starts the connectivity watcher. Returns a stop function. */
export function watchConnection(intervalMs = 10_000) {
  const onOnline = () => void probe();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', markOffline);
  void probe();
  const timer = setInterval(() => {
    // While offline, probe often so service resumes quickly; while online the
    // probe only confirms the server is still there.
    void probe();
  }, intervalMs);
  return () => {
    clearInterval(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', markOffline);
  };
}

// ---------------------------------------------------------------------------
// Read cache (menu, staff): lets the caisse display products while offline
// ---------------------------------------------------------------------------

type Cache = Record<string, unknown>;

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}

export function cacheSet(key: string, value: unknown) {
  const cache = readCache();
  cache[key] = value;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

export function cacheGet<T>(key: string): T | null {
  const value = readCache()[key];
  return value === undefined ? null : (value as T);
}

// ---------------------------------------------------------------------------
// Queueing
// ---------------------------------------------------------------------------

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Local id -> the Order shape the UI expects. */
export function localToOrder(local: LocalOrder, products: Product[]): Order {
  const items = local.payload.items.map((line, index) => {
    const p = products.find((x) => x.id === line.productId);
    const unitPrice = p?.price ?? 0;
    return {
      id: -(index + 1),
      productId: line.productId,
      productName: p?.name ?? `Produit #${line.productId}`,
      unitPrice,
      quantity: line.quantity,
      lineTotal: Math.round(unitPrice * line.quantity * 100) / 100,
    };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  const discount = local.payment?.discount ?? 0;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const amountPaid = local.payment
    ? (local.payment.paymentMethod === 'card' ? total : (local.payment.amountPaid ?? total))
    : null;
  return {
    id: local.localId,
    ticketNumber: `Hors ligne #${Math.abs(local.localId)}`,
    clientId: local.clientId,
    orderType: local.payload.orderType ?? 'dine_in',
    tableNumber: local.payload.tableNumber ?? null,
    waiterId: local.payload.waiterId ?? null,
    waiterName: local.payload.waiterName ?? null,
    status: local.payment ? 'paid' : 'pending',
    subtotal,
    discount,
    total,
    paymentMethod: local.payment?.paymentMethod ?? null,
    amountPaid,
    changeGiven: amountPaid != null ? Math.round((amountPaid - total) * 100) / 100 : 0,
    paidAt: local.payment?.paidAt ?? null,
    note: local.payload.note ?? null,
    items,
    createdAt: local.occurredAt,
    offline: true,
  } as Order;
}

export const getLocalOrders = () => outbox.localOrders;

export function queueOrder(payload: CreateOrderPayload): LocalOrder {
  const local: LocalOrder = {
    localId: outbox.nextLocalId,
    clientId: uuid(),
    occurredAt: new Date().toISOString(),
    payload,
    payment: payload.payment
      ? { ...payload.payment, paidAt: new Date().toISOString() }
      : undefined,
  };
  writeOutbox({
    ...outbox,
    localOrders: [...outbox.localOrders, local],
    nextLocalId: outbox.nextLocalId - 1,
    nextLocalNumber: outbox.nextLocalNumber + 1,
  });
  return local;
}

const replaceLocal = (localId: number, change: (l: LocalOrder) => LocalOrder) =>
  writeOutbox({
    ...outbox,
    localOrders: outbox.localOrders.map((l) => (l.localId === localId ? change(l) : l)),
  });

export const findLocal = (localId: number) =>
  outbox.localOrders.find((l) => l.localId === localId) ?? null;

export function localAddItems(localId: number, items: OrderLinePayload[]) {
  replaceLocal(localId, (l) => {
    const merged = [...l.payload.items];
    for (const line of items) {
      const found = merged.find((m) => m.productId === line.productId);
      if (found) found.quantity += line.quantity;
      else merged.push({ ...line });
    }
    return { ...l, payload: { ...l.payload, items: merged } };
  });
}

export function localUpdateItem(localId: number, itemIndex: number, quantity: number) {
  replaceLocal(localId, (l) => {
    const items = l.payload.items
      .map((line, i) => (i === itemIndex ? { ...line, quantity } : line))
      .filter((line) => line.quantity > 0);
    return { ...l, payload: { ...l.payload, items } };
  });
}

export function localUpdateOrder(localId: number, patch: UpdateOrderPayload & { waiterName?: string | null }) {
  replaceLocal(localId, (l) => ({
    ...l,
    payload: {
      ...l.payload,
      // the local payload mirrors CreateOrderPayload, where empty means absent
      ...(patch.orderType !== undefined ? { orderType: patch.orderType } : {}),
      ...(patch.tableNumber !== undefined ? { tableNumber: patch.tableNumber ?? undefined } : {}),
      ...(patch.waiterId !== undefined ? { waiterId: patch.waiterId ?? undefined } : {}),
      ...(patch.waiterName !== undefined ? { waiterName: patch.waiterName } : {}),
      ...(patch.note !== undefined ? { note: patch.note ?? undefined } : {}),
    },
  }));
}

export function localPay(localId: number, payment: PayOrderPayload) {
  replaceLocal(localId, (l) => ({
    ...l,
    payment: { ...payment, paidAt: new Date().toISOString() },
  }));
  return findLocal(localId);
}

/** A local order cancelled before syncing simply never reaches the server. */
export function localRemove(localId: number) {
  writeOutbox({ ...outbox, localOrders: outbox.localOrders.filter((l) => l.localId !== localId) });
}

export const getOps = () => outbox.ops;

/**
 * Rebuilds what the server list would look like once the queued operations
 * have been sent: an order paid offline leaves "En cours", added lines show
 * up, and so on. Without this the caisse would keep showing an order the
 * cashier has already settled.
 */
export function applyOpsToOrders(orders: Order[]): Order[] {
  if (outbox.ops.length === 0) return orders;
  let result = orders;
  for (const op of outbox.ops) {
    if (op.kind === 'pay' || op.kind === 'cancel' || op.kind === 'delete') {
      result = result.filter((o) => o.id !== op.orderId);
      continue;
    }
    result = result.map((order) => {
      if (order.id !== op.orderId) return order;
      if (op.kind === 'update') {
        const patch = op.payload as UpdateOrderPayload & { waiterName?: string | null };
        return { ...order, ...patch } as Order;
      }
      if (op.kind === 'addItems') {
        const { items } = op.payload as { items: OrderLinePayload[] };
        const merged = order.items.map((i) => ({ ...i }));
        for (const line of items) {
          const found = merged.find((m) => m.productId === line.productId);
          if (found) {
            found.quantity += line.quantity;
            found.lineTotal = Math.round(found.unitPrice * found.quantity * 100) / 100;
          }
        }
        return recompute({ ...order, items: merged });
      }
      if (op.kind === 'updateItem') {
        const { itemId, body } = op.payload as { itemId: number; body: { quantity: number } };
        const items = order.items
          .map((i) =>
            i.id === itemId
              ? { ...i, quantity: body.quantity, lineTotal: Math.round(i.unitPrice * body.quantity * 100) / 100 }
              : i,
          )
          .filter((i) => i.quantity > 0);
        return recompute({ ...order, items });
      }
      return order;
    });
  }
  return result;
}

function recompute(order: Order): Order {
  const subtotal = Math.round(order.items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  return { ...order, subtotal, total: Math.round((subtotal - order.discount) * 100) / 100 };
}

/** The order as it will be once a queued payment has been sent. */
export function paidOptimistically(order: Order, payment: PayOrderPayload, paidAt: string): Order {
  const discount = payment.discount ?? 0;
  const total = Math.round((order.subtotal - discount) * 100) / 100;
  const amountPaid = payment.paymentMethod === 'card' ? total : (payment.amountPaid ?? total);
  return {
    ...order,
    discount,
    total,
    paymentMethod: payment.paymentMethod,
    amountPaid,
    changeGiven: Math.round((amountPaid - total) * 100) / 100,
    status: 'paid',
    paidAt,
    offline: true,
  };
}

export function queueOp(op: Omit<PendingOp, 'id'>) {
  writeOutbox({ ...outbox, ops: [...outbox.ops, { ...op, id: uuid() }] });
}

/** Quantities already committed offline, to show plausible stock in the menu. */
export function pendingStockUsage(): Map<number, number> {
  const used = new Map<number, number>();
  for (const l of outbox.localOrders) {
    for (const line of l.payload.items) {
      used.set(line.productId, (used.get(line.productId) ?? 0) + line.quantity);
    }
  }
  for (const op of outbox.ops) {
    if (op.kind === 'addItems') {
      for (const line of (op.payload as { items: OrderLinePayload[] }).items) {
        used.set(line.productId, (used.get(line.productId) ?? 0) + line.quantity);
      }
    }
  }
  return used;
}

export function applyPendingStock(products: Product[]): Product[] {
  const used = pendingStockUsage();
  if (used.size === 0) return products;
  return products.map((p) =>
    used.has(p.id) ? { ...p, stock: p.stock - (used.get(p.id) ?? 0) } : p,
  );
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

type Sender = (path: string, init: RequestInit) => Promise<Response>;

// Injected by api.ts so this module stays free of auth details
let send: Sender = async () => {
  throw new OfflineError();
};
export const setSender = (fn: Sender) => {
  send = fn;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

async function call(path: string, init: RequestInit): Promise<{ ok: true } | { ok: false; hard: boolean; message: string }> {
  try {
    const res = await send(path, init);
    if (res.ok) return { ok: true };
    // proxy/gateway failure: the server is down, keep the item queued
    if (res.status === 502 || res.status === 503 || res.status === 504 ||
        (res.status === 500 && !(res.headers.get('content-type') ?? '').includes('json'))) {
      markOffline();
      return { ok: false, hard: false, message: 'Serveur injoignable' };
    }
    // 4xx = the server refused this item; retrying identically won't help
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      // keep statusText
    }
    return { ok: false, hard: res.status >= 400 && res.status < 500, message };
  } catch {
    markOffline();
    return { ok: false, hard: false, message: 'Serveur injoignable' };
  }
}

/** Sends everything that is queued, oldest first. Safe to call at any time. */
export async function sync(): Promise<{ sent: number; failed: number }> {
  if (syncing) return { sent: 0, failed: 0 };
  if (outbox.localOrders.length === 0 && outbox.ops.length === 0) return { sent: 0, failed: 0 };
  syncing = true;
  lastError = null;
  notify();

  let sent = 0;
  let failed = 0;

  try {
    for (const local of [...outbox.localOrders]) {
      const body: Record<string, unknown> = {
        clientId: local.clientId,
        occurredAt: local.occurredAt,
        items: local.payload.items,
        orderType: local.payload.orderType,
        tableNumber: local.payload.tableNumber,
        waiterId: local.payload.waiterId,
        note: local.payload.note,
      };
      if (local.payment) {
        body.payment = {
          paymentMethod: local.payment.paymentMethod,
          amountPaid: local.payment.amountPaid,
          discount: local.payment.discount,
          paidAt: local.payment.paidAt,
        };
      }
      const r = await call('/orders', json('POST', body));
      if (r.ok) {
        writeOutbox({
          ...outbox,
          localOrders: outbox.localOrders.filter((l) => l.clientId !== local.clientId),
        });
        sent++;
      } else if (r.hard) {
        replaceLocal(local.localId, (l) => ({ ...l, error: r.message }));
        lastError = r.message;
        failed++;
      } else {
        lastError = r.message;
        return { sent, failed: failed + 1 }; // network gone again: stop here
      }
    }

    for (const op of [...outbox.ops]) {
      const path = `/orders/${op.orderId}`;
      const init =
        op.kind === 'pay'
          ? json('PATCH', op.payload)
          : op.kind === 'cancel'
            ? { method: 'PATCH' }
            : op.kind === 'update'
              ? json('PATCH', op.payload)
              : op.kind === 'addItems'
                ? json('POST', op.payload)
                : op.kind === 'updateItem'
                  ? json('PATCH', (op.payload as { body: unknown }).body)
                  : { method: 'DELETE' };
      const url =
        op.kind === 'pay'
          ? `${path}/pay`
          : op.kind === 'cancel'
            ? `${path}/cancel`
            : op.kind === 'addItems'
              ? `${path}/items`
              : op.kind === 'updateItem'
                ? `${path}/items/${(op.payload as { itemId: number }).itemId}`
                : path;
      const r = await call(url, init);
      if (r.ok) {
        writeOutbox({ ...outbox, ops: outbox.ops.filter((o) => o.id !== op.id) });
        sent++;
      } else if (r.hard) {
        writeOutbox({
          ...outbox,
          ops: outbox.ops.map((o) => (o.id === op.id ? { ...o, error: r.message } : o)),
        });
        lastError = r.message;
        failed++;
      } else {
        lastError = r.message;
        return { sent, failed: failed + 1 };
      }
    }
    lastSyncAt = new Date().toISOString();
    return { sent, failed };
  } finally {
    syncing = false;
    notify();
  }
}

/** Drops queued items the server refused (after the cashier has been told). */
export function discardFailed() {
  writeOutbox({
    ...outbox,
    localOrders: outbox.localOrders.filter((l) => !l.error),
    ops: outbox.ops.filter((o) => !o.error),
  });
}
