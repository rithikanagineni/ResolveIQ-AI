begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'customer'
    check (role in ('admin', 'salesperson', 'customer')),
  salesperson_request boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists salesperson_request boolean not null default false;

alter table public.customers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists customers_assigned_to_idx
  on public.customers (assigned_to);
create unique index if not exists customers_auth_user_id_idx
  on public.customers (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_reference text,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),
  purchased_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists purchases_customer_date_idx
  on public.purchases (customer_id, purchased_at desc);

insert into public.profiles (user_id, email, full_name)
select
  users.id,
  coalesce(users.email, ''),
  nullif(users.raw_user_meta_data ->> 'full_name', '')
from auth.users as users
on conflict (user_id) do nothing;

update public.profiles as profiles
set role = users.raw_user_meta_data ->> 'requested_role',
    salesperson_request = false
from auth.users as users
where profiles.user_id = users.id
  and (
    users.raw_user_meta_data ->> 'requested_role' = 'admin'
    or (
      users.raw_user_meta_data ->> 'requested_role' = 'salesperson'
      and profiles.salesperson_request
    )
  );

update public.profiles
set salesperson_request = false
where salesperson_request;

update public.customers as customers
set auth_user_id = null
from public.profiles as profiles
where customers.auth_user_id = profiles.user_id
  and profiles.role <> 'customer';

with customer_matches as (
  select distinct on (lower(customers.email))
    customers.id as customer_id,
    users.id as user_id
  from public.customers as customers
  join auth.users as users on lower(users.email) = lower(customers.email)
  join public.profiles as profiles on profiles.user_id = users.id
  where customers.email is not null
    and customers.auth_user_id is null
    and profiles.role = 'customer'
  order by lower(customers.email), customers.created_at nulls last, customers.id
)
update public.customers as customers
set auth_user_id = matches.user_id
from customer_matches as matches
where customers.id = matches.customer_id;

insert into public.customers (name, email, created_by, auth_user_id)
select
  coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), users.email, 'Customer'),
  users.email,
  users.id,
  users.id
from auth.users as users
join public.profiles as profiles on profiles.user_id = users.id
  and profiles.role = 'customer'
where not exists (
  select 1
  from public.customers as customers
  where customers.auth_user_id = users.id
)
on conflict do nothing;

create or replace function public.handle_new_resolveiq_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_customer_id uuid;
  requested_role text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'requested_role' in ('admin', 'salesperson', 'customer')
      then new.raw_user_meta_data ->> 'requested_role'
    else 'customer'
  end;

  insert into public.profiles (user_id, email, full_name, role, salesperson_request)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    requested_role,
    false
  )
  on conflict (user_id) do nothing;

  if requested_role = 'customer' and new.email is not null then
    select customers.id
      into linked_customer_id
    from public.customers as customers
    where lower(customers.email) = lower(new.email)
      and customers.auth_user_id is null
    order by customers.created_at nulls last, customers.id
    limit 1;
  end if;

  if requested_role <> 'customer' then
    return new;
  elsif linked_customer_id is not null then
    update public.customers
      set auth_user_id = new.id
    where id = linked_customer_id;
  else
    insert into public.customers (name, email, created_by, auth_user_id)
    values (
      coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'Customer'),
      new.email,
      new.id,
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists resolveiq_user_created on auth.users;
create trigger resolveiq_user_created
  after insert on auth.users
  for each row execute function public.handle_new_resolveiq_user();

create or replace function public.current_resolveiq_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role
  from public.profiles
  where profiles.user_id = auth.uid()
$$;

create or replace function public.can_access_resolveiq_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.current_resolveiq_role() = 'admin'
    or exists (
      select 1
      from public.customers
      where customers.id = target_customer_id
        and (
          customers.auth_user_id = auth.uid()
          or (
            public.current_resolveiq_role() = 'salesperson'
            and customers.assigned_to = auth.uid()
          )
        )
    )
$$;

