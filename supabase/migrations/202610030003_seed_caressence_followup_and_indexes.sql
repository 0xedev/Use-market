create index if not exists crm_visitors_assigned_user_idx
  on public.crm_visitors (assigned_to_user_id);

create index if not exists crm_workspace_invites_invited_by_idx
  on public.crm_workspace_invites (invited_by);

create index if not exists crm_workspace_invites_accepted_user_idx
  on public.crm_workspace_invites (accepted_user_id);

update public.crm_workspaces
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'lead_followup_message',
  'Hi, this is Ibukun from Caressence. The Mini Stepper is ₦95,000, with free delivery nationwide. I’m here to help you complete your order. Would you like to go ahead?'
), updated_at = now()
where slug = 'legacy-usecrm' and lower(name) = 'caressence';
