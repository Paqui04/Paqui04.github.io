import {
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ExternalLink,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { bundles, products, STORE_CONFIG } from "./data.js";
import { availableUnits, formatMoney, storeApi } from "./storeApi.js";

const STATUS_LABELS = {
  cart: "Cart",
  reserved: "Reserved",
  paid_mock: "Paid mock",
  expired: "Expired",
  cancelled: "Cancelled",
  picked_up: "Picked up",
};

function routeToView(path) {
  if (path.endsWith("/pay")) {
    return "pay";
  }
  return "staff";
}

function navigateTo(path) {
  window.location.hash = path;
}

function useStoreSnapshot() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setError("");
      const nextSnapshot = await storeApi.getSnapshot();
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (err) {
      setError(err.message || "Unable to load store state.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(id);
  }, []);

  return { snapshot, loading, error, setError, refresh };
}

function getInventory(snapshot, productId, size) {
  return snapshot?.inventory.find(
    (item) => item.productId === productId && item.size === size,
  );
}

function getAvailable(snapshot, productId, size) {
  const inventory = getInventory(snapshot, productId, size);
  return inventory ? availableUnits(inventory) : 0;
}

function totalForItems(items) {
  return items.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return sum + (product?.price || 0) * item.quantity;
  }, 0);
}

