begin;

grant update (assigned_to) on public.customers to authenticated;

commit;