create or replace function public.assign_resolveiq_salesperson(
  target_customer_id uuid,
  target_salesperson_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_resolveiq_role() is distinct from 'admin' then
    raise exception 'Only an admin can assign customers.';
  end if;

  if target_salesperson_id is not null and not exists (
    select 1
    from public.profiles
    where user_id = target_salesperson_id
      and role = 'salesperson'
  ) then
    raise exception 'Choose an account with the salesperson role.';
  end if;

  update public.customers
  set assigned_to = target_salesperson_id
  where id = target_customer_id;

  if not found then
    raise exception 'Customer not found.';
  end if;
end;
$$;

create or replace function public.set_resolveiq_user_role(
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_resolveiq_role() is distinct from 'admin' then
    raise exception 'Only an admin can manage team roles.';
  end if;

  if target_role not in ('admin', 'salesperson', 'customer') then
    raise exception 'Choose admin, salesperson, or customer.';
  end if;

  update public.profiles
  set role = target_role,
      salesperson_request = false
  where user_id = target_user_id;

  if not found then
    raise exception 'User profile not found.';
  end if;

  if target_role = 'admin' or target_role = 'salesperson' then
    update public.customers
    set auth_user_id = null
    where auth_user_id = target_user_id;
  else
    update public.customers
    set assigned_to = null
    where assigned_to = target_user_id;

    update public.conversations
    set assigned_to = null
    where assigned_to = target_user_id;

    update public.customers
    set auth_user_id = target_user_id
    where id = (
      select customers.id
      from public.customers
      join public.profiles on lower(profiles.email) = lower(customers.email)
      where profiles.user_id = target_user_id
        and customers.auth_user_id is null
      order by customers.created_at nulls last, customers.id
      limit 1
    );
  end if;
end;
$$;

create or replace function public.update_resolveiq_profile(target_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := nullif(trim(target_full_name), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to update your profile.';
  end if;

  if normalized_name is null then
    raise exception 'Your name cannot be empty.';
  end if;

  update public.profiles
  set full_name = normalized_name
  where user_id = auth.uid();

  if not found then
    raise exception 'User profile not found.';
  end if;

  if public.current_resolveiq_role() = 'customer' then
    update public.customers
    set name = normalized_name
    where auth_user_id = auth.uid();
  end if;
end;
$$;

create or replace function public.create_resolveiq_customer_conversation(
  target_subject text,
  target_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_customer_id uuid;
  linked_salesperson_id uuid;
  created_conversation_id uuid;
begin
  if public.current_resolveiq_role() <> 'customer' then
    raise exception 'Only a customer can start a customer-portal conversation.';
  end if;

  if nullif(trim(target_subject), '') is null or nullif(trim(target_body), '') is null then
    raise exception 'A subject and message are required.';
  end if;

  select customers.id, customers.assigned_to
    into linked_customer_id, linked_salesperson_id
  from public.customers
  where customers.auth_user_id = auth.uid()
  limit 1;

  if linked_customer_id is null then
    raise exception 'No customer record is linked to this account.';
  end if;

  insert into public.conversations (
    customer_id, subject, channel, status, priority, assigned_to
  )
  values (
    linked_customer_id, trim(target_subject), 'website', 'open', 'normal',
    linked_salesperson_id
  )
  returning id into created_conversation_id;

  insert into public.messages (
    conversation_id, sender_type, sender_id, body, is_internal_note
  )
  values (
    created_conversation_id, 'customer', auth.uid(), trim(target_body), false
  );

  update public.conversations
  set last_message_at = now(), updated_at = now()
  where id = created_conversation_id;

  return created_conversation_id;
end;
$$;

create or replace function public.reply_resolveiq_customer_conversation(
  target_conversation_id uuid,
  target_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_customer_id uuid;
begin
  if public.current_resolveiq_role() <> 'customer' then
    raise exception 'Only a customer can reply from the customer portal.';
  end if;

  if nullif(trim(target_body), '') is null then
    raise exception 'A message is required.';
  end if;

  select customers.id
    into linked_customer_id
  from public.customers
  where customers.auth_user_id = auth.uid()
  limit 1;

  if linked_customer_id is null or not exists (
    select 1
    from public.conversations
    where conversations.id = target_conversation_id
      and conversations.customer_id = linked_customer_id
  ) then
    raise exception 'Conversation not found.';
  end if;

  insert into public.messages (
    conversation_id, sender_type, sender_id, body, is_internal_note
  )
  values (
    target_conversation_id, 'customer', auth.uid(), trim(target_body), false
  );

  update public.conversations
  set last_message_at = now(), updated_at = now()
  where id = target_conversation_id;
end;
$$;

revoke all on function public.handle_new_resolveiq_user() from public, anon, authenticated;
revoke all on function public.current_resolveiq_role() from public, anon;
revoke all on function public.can_access_resolveiq_customer(uuid) from public, anon;
revoke all on function public.assign_resolveiq_salesperson(uuid, uuid) from public, anon;
revoke all on function public.set_resolveiq_user_role(uuid, text) from public, anon;
revoke all on function public.update_resolveiq_profile(text) from public, anon;
revoke all on function public.create_resolveiq_customer_conversation(text, text) from public, anon;
revoke all on function public.reply_resolveiq_customer_conversation(uuid, text) from public, anon;
grant execute on function public.current_resolveiq_role() to authenticated;
grant execute on function public.can_access_resolveiq_customer(uuid) to authenticated;
grant execute on function public.assign_resolveiq_salesperson(uuid, uuid) to authenticated;
grant execute on function public.set_resolveiq_user_role(uuid, text) to authenticated;
grant execute on function public.update_resolveiq_profile(text) to authenticated;
grant execute on function public.create_resolveiq_customer_conversation(text, text) to authenticated;
grant execute on function public.reply_resolveiq_customer_conversation(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.purchases enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'customers', 'conversations', 'messages', 'purchases')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

create policy "profiles_select_self_or_admin"
  on public.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'customer'
      and exists (
        select 1
        from public.customers
        where customers.auth_user_id = auth.uid()
          and customers.assigned_to = profiles.user_id
      )
    )
  );

revoke insert, update, delete on public.profiles from anon, authenticated;

create policy "customers_select_assigned_or_owned"
  on public.customers for select to authenticated
  using (public.can_access_resolveiq_customer(id));

create policy "customers_insert_staff"
  on public.customers for insert to authenticated
  with check (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and created_by = auth.uid()
      and assigned_to = auth.uid()
    )
  );

create policy "customers_update_staff"
  on public.customers for update to authenticated
  using (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and assigned_to = auth.uid()
    )
  )
  with check (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and assigned_to = auth.uid()
    )
  );

revoke insert, update on public.customers from anon, authenticated;
grant insert (name, email, phone, company, notes, created_by, assigned_to)
  on public.customers to authenticated;
grant update (name, email, phone, company, notes, assigned_to) on public.customers to authenticated;

create policy "conversations_select_by_customer_access"
  on public.conversations for select to authenticated
  using (public.can_access_resolveiq_customer(customer_id));

create policy "conversations_insert_staff_or_owner"
  on public.conversations for insert to authenticated
  with check (
    public.can_access_resolveiq_customer(customer_id)
    and (
      (
        public.current_resolveiq_role() in ('admin', 'salesperson')
        and (public.current_resolveiq_role() = 'admin' or assigned_to = auth.uid())
      )
    )
  );

create policy "conversations_update_staff"
  on public.conversations for update to authenticated
  using (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and public.can_access_resolveiq_customer(customer_id)
    )
  )
  with check (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and public.can_access_resolveiq_customer(customer_id)
    )
  );