function formatRemaining(expiresAt) {
  if (!expiresAt) {
    return "No timer";
  }

  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ProductVisual({ product }) {
  if (product.image) {
    return (
      <div className="product-visual product-photo-frame">
        <img src={product.image} alt={product.name} loading="lazy" />
      </div>
    );
  }

  return (
    <div
      className={`product-visual visual-${product.visualType}`}
      style={{ "--product-accent": product.accent }}
      aria-hidden="true"
    >
      <span className="visual-shape visual-main" />
      <span className="visual-shape visual-detail" />
      <span className="visual-shape visual-badge" />
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`status-pill status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

function StoreHeader({ activeView }) {
  const brandContent = (
    <>
      <span className="store-brand-mark">CL</span>
      <span>
        <strong>Cisco Live Store</strong>
        <small>
          {activeView === "pay" ? "Payment simulation" : "Operations console"}
        </small>
      </span>
    </>
  );

  return (
    <header className="store-topbar">
      {activeView === "pay" ? (
        <div className="store-brand">{brandContent}</div>
      ) : (
        <a className="store-brand" href="#/cisco-live-store" aria-label="Cisco Live Store demo home">
          {brandContent}
        </a>
      )}

      {activeView !== "pay" ? (
        <nav className="store-nav" aria-label="Cisco Live Store navigation">
          <button
            className="is-active"
            onClick={() => navigateTo("/cisco-live-store")}
            type="button"
          >
            <ClipboardList size={16} />
            Operations
          </button>
        </nav>
      ) : null}
    </header>
  );
}

function ProductCard({ product, snapshot, onAdd }) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const available = getAvailable(snapshot, product.id, selectedSize);

  return (
    <article className="store-product-card">
      <ProductVisual product={product} />
      <div className="product-meta">
        <div>
          <p className="eyebrow">{product.collection}</p>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
        </div>
        <strong>{formatMoney(product.price)}</strong>
      </div>

      <div className="size-row" aria-label={`${product.name} sizes`}>
        {product.sizes.map((size) => {
          const sizeAvailable = getAvailable(snapshot, product.id, size);
          return (
            <button
              className={size === selectedSize ? "is-selected" : ""}
              disabled={sizeAvailable <= 0}
              key={size}
              onClick={() => setSelectedSize(size)}
              title={`${sizeAvailable} available`}
              type="button"
            >
              {size}
            </button>
          );
        })}
      </div>

      <div className="product-actions">
        <span>{available} available</span>
        <button
          className="icon-button primary"
          disabled={available <= 0}
          onClick={() => onAdd(product.id, selectedSize)}
          type="button"
        >
          <Plus size={16} />
          Add
        </button>
      </div>
    </article>
  );
}

function CartPanel({ cart, onReserve, onRemove, onClear, busy, reservation }) {
  const total = totalForItems(cart);

  return (
    <aside className="store-cart-panel" aria-label="Agent reservation cart">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Agent action</p>
          <h2>Reservation cart</h2>
        </div>
        <MessageCircle size={22} />
      </div>

      <div className="visitor-strip">
        <Wifi size={18} />
        <span>
          {STORE_CONFIG.demoVisitor.name}
          <small>{STORE_CONFIG.demoVisitor.source}</small>
        </span>
      </div>

      {cart.length > 0 ? (
        <div className="cart-lines">
          {cart.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            return (
              <div className="cart-line" key={`${item.productId}-${item.size}`}>
                <span>
                  <strong>{product?.name}</strong>
                  <small>
                    Size {item.size} x {item.quantity}
                  </small>
                </span>
                <button
                  aria-label={`Remove ${product?.name}`}
                  className="icon-only"
                  onClick={() => onRemove(item.productId, item.size)}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted-copy">
          Add products or choose a bundle to simulate what the WhatsApp agent reserves.
        </p>
      )}

      <div className="cart-total">
        <span>Total</span>
        <strong>{formatMoney(total)}</strong>
      </div>

      <div className="cart-actions">
        <button
          className="icon-button primary"
          disabled={cart.length === 0 || busy}
          onClick={onReserve}
          type="button"
        >
          <CreditCard size={16} />
          Reserve and create link
        </button>
        <button
          className="icon-button ghost"
          disabled={cart.length === 0 || busy}
          onClick={onClear}
          type="button"
        >
          <RotateCcw size={16} />
          Clear
        </button>
      </div>

      {reservation ? (
        <div className="reservation-result">
          <span className="result-code">{reservation.code}</span>
          <p>
            Reserved for {STORE_CONFIG.reservationMinutes} minutes. Send this payment
            link in WhatsApp.
          </p>
          <a className="icon-button success" href={reservation.paymentLink}>
            <ExternalLink size={16} />
            Open payment link
          </a>
        </div>
      ) : null}
    </aside>
  );
}

function BundleRail({ onApplyBundle }) {
  return (
    <section className="bundle-rail" aria-label="Agent bundle presets">
      {bundles.map((bundle) => (
        <button key={bundle.id} onClick={() => onApplyBundle(bundle)} type="button">
          <PackageCheck size={18} />
          <span>
            <strong>{bundle.name}</strong>
            <small>{bundle.description}</small>
          </span>
        </button>
      ))}
    </section>
  );
}

function AgentSimulatorPanel({ snapshot, refresh, setError }) {
  const [cart, setCart] = useState([]);
  const [busy, setBusy] = useState(false);
  const [reservation, setReservation] = useState(null);

  function addToCart(productId, size, quantity = 1) {
    setReservation(null);
    setCart((current) => {
      const existing = current.find(
        (item) => item.productId === productId && item.size === size,
      );
      if (existing) {
        return current.map((item) =>
          item.productId === productId && item.size === size
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [...current, { productId, size, quantity }];
    });
  }

  function removeFromCart(productId, size) {
    setCart((current) =>
      current.filter((item) => item.productId !== productId || item.size !== size),
    );
  }

  function applyBundle(bundle) {
    setReservation(null);
    for (const item of bundle.items) {
      addToCart(item.productId, item.size, item.quantity);
    }
  }

  async function reserveCart() {
    try {
      setBusy(true);
      setError("");
      const nextReservation = await storeApi.createReservation({
        visitor: STORE_CONFIG.demoVisitor,
        items: cart,
        source: "webex-agent",
      });
      setReservation(nextReservation);
      setCart([]);
      await refresh();
    } catch (err) {
      setError(err.message || "Unable to reserve cart.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-section agent-simulator">
      <div className="staff-section-heading">
        <div>
          <p className="eyebrow">Internal demo tool</p>
          <h2>Agent reservation simulator</h2>
        </div>
        <span>Creates the customer payment link</span>
      </div>
      <p className="muted-copy">
        This panel represents what Webex AI Agent Studio would do through API calls:
        reserve inventory, create a temporary cart, and send a payment URL by WhatsApp.
      </p>

      <BundleRail onApplyBundle={applyBundle} />

      <section className="store-layout">
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              onAdd={addToCart}
              product={product}
              snapshot={snapshot}
            />
          ))}
        </div>

        <CartPanel
          busy={busy}
          cart={cart}
          onClear={() => {
            setCart([]);
            setReservation(null);
          }}
          onRemove={removeFromCart}
          onReserve={reserveCart}
          reservation={reservation}
        />
      </section>
    </section>
  );
}

function PaymentView({ snapshot, route, refresh, setError }) {
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const code = route.query.get("reservation");
  const reservation = snapshot?.reservations.find((item) => item.code === code);
  const order = snapshot?.orders.find((item) => item.reservationCode === code);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (reservation?.status === "reserved" && formatRemaining(reservation.expiresAt) === "Expired") {
      refresh();
    }
  }, [tick, reservation, refresh]);

  async function simulatePayment() {
    try {
      setBusy(true);
      setError("");
      await storeApi.confirmPayment({ reservationCode: code });
      await refresh();
    } catch (err) {
      setError(err.message || "Unable to complete mock payment.");
    } finally {
      setBusy(false);
    }
  }

  if (!code || !reservation) {
    return (
      <section className="payment-shell">
        <div className="empty-payment">
          <h1>Reservation not found</h1>
          <p>The payment link needs a valid reservation code.</p>
        </div>
      </section>
    );
  }

  const paid = reservation.status === "paid_mock" || reservation.status === "picked_up";

  return (
    <section className="payment-shell">
      <div className="payment-summary">
        <p className="eyebrow">Secure payment simulation</p>
        <h1>{paid ? "Payment received" : "Complete your Cisco Live Store reservation"}</h1>
        <p>
          Reservation <strong>{reservation.code}</strong> for {reservation.visitor.name}.
        </p>

        <div className="timer-strip">
          <CreditCard size={18} />
          <span>
            {paid ? "Mock payment completed" : `${formatRemaining(reservation.expiresAt)} remaining`}
          </span>
        </div>

        <div className="payment-lines">
          {reservation.items.map((item) => (
            <div key={`${item.productId}-${item.size}`}>
              <span>
                {item.name}
                <small>
                  Size {item.size} x {item.quantity}
                </small>
              </span>
              <strong>{formatMoney(item.lineTotal)}</strong>
            </div>
          ))}
        </div>

        <div className="payment-total">
          <span>Total due</span>
          <strong>{formatMoney(reservation.total)}</strong>
        </div>

        {paid ? (
          <div className="success-panel">
            <CheckCircle2 size={22} />
            <div>
              <span>Payment confirmed. Present this code at the counter.</span>
              <strong>{order?.pickupToken || "Token pending"}</strong>
              <small>
                Order {order?.id || reservation.code} is ready at Cisco Live Store -
                Counter 2.
              </small>
            </div>
          </div>
        ) : (
          <button
            className="icon-button primary wide"
            disabled={busy || reservation.status !== "reserved"}
            onClick={simulatePayment}
            type="button"
          >
            <CreditCard size={16} />
            Simulate payment
          </button>
        )}
      </div>
    </section>
  );
}

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [failed, setFailed] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (pin === STORE_CONFIG.staffPin) {
      try {
        window.sessionStorage?.setItem("cisco-live-store-staff", "unlocked");
      } catch {
        // Some embedded browsers disable sessionStorage; the PIN still unlocks this view.
      }
      onUnlock();
      return;
    }
    setFailed(true);
  }

  return (
    <section className="staff-gate">
      <form onSubmit={submit}>
        <LockKeyhole size={28} />
        <h1>Staff dashboard</h1>
        <p>Enter the demo PIN to view inventory, reservations, and orders.</p>
        <input
          autoComplete="off"
          inputMode="numeric"
          onChange={(event) => setPin(event.target.value)}
          placeholder="Demo PIN 2468"
          type="password"
          value={pin}
        />
        {failed ? <span className="form-error">Incorrect PIN.</span> : null}
        <button className="icon-button primary wide" type="submit">
          <UserCheck size={16} />
          Unlock dashboard
        </button>
      </form>
    </section>
  );
}

function InventoryTable({ snapshot }) {
  const rows = snapshot.inventory.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return { ...item, product };
  });

  return (
    <div className="staff-section">
      <div className="staff-section-heading">
        <h2>Inventory</h2>
        <span>{rows.length} SKUs</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Size</th>
              <th>Available</th>
              <th>Reserved</th>
              <th>Sold</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.productId}-${row.size}`}>
                <td>
                  <strong>{row.product?.name}</strong>
                  <small>{row.product?.collection}</small>
                </td>
                <td>{row.size}</td>
                <td>{availableUnits(row)}</td>
                <td>{row.reserved}</td>
                <td>{row.sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReservationList({ snapshot }) {
  const reservations = snapshot.reservations.slice(0, 8);

  return (
    <div className="staff-section">
      <div className="staff-section-heading">
        <h2>Reservations</h2>
        <span>{reservations.length} recent</span>
      </div>
      <div className="staff-list">
        {reservations.length > 0 ? (
          reservations.map((reservation) => (
            <article key={reservation.code}>
              <div>
                <strong>{reservation.code}</strong>
                <small>
                  {reservation.visitor.name} - {formatMoney(reservation.total)}
                </small>
              </div>
              <span>{formatRemaining(reservation.expiresAt)}</span>
              <StatusPill status={reservation.status} />
            </article>
          ))
        ) : (
          <p className="muted-copy">No reservations yet.</p>
        )}
      </div>
    </div>
  );
}

function OrderList({ snapshot, onPickup, busyCode }) {
  const [pickupToken, setPickupToken] = useState("");
  const orders = snapshot.orders.slice(0, 8);

  function submitPickup(event) {
    event.preventDefault();
    const token = pickupToken.trim().toUpperCase();
    if (!token) {
      return;
    }

    onPickup({ pickupToken: token });
    setPickupToken("");
  }

  return (
    <div className="staff-section">
      <div className="staff-section-heading">
        <h2>Orders</h2>
        <span>{orders.length} paid</span>
      </div>
      <form className="pickup-token-form" onSubmit={submitPickup}>
        <input
          autoComplete="off"
          onChange={(event) => setPickupToken(event.target.value)}
          placeholder="Enter pickup token, e.g. PK-8F42K"
          value={pickupToken}
        />
        <button className="icon-button primary compact" type="submit">
          <BadgeCheck size={15} />
          Pick up
        </button>
      </form>
      <div className="staff-list">
        {orders.length > 0 ? (
          orders.map((order) => (
            <article key={order.id}>
              <div>
                <strong>{order.id}</strong>
                <small>
                  {order.visitor.name} - {order.reservationCode} - {formatMoney(order.total)}
                </small>
                <code>{order.pickupToken || "No pickup token"}</code>
              </div>
              <StatusPill status={order.status} />
              {order.status !== "picked_up" ? (
                <button
                  className="icon-button compact"
                  disabled={busyCode === (order.pickupToken || order.reservationCode)}
                  onClick={() =>
                    onPickup(
                      order.pickupToken
                        ? { pickupToken: order.pickupToken }
                        : { reservationCode: order.reservationCode },
                    )
                  }
                  type="button"
                >
                  <BadgeCheck size={15} />
                  Picked up
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <p className="muted-copy">No mock payments completed yet.</p>
        )}
      </div>
    </div>
  );
}

function EventLog({ snapshot }) {
  return (
    <div className="staff-section event-log">
      <div className="staff-section-heading">
        <h2>Agent activity</h2>
        <span>{snapshot.events.length} events</span>
      </div>
      <div className="event-list">
        {snapshot.events.slice(0, 10).map((event) => (
          <article key={event.id}>
            <small>{new Date(event.createdAt).toLocaleTimeString()}</small>
            <span>{event.message}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function StaffView({ snapshot, refresh, setError }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return window.sessionStorage?.getItem("cisco-live-store-staff") === "unlocked";
    } catch {
      return false;
    }
  });
  const [busyCode, setBusyCode] = useState("");
  const stats = useMemo(() => {
    const activeReservations = snapshot.reservations.filter(
      (reservation) => reservation.status === "reserved",
    ).length;
    const paidOrders = snapshot.orders.filter((order) => order.status === "paid_mock").length;
    const soldUnits = snapshot.inventory.reduce((sum, item) => sum + item.sold, 0);

    return { activeReservations, paidOrders, soldUnits };
  }, [snapshot]);

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  async function markPickedUp(payload) {
    try {
      setBusyCode(payload.pickupToken || payload.reservationCode);
      setError("");
      await storeApi.markPickedUp(payload);
      await refresh();
    } catch (err) {
      setError(err.message || "Unable to mark order as picked up.");
    } finally {
      setBusyCode("");
    }
  }

  async function resetDemo() {
    await storeApi.resetDemo();
    await refresh();
  }

  return (
    <>
      <section className="staff-hero">
        <div>
          <p className="eyebrow">Internal company system</p>
          <h1>Store operations console</h1>
          <p>
            This is the employee-side system for inventory, reservations, paid
            mock orders, pickup status, and agent activity. Customers only see
            the payment URL generated from a reservation.
          </p>
        </div>
        <div className="staff-actions">
          <button className="icon-button ghost" onClick={refresh} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="icon-button danger" onClick={resetDemo} type="button">
            <RotateCcw size={16} />
            Reset demo
          </button>
        </div>
      </section>

      <section className="staff-stats" aria-label="Store metrics">
        <div>
          <strong>{stats.activeReservations}</strong>
          <span>Active reservations</span>
        </div>
        <div>
          <strong>{stats.paidOrders}</strong>
          <span>Ready for pickup</span>
        </div>
        <div>
          <strong>{stats.soldUnits}</strong>
          <span>Units sold mock</span>
        </div>
        <div>
          <strong>{storeApi.mode}</strong>
          <span>Data mode</span>
        </div>
      </section>

      <AgentSimulatorPanel refresh={refresh} setError={setError} snapshot={snapshot} />

      <section className="staff-grid">
        <InventoryTable snapshot={snapshot} />
        <ReservationList snapshot={snapshot} />
        <OrderList busyCode={busyCode} onPickup={markPickedUp} snapshot={snapshot} />
        <EventLog snapshot={snapshot} />
      </section>
    </>
  );
}

export default function CiscoLiveStoreDemo({ route }) {
  const view = routeToView(route.path);
  const { snapshot, loading, error, setError, refresh } = useStoreSnapshot();

  if (loading || !snapshot) {
    return (
      <div className="store-demo">
        <StoreHeader activeView={view} />
        <main className="store-loading">
          <RefreshCw size={22} />
          <span>Loading store demo...</span>
        </main>
      </div>
    );
  }

  return (
    <div className="store-demo">
      <StoreHeader activeView={view} />
      {error ? (
        <div className="store-alert" role="alert">
          {error}
        </div>
      ) : null}

      <main>
        {view === "pay" ? (
          <PaymentView
            refresh={refresh}
            route={route}
            setError={setError}
            snapshot={snapshot}
          />
        ) : null}
        {view === "staff" ? (
          <StaffView refresh={refresh} setError={setError} snapshot={snapshot} />
        ) : null}
      </main>
    </div>
  );
}
