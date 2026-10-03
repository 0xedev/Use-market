import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: "Use POST for this request." });

  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) return reply(401, { error: "Sign in before you invite a team member." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return reply(500, { error: "The team invite service is not configured." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: authError } = await admin.auth.getUser(accessToken);
  const user = userData?.user;
  if (authError || !user) return reply(401, { error: "Your sign-in session is not valid. Sign in again." });

  let input: { workspace_id?: unknown; email?: unknown; role?: unknown };
  try {
    input = await request.json();
  } catch {
    return reply(400, { error: "Enter an email address and a team role." });
  }

  const workspaceId = typeof input.workspace_id === "string" ? input.workspace_id : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = typeof input.role === "string" ? input.role : "agent";
  if (!workspaceId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply(400, { error: "Enter a valid email address." });
  }
  if (!["admin", "manager", "agent", "viewer"].includes(role)) {
    return reply(400, { error: "Choose a valid team role." });
  }

  const { data: actor, error: actorError } = await admin
    .from("crm_workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (actorError) return reply(500, { error: "Could not check your workspace role." });
  if (!actor || !["owner", "admin"].includes(actor.role)) {
    return reply(403, { error: "Only a workspace owner or admin can invite members." });
  }
  if (role === "admin" && actor.role !== "owner") {
    return reply(403, { error: "Only the workspace owner can invite an admin." });
  }

  const { data: existingMember, error: memberError } = await admin
    .from("crm_workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError) return reply(500, { error: "Could not check the workspace member list." });
  if (!existingMember) return reply(403, { error: "You do not have access to this workspace." });

  const { data: workspace, error: workspaceError } = await admin
    .from("crm_workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError || !workspace) return reply(404, { error: "The workspace was not found." });

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return reply(500, { error: "Could not check whether this person is already a member." });
  const invitedUser = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (invitedUser) {
    const { data: existingMemberInWorkspace, error: invitedMemberError } = await admin
      .from("crm_workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", invitedUser.id)
      .maybeSingle();
    if (invitedMemberError) return reply(500, { error: "Could not check the invite recipient." });
    if (existingMemberInWorkspace) return reply(409, { error: "This person is already in the workspace." });
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const { data: oldInvite, error: oldInviteError } = await admin
    .from("crm_workspace_invites")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (oldInviteError) return reply(500, { error: "Could not check for an earlier invite." });

  const inviteRow = {
    workspace_id: workspaceId,
    email,
    role,
    token_hash: tokenHash,
    status: "pending",
    invited_by: user.id,
    accepted_user_id: null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
  };
  const inviteWrite = oldInvite
    ? await admin.from("crm_workspace_invites").update(inviteRow).eq("id", oldInvite.id)
    : await admin.from("crm_workspace_invites").insert(inviteRow);
  if (inviteWrite.error) return reply(500, { error: "Could not save the team invite." });

  const inviteUrl = `https://use-market.vercel.app/?workspace_invite=${encodeURIComponent(token)}`;
  const { error: emailError } = invitedUser
    ? { error: new Error("This email already has a CRM account.") }
    : await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteUrl,
      });

  return reply(200, {
    ok: true,
    email_sent: !emailError,
    email_notice: emailError
      ? invitedUser
        ? "This person already has a CRM account. Copy the invite link and send it to them. They must sign in with this email address."
        : "The invite is saved, but the email could not be sent. Copy the invite link and send it to the person. They must sign in with this email address."
      : `An invite email was sent to ${email}.`,
    invite_url: inviteUrl,
    workspace_name: workspace.name,
  });
});