create policy "messages_select_by_customer_access"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = conversation_id
        and public.can_access_resolveiq_customer(conversations.customer_id)
        and (
          public.current_resolveiq_role() in ('admin', 'salesperson')
          or coalesce(is_internal_note, false) = false
        )
    )
  );

create policy "messages_insert_by_conversation_participant"
  on public.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations
      join public.customers on customers.id = conversations.customer_id
      where conversations.id = conversation_id
        and (
          (
            sender_type = 'agent'
            and sender_id = auth.uid()
            and public.current_resolveiq_role() in ('admin', 'salesperson')
            and public.can_access_resolveiq_customer(conversations.customer_id)
          )
          or (
            sender_type = 'customer'
            and sender_id = auth.uid()
            and customers.auth_user_id = auth.uid()
            and coalesce(is_internal_note, false) = false
          )
        )
    )
  );

create policy "purchases_select_by_customer_access"
  on public.purchases for select to authenticated
  using (public.can_access_resolveiq_customer(customer_id));

create policy "purchases_insert_staff"
  on public.purchases for insert to authenticated
  with check (
    public.current_resolveiq_role() in ('admin', 'salesperson')
    and public.can_access_resolveiq_customer(customer_id)
    and created_by = auth.uid()
  );

create policy "purchases_update_staff"
  on public.purchases for update to authenticated
  using (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and public.can_access_resolveiq_customer(customer_id)
    )
  )
  with check (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and public.can_access_resolveiq_customer(customer_id)
    )
  );

grant select on public.profiles, public.customers, public.conversations, public.messages, public.purchases to authenticated;
grant insert on public.conversations, public.messages, public.purchases to authenticated;
grant update on public.conversations, public.messages, public.purchases to authenticated;

commit;
