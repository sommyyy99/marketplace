# Health check: what could break Sommygo, and the fixes

I checked the app's code, the database rules, the payment flow and the security scan. The preview loads fine now. Below is what I found, worst first.

## 1. Vendors' bank details are readable by anyone (serious)

Anyone visiting the site can read every store's account name, account number, bank code and payout code, because store rows are fully public.

Fix: keep normal store info public (name, rating, logo, category, fees, hours), and make the four payout fields readable only by the store's own owner and by the payment services. The vendor dashboard would read them through that owner-only path, so the payout screen keeps working exactly as it does today.

## 2. Payments are still on the Paystack test key

The checkout popup uses a test key, so no real money can ever be collected. Nothing to change until you're ready to go live — then the live key replaces it and I switch the payment services to the live secret.

## 3. The payment and payout services exist online but their code isn't in the project

Checkout, payment verification and vendor payout setup all run through three online services (create order, verify payment, vendor payout setup). They respond, so checkout works — but their code is not stored in the project anymore, so they can't be reviewed, fixed or safely re-deployed. If they are ever redeployed from the project, they would disappear and checkout would break.

Fix: rebuild the three services in the project from the behaviour the app expects (server-side price lookup, one order per store under one checkout group, Paystack verification with the secret key, payout account setup), so what runs matches what's saved.

## 4. Reviews reveal which customer wrote them

Review rows are public and include the customer's account id. Fix: stop exposing the customer id publicly while still showing ratings and comments.

## 5. Delivery fee and service fee are calculated twice

The basket total shown on screen is worked out in the app, while the amount actually charged is worked out by the order service. If the two ever differ, a customer sees one price and is charged another. Fix: show the amount the order service returns, so the screen and the charge always match.

## 6. Smaller cleanups

- Duplicate and overlapping database rules on stores, menu items and orders (e.g. two "anyone can read" rules on stores) — harmless today, but they make it easy to reintroduce a leak. Consolidate them.
- Customers can add and edit delivery addresses but never delete one. Add a delete rule and a remove button.
- Leaked-password protection is off in your login settings, so people can sign up with passwords known to be in public breaches. Turning it on is a setting in the Supabase dashboard; I can point you to it.
- The vendor media storage bucket is fully public. Fine for product photos — just don't put anything private in it.
- Duplicate image files in the project (several copies of the same food photos) add weight to the app. Remove the unused copies.

## Technical notes

- `vendors` currently has both `Anyone can read vendors (true)` and `Anyone can view active vendors (is_active = true)`; payout columns leak through the first. Plan: replace public row access with a restricted set of columns plus an owner-only `my_payout_account()` security-definer function; keep `service_role` access for the payment functions.
- `orders`/`order_items` deny client INSERT by design — all order creation stays server-side in `create-order`.
- Recreate `supabase/functions/create-order`, `verify-payment`, `vendor-payout-setup` matching the contracts in `src/App.tsx` (`checkoutGroupId`, `orders[]`, `amountKobo`, `email`, `splitCode`) and `src/components/VendorDashboard.tsx`.
- Totals: use `amountKobo`/`total` from `create-order` as the single source of truth in the basket UI.

## Order of work

1. Lock down payout fields (item 1).
2. Restore the three service files in the project (item 3).
3. Reviews privacy, totals consistency, address delete, rule cleanup (items 4-6).
