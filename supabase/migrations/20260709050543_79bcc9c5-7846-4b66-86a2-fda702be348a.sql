
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own order items"
  ON public.order_items FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid()));

CREATE POLICY "Vendors view their order items"
  ON public.order_items FOR SELECT
  USING (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.vendors v ON v.id = o.vendor_id
    WHERE v.owner_id = auth.uid()
  ));

CREATE POLICY "Customers create own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid()));
