# Cisco Live Store Supabase Setup

The React demo works immediately with localStorage. To share inventory, reservations,
and orders across devices, connect it to Supabase.

## Environment

Copy `.env.example` to `.env` and set:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_STORE_STAFF_PIN=2468
VITE_PAYMENT_BASE_URL=https://paqui04.github.io/
```

For the Edge Function, set:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
PAYMENT_BASE_URL=https://paqui04.github.io/
RESERVATION_MINUTES=30
```

## Deploy

```bash
supabase db push
supabase functions deploy store-agent
```

## Webex Agent Actions

Call the `store-agent` Edge Function with a JSON body:

```json
{ "action": "create_reservation", "visitor": {}, "items": [], "source": "webex-agent" }
```

Supported actions:

- `snapshot`
- `get_inventory`
- `create_reservation`
- `add_item`
- `generate_payment_link`
- `confirm_payment`
- `mark_paid_mock` (compatibility alias for `confirm_payment`)
- `get_order_status`
- `mark_picked_up`
- `cancel_reservation`
- `expire_reservations`
- `list_orders`
- `list_reservations`
- `reset_demo`

`confirm_payment` generates a short `pickupToken`, for example `PK-8F42K`.
Customers present that token at the counter; staff can call `mark_picked_up`
with either `{ "pickupToken": "PK-8F42K" }` or a fallback
`{ "reservationCode": "CLSTORE-1234" }`.
