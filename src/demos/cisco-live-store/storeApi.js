import { createClient } from "@supabase/supabase-js";
import { inventorySeed, products, STORE_CONFIG } from "./data.js";

const STORAGE_KEY = "cisco-live-store-state-v3";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PAYMENT_BASE_URL =
  import.meta.env.VITE_PAYMENT_BASE_URL || "https://paqui04.github.io/";
let memoryState = null;

function nowIso() {
  return new Date().toISOString();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function makeCode() {
  return `CLSTORE-${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeOrderId() {
  return `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
}

function makePickupToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "PK-";
  for (let index = 0; index < 5; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return token;
}

export function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: STORE_CONFIG.currency,
  }).format(amount);
}

export function getPaymentLink(code) {
  const base =
    typeof window === "undefined"
      ? PAYMENT_BASE_URL
      : `${window.location.origin}${window.location.pathname}`;

  return `${base}#/cisco-live-store/pay?reservation=${encodeURIComponent(code)}`;
}

export function createEmptyState() {
  return {
    products,
    inventory: inventorySeed.map((item) => ({
      ...item,
      reserved: 0,
      sold: 0,
    })),
    reservations: [],
    orders: [],
    events: [
      {
        id: crypto.randomUUID(),
        type: "system.seeded",
        message: "Demo catalog and inventory initialized.",
        createdAt: nowIso(),
      },
    ],
  };
}

function readState() {
  const storage = getBrowserStorage();
  if (!storage) {
    memoryState = normalizeState(memoryState || createEmptyState());
    return memoryState;
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = createEmptyState();
    writeState(seed);
    return seed;
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    const seed = createEmptyState();
    writeState(seed);
    return seed;
  }
}

