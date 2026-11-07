begin;

create table if not exists public.resolveiq_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  assigned_to uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resolveiq_tasks_assignee_status_due_idx
  on public.resolveiq_tasks (assigned_to, status, due_at);
create index if not exists resolveiq_tasks_customer_idx
  on public.resolveiq_tasks (customer_id, created_at desc);

create table if not exists public.resolveiq_activity (
  id bigint generated always as identity primary key,
  customer_id uuid references public.customers(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists resolveiq_activity_created_idx
  on public.resolveiq_activity (created_at desc);
create index if not exists resolveiq_activity_customer_idx
  on public.resolveiq_activity (customer_id, created_at desc);

create table if not exists public.resolveiq_customer_notifications (
  id bigint generated always as identity primary key,
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  event_type text not null check (event_type in ('reply', 'status')),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists resolveiq_customer_notifications_unread_idx
  on public.resolveiq_customer_notifications (customer_user_id, created_at desc)
  where read_at is null;

create table if not exists public.resolveiq_workspace_settings (
  setting_key text primary key,
  setting_value text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.record_resolveiq_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_customer_id uuid;
  activity_type text;
  activity_summary text;
begin
  if tg_table_name = 'resolveiq_tasks' then
    linked_customer_id := new.customer_id;
    if tg_op = 'INSERT' then
      activity_type := 'task_created';
      activity_summary := 'Task created: ' || new.title;
    elsif new.status is distinct from old.status then
      activity_type := 'task_' || new.status;
      activity_summary := 'Task "' || new.title || '" marked ' || replace(new.status, '_', ' ');
    else
      activity_type := 'task_updated';
      activity_summary := 'Task updated: ' || new.title;
    end if;
  elsif tg_table_name = 'conversations' then
    linked_customer_id := new.customer_id;
    if tg_op = 'INSERT' then
      activity_type := 'conversation_created';
      activity_summary := 'Conversation created: ' || new.subject;
    elsif new.status is distinct from old.status then
      activity_type := 'conversation_status';
      activity_summary := 'Conversation "' || new.subject || '" marked ' || new.status;
    else
      return new;
    end if;
  elsif tg_table_name = 'messages' then
    if coalesce(new.is_internal_note, false) then
      return new;
    end if;
    select conversations.customer_id
      into linked_customer_id
    from public.conversations
    where conversations.id = new.conversation_id;
    activity_type := 'message_sent';
    activity_summary := case when new.sender_type = 'customer'
      then 'Customer sent a message'
      else 'Support replied to a customer'
    end;
  elsif tg_table_name = 'customers' then
    if tg_op <> 'UPDATE' or new.assigned_to is not distinct from old.assigned_to then
      return new;
    end if;
    linked_customer_id := new.id;
    activity_type := 'salesperson_assigned';
    activity_summary := case when new.assigned_to is null
      then 'Salesperson removed from ' || new.name
      else 'Salesperson assigned to ' || new.name
    end;
  elsif tg_table_name = 'purchases' then
    linked_customer_id := new.customer_id;
    activity_type := 'purchase_recorded';
    activity_summary := 'Purchase recorded: ' || new.product_name;
  else
    return new;
  end if;

  insert into public.resolveiq_activity (customer_id, actor_id, event_type, summary)
  values (linked_customer_id, auth.uid(), activity_type, activity_summary);
  return new;
end;
$$;

create or replace function public.notify_resolveiq_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_customer_user_id uuid;
  conversation_subject text;
begin
  if tg_table_name = 'messages' then
    if new.sender_type <> 'agent' or coalesce(new.is_internal_note, false) then
      return new;
    end if;

    select customers.auth_user_id, conversations.subject
      into linked_customer_user_id, conversation_subject
    from public.conversations
    join public.customers on customers.id = conversations.customer_id
    where conversations.id = new.conversation_id;

    if linked_customer_user_id is not null then
      insert into public.resolveiq_customer_notifications (
        customer_user_id, conversation_id, event_type, message
      )
      values (
        linked_customer_user_id,
        new.conversation_id,
        'reply',
        'New reply in "' || conversation_subject || '": ' || left(new.body, 180)
      );
    end if;
    return new;
  end if;

  if tg_table_name = 'conversations'
    and tg_op = 'UPDATE'
    and new.status is distinct from old.status
  then
    select customers.auth_user_id
      into linked_customer_user_id
    from public.customers
    where customers.id = new.customer_id;

    if linked_customer_user_id is not null then
      insert into public.resolveiq_customer_notifications (
        customer_user_id, conversation_id, event_type, message
      )
      values (
        linked_customer_user_id,
        new.id,
        'status',
        'Your request "' || new.subject || '" is now ' || replace(new.status, '_', ' ') || '.'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists resolveiq_activity_task on public.resolveiq_tasks;
create trigger resolveiq_activity_task
  after insert or update on public.resolveiq_tasks
  for each row execute function public.record_resolveiq_activity();

drop trigger if exists resolveiq_activity_conversation on public.conversations;
create trigger resolveiq_activity_conversation
  after insert or update on public.conversations
  for each row execute function public.record_resolveiq_activity();

drop trigger if exists resolveiq_activity_message on public.messages;
create trigger resolveiq_activity_message
  after insert on public.messages
  for each row execute function public.record_resolveiq_activity();

drop trigger if exists resolveiq_activity_assignment on public.customers;
create trigger resolveiq_activity_assignment
  after update of assigned_to on public.customers
  for each row execute function public.record_resolveiq_activity();

drop trigger if exists resolveiq_activity_purchase on public.purchases;
create trigger resolveiq_activity_purchase
  after insert on public.purchases
  for each row execute function public.record_resolveiq_activity();

drop trigger if exists resolveiq_notify_customer_reply on public.messages;
create trigger resolveiq_notify_customer_reply
  after insert on public.messages
  for each row execute function public.notify_resolveiq_customer();

drop trigger if exists resolveiq_notify_customer_status on public.conversations;
create trigger resolveiq_notify_customer_status
  after update of status on public.conversations
  for each row execute function public.notify_resolveiq_customer();

create or replace function public.update_resolveiq_team_profile(
  target_user_id uuid,
  target_full_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := nullif(trim(target_full_name), '');
begin
  if public.current_resolveiq_role() is distinct from 'admin' then
    raise exception 'Only admins can edit team profiles.';
  end if;
  if normalized_name is null then
    raise exception 'A team member name is required.';
  end if;
  update public.profiles
  set full_name = normalized_name
  where user_id = target_user_id
    and role = 'salesperson';
  if not found then
    raise exception 'Salesperson account not found.';
  end if;
end;
$$;

alter table public.resolveiq_tasks enable row level security;
alter table public.resolveiq_activity enable row level security;
alter table public.resolveiq_customer_notifications enable row level security;
alter table public.resolveiq_workspace_settings enable row level security;

create policy "resolveiq_tasks_read_accessible"
  on public.resolveiq_tasks for select to authenticated
  using (public.can_access_resolveiq_customer(customer_id));
create policy "resolveiq_tasks_insert_staff"
  on public.resolveiq_tasks for insert to authenticated
  with check (
    public.can_access_resolveiq_customer(customer_id)
    and (
      (
        public.current_resolveiq_role() = 'admin'
        and exists (
          select 1 from public.profiles
          where profiles.user_id = assigned_to
            and profiles.role = 'salesperson'
        )
      )
      or (
        public.current_resolveiq_role() = 'salesperson'
        and assigned_to = auth.uid()
        and created_by = auth.uid()
      )
    )
  );
create policy "resolveiq_tasks_update_staff"
  on public.resolveiq_tasks for update to authenticated
  using (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and assigned_to = auth.uid()
      and public.can_access_resolveiq_customer(customer_id)
    )
  )
  with check (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and assigned_to = auth.uid()
      and public.can_access_resolveiq_customer(customer_id)
    )
  );
create policy "resolveiq_tasks_delete_admin"
  on public.resolveiq_tasks for delete to authenticated
  using (public.current_resolveiq_role() = 'admin');

create policy "resolveiq_activity_read_accessible"
  on public.resolveiq_activity for select to authenticated
  using (
    public.current_resolveiq_role() = 'admin'
    or (
      public.current_resolveiq_role() = 'salesperson'
      and customer_id is not null
      and public.can_access_resolveiq_customer(customer_id)
    )
  );

create policy "resolveiq_customer_notifications_read_self"
  on public.resolveiq_customer_notifications for select to authenticated
  using (customer_user_id = auth.uid());
create policy "resolveiq_customer_notifications_update_self"
  on public.resolveiq_customer_notifications for update to authenticated
  using (customer_user_id = auth.uid())
  with check (customer_user_id = auth.uid());

create policy "resolveiq_workspace_settings_admin_read"
  on public.resolveiq_workspace_settings for select to authenticated
  using (public.current_resolveiq_role() = 'admin');
create policy "resolveiq_workspace_settings_admin_insert"
  on public.resolveiq_workspace_settings for insert to authenticated
  with check (public.current_resolveiq_role() = 'admin');
create policy "resolveiq_workspace_settings_admin_update"
  on public.resolveiq_workspace_settings for update to authenticated
  using (public.current_resolveiq_role() = 'admin')
  with check (public.current_resolveiq_role() = 'admin');

revoke all on public.resolveiq_tasks, public.resolveiq_activity,
  public.resolveiq_customer_notifications, public.resolveiq_workspace_settings
  from anon, authenticated;
grant select, insert, update, delete on public.resolveiq_tasks to authenticated;
grant select on public.resolveiq_activity to authenticated;
grant select on public.resolveiq_customer_notifications to authenticated;
grant update (read_at) on public.resolveiq_customer_notifications to authenticated;
grant select, insert, update on public.resolveiq_workspace_settings to authenticated;
grant usage, select on sequence public.resolveiq_activity_id_seq,
  public.resolveiq_customer_notifications_id_seq to authenticated;

revoke all on function public.record_resolveiq_activity() from public, anon, authenticated;
revoke all on function public.notify_resolveiq_customer() from public, anon, authenticated;
revoke all on function public.update_resolveiq_team_profile(uuid, text) from public, anon;
grant execute on function public.update_resolveiq_team_profile(uuid, text) to authenticated;

commit;
