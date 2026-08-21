-- Lets any authenticated user register as a rider, browse unclaimed
-- deliveries, claim one, and mark it delivered. Safe to re-run.

GRANT SELECT, INSERT, UPDATE ON public.riders TO authenticated;

-- Riders: a user can create their own rider row, and manage it.
DROP POLICY IF EXISTS "Users create own rider row" ON public.riders;
CREATE POLICY "Users create own rider row"
  ON public.riders
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Riders view own rider row" ON public.riders;
CREATE POLICY "Riders view own rider row"
  ON public.riders
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Riders update own rider row" ON public.riders;
CREATE POLICY "Riders update own rider row"
  ON public.riders
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Orders: riders can see orders that are out for delivery (either
-- unclaimed, to browse and claim, or already claimed by them), and can
-- update an order to claim it or mark it delivered.
DROP POLICY IF EXISTS "Riders view claimable or own deliveries" ON public.orders;
CREATE POLICY "Riders view claimable or own deliveries"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    status = 'out_for_delivery'
    AND (
      rider_id IS NULL
      OR rider_id IN (SELECT id FROM public.riders WHERE profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Riders claim or update their deliveries" ON public.orders;
CREATE POLICY "Riders claim or update their deliveries"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    status = 'out_for_delivery'
    AND (
      rider_id IS NULL
      OR rider_id IN (SELECT id FROM public.riders WHERE profile_id = auth.uid())
    )
  )
  WITH CHECK (
    rider_id IN (SELECT id FROM public.riders WHERE profile_id = auth.uid())
  );

-- Lets a customer see the profile of the rider assigned to their own
-- order, so the order history page can show who's delivering.
DROP POLICY IF EXISTS "Customers view assigned rider profile" ON public.profiles;
CREATE POLICY "Customers view assigned rider profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT r.profile_id
      FROM public.riders r
      JOIN public.orders o ON o.rider_id = r.id
      WHERE o.customer_id = auth.uid()
    )
  );

-- Lets a customer read basic rider info (vehicle type) for their own order.
DROP POLICY IF EXISTS "Customers view assigned rider row" ON public.riders;
CREATE POLICY "Customers view assigned rider row"
  ON public.riders
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT rider_id FROM public.orders WHERE customer_id = auth.uid() AND rider_id IS NOT NULL)
  );
