-- Ensures a logged-in customer can read their own orders and the line items
-- on those orders, needed for the customer-facing "My Orders" page. Safe to
-- re-run even if equivalent policies already exist under different names.

GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers view own order items" ON public.order_items;
CREATE POLICY "Customers view own order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
  );
