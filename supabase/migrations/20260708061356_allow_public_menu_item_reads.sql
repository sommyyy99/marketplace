alter table public.menu_items enable row level security;
alter table public.vendors enable row level security;

drop policy if exists "Anyone can read available menu items" on public.menu_items;
create policy "Anyone can read available menu items"
on public.menu_items
for select
to anon, authenticated
using (is_available is true);

drop policy if exists "Anyone can read vendors" on public.vendors;
create policy "Anyone can read vendors"
on public.vendors
for select
to anon, authenticated
using (true);
