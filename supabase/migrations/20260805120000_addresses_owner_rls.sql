-- Allow customers to read, insert, and update their own delivery addresses.
-- Safe to re-run: drops the policy first if it already exists.

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own"
  on public.addresses
  for select
  using (auth.uid() = user_id);

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own"
  on public.addresses
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own"
  on public.addresses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
