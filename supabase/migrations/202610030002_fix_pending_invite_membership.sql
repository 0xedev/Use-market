create or replace function public.crm_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_workspace uuid;
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

  select i.workspace_id
    into v_workspace
  from public.crm_workspace_invites as i
  where lower(i.email) = lower(new.email)
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if v_workspace is not null then
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
