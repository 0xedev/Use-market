alter table public.crm_visitors
  add column if not exists assigned_to_user_id uuid
  references auth.users(id) on delete set null;

create index if not exists crm_visitors_assigned_workspace_idx
  on public.crm_visitors (workspace_id, assigned_to_user_id, last_seen_at desc);

create table if not exists public.crm_workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  role text not null check (role = any(array['admin','manager','agent','viewer']::text[])),
  token_hash text not null unique,
  status text not null default 'pending' check (status = any(array['pending','accepted','revoked']::text[])),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

create unique index if not exists crm_workspace_invites_pending_email_idx
  on public.crm_workspace_invites (workspace_id, email)
  where status = 'pending';

alter table public.crm_workspace_invites enable row level security;
revoke all on public.crm_workspace_invites from anon, authenticated;
grant select on public.crm_workspace_invites to authenticated;

drop policy if exists crm_workspace_invites_admin_read on public.crm_workspace_invites;
create policy crm_workspace_invites_admin_read
  on public.crm_workspace_invites
  for select to authenticated
  using (public.crm_has_workspace_role(workspace_id, array['owner','admin']::text[]));

create or replace function public.crm_workspace_team(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.crm_is_workspace_member(p_workspace_id) then
    raise exception 'Workspace access is required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'created_at', m.created_at,
        'full_name', p.full_name,
        'email', p.email
      ) order by case when m.role = 'owner' then 0 else 1 end, p.full_name, p.email)
      from public.crm_workspace_members as m
      left join public.crm_profiles as p on p.id = m.user_id
      where m.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'invites', case
      when public.crm_has_workspace_role(p_workspace_id, array['owner','admin']::text[]) then
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id,
            'email', i.email,
            'role', i.role,
            'status', i.status,
            'created_at', i.created_at,
            'expires_at', i.expires_at
          ) order by i.created_at desc)
          from public.crm_workspace_invites as i
          where i.workspace_id = p_workspace_id and i.status = 'pending'
        ), '[]'::jsonb)
      else '[]'::jsonb
    end
  ) into result;

  return result;
end
$function$;

