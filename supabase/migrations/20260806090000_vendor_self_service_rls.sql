-- Lets any authenticated user register as a vendor, and lets vendors manage
-- their own vendor row and menu items. Safe to re-run.

GRANT SELECT, INSERT, UPDATE ON public.vendors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

-- Vendors: an authenticated user can create their own vendor row, and manage
-- (view/update) any vendor row they own.
DROP POLICY IF EXISTS "Users create own vendor row" ON public.vendors;
CREATE POLICY "Users create own vendor row"
  ON public.vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Vendors update own vendor row" ON public.vendors;
CREATE POLICY "Vendors update own vendor row"
  ON public.vendors
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Menu items: vendors manage items that belong to a vendor row they own.
DROP POLICY IF EXISTS "Vendors view own menu items" ON public.menu_items;
CREATE POLICY "Vendors view own menu items"
  ON public.menu_items
  FOR SELECT
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Vendors insert own menu items" ON public.menu_items;
CREATE POLICY "Vendors insert own menu items"
  ON public.menu_items
  FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Vendors update own menu items" ON public.menu_items;
CREATE POLICY "Vendors update own menu items"
  ON public.menu_items
  FOR UPDATE
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()))
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Vendors delete own menu items" ON public.menu_items;
CREATE POLICY "Vendors delete own menu items"
  ON public.menu_items
  FOR DELETE
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));

-- Menu categories: same ownership pattern (kept minimal, categories are optional).
DROP POLICY IF EXISTS "Anyone can read menu categories" ON public.menu_categories;
CREATE POLICY "Anyone can read menu categories"
  ON public.menu_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Vendors manage own menu categories" ON public.menu_categories;
CREATE POLICY "Vendors manage own menu categories"
  ON public.menu_categories
  FOR ALL
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()))
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));

-- Profiles: a user may update their own profile row (needed so "become a
-- vendor" can set role = 'vendor' on their own account, and nothing else).
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