function writeState(state) {
  const storage = getBrowserStorage();
  if (!storage) {
    memoryState = state;
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getBrowserStorage() {
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function normalizeState(state) {
  const current = new Date();
  let changed = false;

  for (const reservation of state.reservations) {
    if (
      reservation.status === "reserved" &&
      reservation.expiresAt &&
      new Date(reservation.expiresAt) <= current
    ) {
      releaseReservedItems(state, reservation.items);
      reservation.status = "expired";
      reservation.updatedAt = nowIso();
      state.events.unshift({
        id: crypto.randomUUID(),
        type: "reservation.expired",
        reservationCode: reservation.code,
        message: `${reservation.code} expired and released inventory.`,
        createdAt: nowIso(),
      });
      changed = true;
    }
  }

  if (changed) {
    writeState(state);
  }

  return state;
}

function findProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) {
    throw new Error(`Unknown product: ${productId}`);
  }

  return product;
}

function findInventory(state, productId, size) {
  const inventory = state.inventory.find(
    (item) => item.productId === productId && item.size === size,
  );
  if (!inventory) {
    throw new Error(`No inventory for ${productId} size ${size}`);
  }

  return inventory;
}

export function availableUnits(inventoryItem) {
  return inventoryItem.onHand - inventoryItem.reserved - inventoryItem.sold;
}

function reserveItems(state, items) {
  for (const item of items) {
    const inventory = findInventory(state, item.productId, item.size);
    if (availableUnits(inventory) < item.quantity) {
      const product = findProduct(item.productId);
      throw new Error(`${product.name} size ${item.size} is out of stock.`);
    }
  }

  for (const item of items) {
    const inventory = findInventory(state, item.productId, item.size);
    inventory.reserved += item.quantity;
  }
}

function releaseReservedItems(state, items) {
  for (const item of items) {
    const inventory = findInventory(state, item.productId, item.size);
    inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
  }
}

function convertReservedToSold(state, items) {
  for (const item of items) {
    const inventory = findInventory(state, item.productId, item.size);
    inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
    inventory.sold += item.quantity;
  }
}

function hydrateItems(items) {
  return items.map((item) => {
    const product = findProduct(item.productId);
    return {
      productId: item.productId,
      name: product.name,
      collection: product.collection,
      size: item.size,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: product.price * item.quantity,
    };
  });
}

function reservationTotal(items) {
  return items.reduce((sum, item) => sum + item.lineTotal, 0);
}

function getReservationByCode(state, code) {
  return state.reservations.find((reservation) => reservation.code === code);
}

function getOrderByPickupToken(state, pickupToken) {
  return state.orders.find(
    (order) => order.pickupToken?.toUpperCase() === pickupToken?.toUpperCase(),
  );
}

function uniquePickupToken(state) {
  let token = makePickupToken();
  while (getOrderByPickupToken(state, token)) {
    token = makePickupToken();
  }

  return token;
}

function createLocalApi() {
  return {
    mode: "local demo",

    async getSnapshot() {
      return readState();
    },

    async getInventory() {
      const state = readState();
      return {
        products: state.products,
        inventory: state.inventory,
      };
    },

    async listOrders() {
      return readState().orders;
    },

    async listReservations() {
      return readState().reservations;
    },

    async expireReservations() {
      return readState();
    },

    async resetDemo() {
      const state = createEmptyState();
      writeState(state);
      return state;
    },

    async createReservation({ visitor, items, source = "webex-agent" }) {
      const state = readState();
      const hydratedItems = hydrateItems(items);
      reserveItems(state, hydratedItems);

      let code = makeCode();
      while (getReservationByCode(state, code)) {
        code = makeCode();
      }

      const createdAt = nowIso();
      const reservation = {
        code,
        visitor: visitor || STORE_CONFIG.demoVisitor,
        source,
        status: "reserved",
        items: hydratedItems,
        total: reservationTotal(hydratedItems),
        paymentLink: getPaymentLink(code),
        createdAt,
        updatedAt: createdAt,
        expiresAt: addMinutes(new Date(), STORE_CONFIG.reservationMinutes),
      };

      state.reservations.unshift(reservation);
      state.events.unshift({
        id: crypto.randomUUID(),
        type: "reservation.created",
        reservationCode: code,
        message: `${code} reserved ${hydratedItems.length} item types from ${source}.`,
        createdAt,
      });

      writeState(state);
      return reservation;
    },

    async addItem({ reservationCode, productId, size, quantity = 1 }) {
      const state = readState();
      const reservation = getReservationByCode(state, reservationCode);
      if (!reservation || reservation.status !== "reserved") {
        throw new Error("Reservation is not active.");
      }

      const item = hydrateItems([{ productId, size, quantity }])[0];
      reserveItems(state, [item]);

      const existing = reservation.items.find(
        (row) => row.productId === productId && row.size === size,
      );
      if (existing) {
        existing.quantity += quantity;
        existing.lineTotal = existing.quantity * existing.unitPrice;
      } else {
        reservation.items.push(item);
      }
      reservation.total = reservationTotal(reservation.items);
      reservation.updatedAt = nowIso();

      state.events.unshift({
        id: crypto.randomUUID(),
        type: "reservation.item_added",
        reservationCode,
        message: `Agent added ${item.name} size ${size} to ${reservationCode}.`,
        createdAt: nowIso(),
      });

      writeState(state);
      return reservation;
    },

    async generatePaymentLink({ reservationCode }) {
      const state = readState();
      const reservation = getReservationByCode(state, reservationCode);
      if (!reservation) {
        throw new Error("Reservation not found.");
      }

      reservation.paymentLink = getPaymentLink(reservationCode);
      reservation.updatedAt = nowIso();
      writeState(state);
      return { paymentLink: reservation.paymentLink };
    },

    async confirmPayment({ reservationCode }) {
      const state = readState();
      const reservation = getReservationByCode(state, reservationCode);
      if (!reservation) {
        throw new Error("Reservation not found.");
      }
      if (reservation.status === "paid_mock") {
        return state.orders.find((order) => order.reservationCode === reservationCode);
      }
      if (reservation.status !== "reserved") {
        throw new Error(`Reservation is ${reservation.status}.`);
      }

      convertReservedToSold(state, reservation.items);
      reservation.status = "paid_mock";
      reservation.updatedAt = nowIso();

      const order = {
        id: makeOrderId(),
        reservationCode,
        pickupToken: uniquePickupToken(state),
        visitor: reservation.visitor,
        items: reservation.items,
        total: reservation.total,
        status: "paid_mock",
        pickupCounter: "Cisco Live Store - Counter 2",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      state.orders.unshift(order);
      state.events.unshift({
        id: crypto.randomUUID(),
        type: "payment.mock_completed",
        reservationCode,
        message: `${reservationCode} was paid and pickup token ${order.pickupToken} was issued.`,
        createdAt: nowIso(),
      });

      writeState(state);
      return order;
    },

    async markPaidMock(payload) {
      return this.confirmPayment(payload);
    },

    async cancelReservation({ reservationCode }) {
      const state = readState();
      const reservation = getReservationByCode(state, reservationCode);
      if (!reservation) {
        throw new Error("Reservation not found.");
      }
      if (reservation.status === "reserved") {
        releaseReservedItems(state, reservation.items);
      }

      reservation.status = "cancelled";
      reservation.updatedAt = nowIso();
      state.events.unshift({
        id: crypto.randomUUID(),
        type: "reservation.cancelled",
        reservationCode,
        message: `${reservationCode} was cancelled and inventory was released.`,
        createdAt: nowIso(),
      });

      writeState(state);
      return reservation;
    },

    async markPickedUp({ reservationCode, pickupToken }) {
      const state = readState();
      const order = pickupToken
        ? getOrderByPickupToken(state, pickupToken)
        : state.orders.find((item) => item.reservationCode === reservationCode);
      if (!order) {
        throw new Error("Order not found.");
      }
      if (order.status === "picked_up") {
        return order;
      }

      order.status = "picked_up";
      order.updatedAt = nowIso();
      const reservation = getReservationByCode(state, order.reservationCode);
      if (reservation) {
        reservation.status = "picked_up";
        reservation.updatedAt = nowIso();
      }

      state.events.unshift({
        id: crypto.randomUUID(),
        type: "order.picked_up",
        reservationCode: order.reservationCode,
        message: `${order.reservationCode} was marked as picked up with token ${order.pickupToken}.`,
        createdAt: nowIso(),
      });

      writeState(state);
      return order;
    },

    async getOrderStatus({ reservationCode, pickupToken }) {
      const state = readState();
      const order = pickupToken
        ? getOrderByPickupToken(state, pickupToken)
        : state.orders.find((item) => item.reservationCode === reservationCode);
      const code = reservationCode || order?.reservationCode;

      return {
        reservation: code ? getReservationByCode(state, code) : undefined,
        order,
      };
    },
  };
}

function createSupabaseApi() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function invoke(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke("store-agent", {
      body: { action, ...payload },
    });
    if (error) {
      throw error;
    }

    return data;
  }

  return {
    mode: "supabase",
    getSnapshot: () => invoke("snapshot"),
    getInventory: () => invoke("get_inventory"),
    listOrders: () => invoke("list_orders"),
    listReservations: () => invoke("list_reservations"),
    expireReservations: () => invoke("expire_reservations"),
    resetDemo: () => invoke("reset_demo"),
    createReservation: (payload) => invoke("create_reservation", payload),
    addItem: (payload) => invoke("add_item", payload),
    generatePaymentLink: (payload) => invoke("generate_payment_link", payload),
    confirmPayment: (payload) => invoke("confirm_payment", payload),
    markPaidMock: (payload) => invoke("mark_paid_mock", payload),
    cancelReservation: (payload) => invoke("cancel_reservation", payload),
    markPickedUp: (payload) => invoke("mark_picked_up", payload),
    getOrderStatus: (payload) => invoke("get_order_status", payload),
  };
}

export const storeApi =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createSupabaseApi() : createLocalApi();
