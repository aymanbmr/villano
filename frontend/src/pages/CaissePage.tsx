import { useCallback, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  workDayApi,
  type Category,
  type CreateOrderPayload,
  type Order,
  type PayOrderPayload,
  type Product,
  type StaffMember,
  type UpdateOrderPayload,
  type WorkDay,
  formatPrice,
  orderLabel,
} from '../api';
import { useCart } from '../useCart';
import { MenuGrid } from '../components/MenuGrid';
import { CartPanel } from '../components/CartPanel';
import { OpenOrders } from '../components/OpenOrders';
import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { PrintTicket, type TicketKind } from '../components/PrintTicket';
import { usePrint } from '../usePrint';
import { AppBar } from '../components/AppBar';
import { UserMenu } from '../components/UserMenu';
import { Icon } from '../components/Icon';
import { OpenDayButton, WorkDayButton } from '../components/WorkDayButton';
import { WorkDayModal } from '../components/WorkDayModal';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { useOffline } from '../offline';

type View = 'new' | 'open';
type MobilePanel = 'menu' | 'cart';

const AUTO_PRINT_KEY = 'villano.autoPrintKitchen';

const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Erreur réseau, réessayez.';

export function CaissePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // undefined = not checked yet, null = closed, object = the open day
  const [workDay, setWorkDay] = useState<WorkDay | null | undefined>(undefined);
  const { online } = useOffline();
  // The "open the day" popup: shown after login while no day is open, and
  // again if the server refuses an order for that reason.
  const [dayPromptHidden, setDayPromptHidden] = useState(false);

  const [view, setView] = useState<View>('new');
  // Small screens (waiter's phone): show either the menu or the cart, full screen
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('menu');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  // Open order the cart is adding items to (null = creating a new order)
  const [appendTo, setAppendTo] = useState<Order | null>(null);

  const [busy, setBusy] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paidOrder, setPaidOrder] = useState<Order | null>(null);
  const cart = useCart();
  const { job: printJob, print, serverPrintsKitchen } = usePrint();
  const [autoPrintKitchen, setAutoPrintKitchen] = useState(() => {
    try {
      return localStorage.getItem(AUTO_PRINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleAutoPrint = (value: boolean) => {
    setAutoPrintKitchen(value);
    try {
      localStorage.setItem(AUTO_PRINT_KEY, value ? '1' : '0');
    } catch {
      // private mode: keep in memory only
    }
  };

  const load = useCallback(async () => {
    try {
      const [cats, prods, staffList, pending, day] = await Promise.all([
        api.categories(),
        api.products(),
        api.staff(),
        api.recentOrders(),
        workDayApi.current(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setStaff(staffList);
      setPendingOrders(pending);
      setWorkDay(day);
      cart.syncProducts(prods);
      setLoadError(null);
    } catch (e) {
      setLoadError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger le menu. Le serveur est-il démarré ?',
      );
    }
  }, [cart.syncProducts]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep stock and open orders fresh when several caisses are in use
  useEffect(() => {
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Builds ticket lines from the cart for an "ajout" kitchen ticket
  const addedLines = (items: CreateOrderPayload['items']): Order['items'] =>
    items.map((it, idx) => {
      const line = cart.lines.find((l) => l.product.id === it.productId);
      const unitPrice = line?.product.price ?? 0;
      return {
        id: -(idx + 1),
        productId: it.productId,
        productName: line?.product.name ?? `Produit #${it.productId}`,
        unitPrice,
        quantity: it.quantity,
        lineTotal: unitPrice * it.quantity,
      };
    });

  const sendOrder = async (payload: CreateOrderPayload) => {
    setBusy(true);
    setCartError(null);
    try {
      let order: Order;
      if (appendTo) {
        order = await api.addItems(appendTo.id, payload.items);
        setToast(`Articles ajoutés à la commande ${order.ticketNumber}`);
        // The kitchen only needs the lines that were just added. The server
        // already sent them to the network printer, so this is the fallback.
        if (autoPrintKitchen && !serverPrintsKitchen)
          void print(
            { kind: 'kitchen', order: { ...order, items: addedLines(payload.items) } },
            { server: false },
          );
      } else {
        order = await api.createOrder(payload);
        const where = orderLabel(order);
        setToast(`Commande ${order.ticketNumber} encaissée · ${where}`);
        if (autoPrintKitchen && !serverPrintsKitchen) void print({ kind: 'kitchen', order });
      }
      cart.clear();
      setAppendTo(null);
      setSelectedOrderId(order.id);
      await load();
    } catch (e) {
      const message = errorMessage(e);
      setCartError(message);
      if (/journée/i.test(message)) setDayPromptHidden(false);
      await load(); // stock may have changed under us
    } finally {
      setBusy(false);
    }
  };

  const payOrder = async (order: Order, payload: PayOrderPayload) => {
    setBusy(true);
    setPayError(null);
    try {
      const paid = await api.payOrder(order.id, payload);
      setPaidOrder(paid);
      setSelectedOrderId(null);
      await load();
    } catch (e) {
      setPayError(errorMessage(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  // Generic wrapper for edits on an open order: run, refresh, surface errors
  const editOrder = async (action: () => Promise<unknown>, successToast?: string) => {
    setBusy(true);
    setPayError(null);
    try {
      await action();
      if (successToast) setToast(successToast);
      await load();
    } catch (e) {
      setPayError(errorMessage(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const updateOrder = (order: Order, payload: UpdateOrderPayload) =>
    editOrder(() => api.updateOrder(order.id, payload));

  const updateItem = (order: Order, itemId: number, quantity: number) =>
    editOrder(() => api.updateItem(order.id, itemId, quantity));

  // Orders are settled when taken, so a mistake is cancelled rather than
  // deleted: the sale stays in the history, marked as cancelled.
  const cancelOrder = async (order: Order) => {
    setSelectedOrderId(null);
    await editOrder(
      () => api.cancelOrder(order.id),
      `Commande ${order.ticketNumber} annulée`,
    );
  };

  const startAppend = (order: Order) => {
    setAppendTo(order);
    setView('new');
    // On phone the product picker is a separate full-screen panel: jump to it
    setMobilePanel('menu');
  };

  const openCart = () => {
    setView('new');
    setMobilePanel('cart');
  };

  const cancelAppend = () => {
    setAppendTo(null);
    cart.clear();
  };

  // Offline the day state can only be the last known one: taking orders must
  // never be blocked by it (they sync once the server is back).
  const askToOpenDay = workDay === null && online && !dayPromptHidden;

  return (
    <>
      <div className={`pos show-${mobilePanel}`}>
        <AppBar
          actions={
            <>
              {!workDay && <OpenDayButton onOpen={() => setDayPromptHidden(false)} />}
              {workDay && (
                <WorkDayButton
                  workDay={workDay}
                  pendingCount={pendingOrders.filter((o) => o.status === 'pending').length}
                  onClosed={() => {
                    setWorkDay(null);
                    // closing is deliberate: don't pop the question straight back up
                    setDayPromptHidden(true);
                  }}
                />
              )}
              <UserMenu showAdminLink />
            </>
          }
        />
        <ConnectionBanner onSynced={() => void load()} />
        {askToOpenDay && (
          <WorkDayModal onOpened={setWorkDay} onDismiss={() => setDayPromptHidden(true)} />
        )}
        {loadError ? (
          <div className="load-error">
            <p>{loadError}</p>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              Réessayer
            </button>
          </div>
        ) : (
          <MenuGrid
            categories={categories}
            products={products}
            quantityOf={cart.quantityOf}
            onAdd={cart.add}
          />
        )}

        <aside className="cart">
          <div className="view-tabs">
            <button
              type="button"
              className={view === 'new' ? 'is-active' : ''}
              onClick={() => setView('new')}
            >
              Nouvelle commande
              {cart.count > 0 && <span className="pill">{cart.count}</span>}
            </button>
            <button
              type="button"
              className={view === 'open' ? 'is-active' : ''}
              onClick={() => setView('open')}
            >
              Du jour
              {pendingOrders.length > 0 && (
                <span className="pill pill-warn">{pendingOrders.length}</span>
              )}
            </button>
          </div>

          {view === 'new' ? (
            <CartPanel
              lines={cart.lines}
              subtotal={cart.subtotal}
              submitting={busy}
              error={cartError}
              appendTo={appendTo}
              staff={staff}
              onSetQuantity={cart.setQuantity}
              onRemove={cart.remove}
              onClear={cart.clear}
              onSubmit={sendOrder}
              onCancelAppend={cancelAppend}
              autoPrintKitchen={autoPrintKitchen}
              onToggleAutoPrint={toggleAutoPrint}
            />
          ) : (
            <OpenOrders
              orders={pendingOrders}
              selectedId={selectedOrderId}
              busy={busy}
              error={payError}
              staff={staff}
              onSelect={setSelectedOrderId}
              onPay={payOrder}
              onAddItems={startAppend}
              onUpdate={updateOrder}
              onUpdateItem={updateItem}
              onDelete={cancelOrder}
              onPrint={(order: Order, kind: TicketKind) => void print({ kind, order })}
            />
          )}
        </aside>

        {mobilePanel === 'menu' && cart.count > 0 && (
          <button type="button" className="mobile-cart-bar" onClick={openCart}>
            <span className="row-icon">
              <Icon name="cart" size={18} />
              {cart.count} article{cart.count > 1 ? 's' : ''}
            </span>
            <span>{formatPrice(cart.subtotal)}</span>
          </button>
        )}

        <nav className="mobile-nav">
          <button
            type="button"
            className={mobilePanel === 'menu' ? 'is-active' : ''}
            onClick={() => setMobilePanel('menu')}
          >
            <span className="nav-icon">
              <Icon name="grid" size={22} />
            </span>
            Menu
          </button>
          <button
            type="button"
            className={mobilePanel === 'cart' ? 'is-active' : ''}
            onClick={() => setMobilePanel('cart')}
          >
            <span className="nav-icon">
              <Icon name="receipt" size={22} />
            </span>
            Commande
            {(view === 'new' ? cart.count : pendingOrders.length) > 0 && (
              <span className="pill pill-warn">
                {view === 'new' ? cart.count : pendingOrders.length}
              </span>
            )}
          </button>
        </nav>

        {toast && <div className="toast">{toast}</div>}
        {paidOrder && (
          <OrderSuccessModal
            order={paidOrder}
            onClose={() => setPaidOrder(null)}
            onPrint={() => void print({ kind: 'receipt', order: paidOrder })}
          />
        )}
      </div>
      {printJob && <PrintTicket {...printJob} />}
    </>
  );
}
