import {
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { STORE_CONFIG } from "./data.js";
import { availableUnits, formatMoney, storeApi } from "./storeApi.js";

const STATUS_LABELS = {
  cart: "Cart",
  reserved: "Reserved",
  paid_mock: "Paid",
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

function routeToStaffSection(path) {
  if (path.endsWith("/reservations")) {
    return "reservations";
  }
  if (path.endsWith("/payments")) {
    return "payments";
  }
  if (path.endsWith("/pickup")) {
    return "pickup";
  }
  return "inventory";
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

const STAFF_NAV = [
  { id: "inventory", label: "Inventory", path: "/cisco-live-store/inventory", icon: PackageCheck },
  { id: "reservations", label: "Reservations", path: "/cisco-live-store/reservations", icon: ClipboardList },
  { id: "payments", label: "Payments", path: "/cisco-live-store/payments", icon: CreditCard },
  { id: "pickup", label: "Pickup token", path: "/cisco-live-store/pickup", icon: BadgeCheck },
];

function StoreHeader({ activeView, activeSection }) {
  const brandContent = (
    <>
      <span className="store-brand-mark">CL</span>
      <span>
        <strong>Cisco Live Store</strong>
        <small>
          {activeView === "pay" ? "Payment" : "Operations console"}
        </small>
      </span>
    </>
  );

  return (
    <header className="store-topbar">
      {activeView === "pay" ? (
        <div className="store-brand">{brandContent}</div>
      ) : (
        <a className="store-brand" href="#/cisco-live-store" aria-label="Cisco Live Store home">
          {brandContent}
        </a>
      )}

      {activeView !== "pay" ? (
        <nav className="store-nav" aria-label="Cisco Live Store navigation">
          {STAFF_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeSection === item.id ? "is-active" : ""}
                key={item.id}
                onClick={() => navigateTo(item.path)}
                type="button"
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      ) : null}
    </header>
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
      setError(err.message || "Unable to complete payment.");
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
        <p className="eyebrow">Secure payment</p>
        <h1>{paid ? "Payment received" : "Complete your Cisco Live Store reservation"}</h1>
        <p>
          Reservation <strong>{reservation.code}</strong> for {reservation.visitor.name}.
        </p>

        <div className="timer-strip">
          <CreditCard size={18} />
          <span>
            {paid ? "Payment completed" : `${formatRemaining(reservation.expiresAt)} remaining`}
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
            Confirm payment
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
        <p>Enter the PIN to view inventory, reservations, and orders.</p>
        <input
          autoComplete="off"
          inputMode="numeric"
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN"
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
    const product = snapshot.products.find((entry) => entry.id === item.productId);
    return { ...item, product };
  });

  return (
    <div className="staff-section">
      <div className="staff-section-heading">
        <div>
          <p className="eyebrow">Inventory only</p>
          <h2>Inventory</h2>
        </div>
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
  const reservations = snapshot.reservations;

  return (
    <div className="staff-section">
      <div className="staff-section-heading">
        <div>
          <p className="eyebrow">Reservations only</p>
          <h2>Reservations</h2>
        </div>
        <span>{reservations.length} total</span>
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
                <small>{reservation.items.length} item types</small>
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

function PaymentList({ snapshot }) {
  const orders = snapshot.orders;

  return (
    <div className="staff-section">
      <div className="staff-section-heading">
        <div>
          <p className="eyebrow">Payments only</p>
          <h2>Paid orders</h2>
        </div>
        <span>{orders.length} total</span>
      </div>
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
            </article>
          ))
        ) : (
          <p className="muted-copy">No payments completed yet.</p>
        )}
      </div>
    </div>
  );
}

function PickupTokenPanel({ snapshot, onPickup, busyCode }) {
  const [pickupToken, setPickupToken] = useState("");
  const readyOrders = snapshot.orders.filter((order) => order.status === "paid_mock");
  const pickedOrders = snapshot.orders.filter((order) => order.status === "picked_up");

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
        <div>
          <p className="eyebrow">Counter workflow</p>
          <h2>Pickup token</h2>
        </div>
        <span>{readyOrders.length} ready</span>
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

      <h3 className="subsection-title">Ready for pickup</h3>
      <div className="staff-list">
        {readyOrders.length > 0 ? (
          readyOrders.map((order) => (
            <article key={order.id}>
 ү