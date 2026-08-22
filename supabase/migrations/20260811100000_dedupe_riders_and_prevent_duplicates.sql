-- Fixes an RLS failure on marking deliveries as delivered, caused by a user
-- ending up with more than one row in `riders` (possible while an earlier
-- bug kept resetting their role, causing "Become a rider" to be clickable
-- more than once). With two rows for the same profile, the helper function
-- that finds "your rider row" could inconsistently pick either one,
-- breaking the ownership check used to update an order.
--
-- This migration: reassigns any orders pointing at a duplicate rider row
-- to the original (earliest) row, deletes the duplicates, then adds a
-- uniqueness guarantee so this can't happen again.

WITH ranked AS (
  SELECT
    id,
    profile_id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.riders
  WHERE profile_id IS NOT NULL
),
keep_map AS (
  SELECT dup.id AS duplicate_id, keep.id AS keep_id
  FROM ranked dup
  JOIN ranked keep ON keep.profile_id = dup.profile_id AND keep.rn = 1
  WHERE dup.rn > 1
)
UPDATE public.orders o
SET rider_id = keep_map.keep_id
FROM keep_map
WHERE o.rider_id = keep_map.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    profile_id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.riders
  WHERE profile_id IS NOT NULL
)
DELETE FROM public.riders
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE public.riders
  DROP CONSTRAINT IF EXISTS riders_profile_id_unique;

ALTER TABLE public.riders
  ADD CONSTRAINT riders_profile_id_unique UNIQUE (profile_id);
