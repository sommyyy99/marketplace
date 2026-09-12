# Final go-live steps for Sommygo

The app is working and the earlier security problems are fixed. These are the last things standing between you and real customers.

## 1. Switch Paystack from test to live
- The app still uses a Paystack **test** key — no real money moves yet.
- Replace the test public key in the checkout with your live public key (`pk_live_...`), and set the matching live secret key for the payment functions.

## 2. Turn on leaked-password protection (you do this)
- Supabase login settings currently allow passwords known to be breached.
- It's a one-click toggle in the Supabase dashboard (Authentication → Password security). I can't change it from here, but I'll link you to the page.

## 3. Decide what happens to unpaid orders
- Today, if someone closes the payment popup, their order stays saved as "unpaid" forever.
- Options: leave as-is, auto-delete unpaid orders after a set time, or hide them from the vendor dashboard until paid.

## 4. Small cleanup (optional, low risk)
- Three internal database helpers are callable by any signed-in user. They're needed by your security rules and don't expose data, so this is a tidy-up, not a threat.

## Technical notes
- Step 1 touches `src/App.tsx` (public key) and the `PAYSTACK_SECRET_KEY` secret used by `create-order` / `verify-payment` / `vendor-payout-setup` — all three are deployed and responding correctly.
- Step 3 would be a scheduled cleanup (pg_cron) or an RLS/status filter in `VendorDashboard.tsx`, depending on the option picked.
