-- 1. Vendors: hide payout columns from anon/authenticated via column-level grants
DROP POLICY IF EXISTS "Anyone can read vendors" ON public.vendors;

REVOKE ALL ON public.vendors FROM anon;
REVOKE ALL ON public.vendors FROM authenticated;

GRANT SELECT (
  id, name, description, category, logo_url, cover_image_url, street_address,
  latitude, longitude, opening_time, closing_time, is_open, is_active,
  delivery_fee, min_order_amount, avg_rating, review_count, created_at, service_category
) ON public.vendors TO anon;

GRANT SELECT (
  id, owner_id, name, description, category, logo_url, cover_image_url, street_address,
  latitude, longitude, opening_time, closing_time, is_open, is_active,
  delivery_fee, min_order_amount, avg_rating, review_count, created_at, service_category
) ON public.vendors TO authenticated;

GRANT INSERT (
  owner_id, name, description, category, logo_url, cover_image_url, street_address,
  latitude, longitude, opening_time, closing_time, is_open, is_active,
  delivery_fee, min_order_amount, service_category
) ON public.vendors TO authenticated;

GRANT UPDATE (
  name, description, category, logo_url, cover_image_url, street_address,
  latitude, longitude, opening_time, closing_time, is_open, is_active,
  delivery_fee, min_order_amount, service_category
) ON public.vendors TO authenticated;

GRANT ALL ON public.vendors TO service_role;

-- 2. Menu items: remove duplicated/overlapping policies
DROP POLICY IF EXISTS "Anyone can view available menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Vendors manage own menu items" ON public.menu_items;

-- 3. Reviews: keep ratings public but hide the customer identity
REVOKE ALL ON public.reviews FROM anon;
REVOKE ALL ON public.reviews FROM authenticated;
GRANT SELECT (id, order_id, vendor_id, rating, comment, created_at) ON public.reviews TO anon;
GRANT SELECT (id, order_id, customer_id, vendor_id, rating, comment, created_at) ON public.reviews TO authenticated;
GRANT INSERT (id, order_id, customer_id, vendor_id, rating, comment) ON public.reviews TO authenticated;
GRANT UPDATE (rating, comment) ON public.reviews TO authenticated;
GRANT DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT TO anon, authenticated USING (true);

-- 4. Addresses: let customers delete their own
DROP POLICY IF EXISTS addresses_delete_own ON public.addresses;
CREATE POLICY addresses_delete_own ON public.addresses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT DELETE ON public.addresses TO authenticated;