
-- Allow vendors to update orders belonging to their vendor record
CREATE POLICY "Vendors update their orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()))
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));

-- Allow vendors to view profiles of customers who ordered from them (for dashboard display)
CREATE POLICY "Vendors view customer profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT o.customer_id
      FROM public.orders o
      JOIN public.vendors v ON v.id = o.vendor_id
      WHERE v.owner_id = auth.uid()
    )
  );