create or replace function public.crm_assign_visitor(
  p_visitor_id uuid,
  p_assignee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public.crm_visitors;
  old_assignee uuid;
  new_assignee_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into v
  from public.crm_visitors
  where id = p_visitor_id
  for update;

  if not found then
    raise exception 'Lead was not found' using errcode = 'P0002';
  end if;

  if not public.crm_has_workspace_role(v.workspace_id, array['owner','admin','manager']::text[]) then
    raise exception 'Only an owner, admin or manager can assign leads' using errcode = '42501';
  end if;

  if p_assignee_id is not null then
    select m.role into new_assignee_role
    from public.crm_workspace_members as m
    where m.workspace_id = v.workspace_id and m.user_id = p_assignee_id;

    if new_assignee_role is null or new_assignee_role = 'viewer' then
      raise exception 'Choose a sales team member in this workspace' using errcode = '22023';
    end if;
  end if;

  old_assignee := v.assigned_to_user_id;
  update public.crm_visitors
  set assigned_to_user_id = p_assignee_id,
      updated_at = now()
  where id = p_visitor_id;

  insert into public.crm_activities (
    workspace_id, actor_user_id, entity_type, entity_id, action, payload
  ) values (
    v.workspace_id, auth.uid(), 'visitor', v.id, 'lead.assigned',
    jsonb_build_object('from_user_id', old_assignee, 'to_user_id', p_assignee_id)
  );

  return jsonb_build_object('ok', true, 'visitor_id', v.id, 'assigned_to_user_id', p_assignee_id);
end
$function$;

create or replace function public.crm_accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  invite public.crm_workspace_invites;
  account_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before you accept a team invite' using errcode = '28000';
  end if;

  select lower(u.email) into account_email
  from auth.users as u
  where u.id = auth.uid();

  if account_email is null then
    raise exception 'Your signed-in account does not have an email address' using errcode = '22023';
  end if;

  if p_token is null or length(p_token) < 32 then
    raise exception 'The invite link is not valid' using errcode = '22023';
  end if;

  select * into invite
  from public.crm_workspace_invites as i
  where i.token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
    and i.status = 'pending'
    and i.expires_at > now()
    and i.email = account_email
  for update;

  if not found then
    raise exception 'This invite is expired, already used, or was sent to another email' using errcode = 'P0002';
  end if;

  insert into public.crm_workspace_members (workspace_id, user_id, role)
  values (invite.workspace_id, auth.uid(), invite.role)
  on conflict (workspace_id, user_id) do update
    set role = case
      when public.crm_workspace_members.role = 'owner' then 'owner'
      else excluded.role
    end;

  update public.crm_workspace_invites
  set status = 'accepted', accepted_user_id = auth.uid(), accepted_at = now()
  where id = invite.id;

  return invite.workspace_id;
end
$function$;

create or replace function public.crm_save_lead_followup_message(
  p_workspace_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  if not public.crm_has_workspace_role(p_workspace_id, array['owner','admin','manager']::text[]) then
    raise exception 'You do not have permission to edit the follow-up message' using errcode = '42501';
  end if;

  if p_message is null or length(btrim(p_message)) < 10 or length(p_message) > 1200 then
    raise exception 'Enter a follow-up message between 10 and 1200 characters' using errcode = '22023';
  end if;

  update public.crm_workspaces
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('lead_followup_message', btrim(p_message)),
      updated_at = now()
  where id = p_workspace_id;

  return jsonb_build_object('ok', true);
end
$function$;

create or replace function public.crm_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_workspace uuid;
  v_role text;
begin
  insert into public.crm_profiles(id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  select m.workspace_id
    into v_workspace
  from public.crm_workspace_members as m
  where m.user_id = new.id
  order by case when m.role = 'owner' then 0 else 1 end, m.created_at
  limit 1;

  if v_workspace is not null then
    return new;
  end if;

  select i.workspace_id, i.role
    into v_workspace, v_role
  from public.crm_workspace_invites as i
  where lower(i.email) = lower(new.email)
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if v_workspace is not null then
    insert into public.crm_workspace_members(workspace_id, user_id, role)
    values (v_workspace, new.id, v_role)
    on conflict do nothing;
    return new;
  end if;

  select w.id
    into v_workspace
  from public.crm_workspaces as w
  where w.slug = 'legacy-usecrm'
    and w.owner_user_id is null
  for update;

  if v_workspace is not null then
    update public.crm_workspaces as w
       set owner_user_id = new.id,
           updated_at = now()
     where w.id = v_workspace;
  else
    insert into public.crm_workspaces(owner_user_id, name, slug)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'workspace'), '@', 1)) || '''s CRM',
      'crm-' || replace(new.id::text, '-', '')
    )
    on conflict (slug) do update
      set updated_at = public.crm_workspaces.updated_at
    returning id into v_workspace;
  end if;

  insert into public.crm_workspace_members(workspace_id, user_id, role)
  values (v_workspace, new.id, 'owner')
  on conflict do nothing;

  return new;
end
$function$;

revoke all on function public.crm_workspace_team(uuid) from public, anon;
revoke all on function public.crm_assign_visitor(uuid, uuid) from public, anon;
revoke all on function public.crm_accept_workspace_invite(text) from public, anon;
revoke all on function public.crm_save_lead_followup_message(uuid, text) from public, anon;
grant execute on function public.crm_workspace_team(uuid) to authenticated;
grant execute on function public.crm_assign_visitor(uuid, uuid) to authenticated;
grant execute on function public.crm_accept_workspace_invite(text) to authenticated;
grant execute on function public.crm_save_lead_followup_message(uuid, text) to authenticated;

update public.crm_workspaces
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'lead_followup_message',
  'Hi, this is Ibukun from Caressence. The Mini Stepper is ₦95,000, with free delivery nationwide. I’m here to help you complete your order. Would you like to go ahead?'
), updated_at = now()
where slug = 'caressence';
