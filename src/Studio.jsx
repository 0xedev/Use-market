import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BadgePercent,
  BarChart3,
  BellRing,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Globe2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  UserPlus,
  UserRoundCheck,
  Users,
  WandSparkles,
  Webhook,
  X,
  Phone,
  CalendarDays,
  Send,
  PackagePlus,
} from "lucide-react";
import { supabase } from "./supabase";
import { trackTikTokEvent } from "./tiktok";

const money = (v = 0) =>
  `₦${Number(v || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const fmtDate = (v) =>
  v
    ? new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v))
    : "—";
const dtLocal = (v) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const slugify = (v = "") =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const orderStatuses = [
  "pending",
  "contacted",
  "confirmed",
  "scheduled",
  "awaiting",
  "dispatched",
  "delivered",
  "returned",
  "cancelled",
  "failed",
];
const paymentStatuses = [
  "unpaid",
  "pending",
  "paid",
  "partial",
  "failed",
  "refunded",
];
const deliveryStatuses = [
  "pending",
  "scheduled",
  "awaiting",
  "picked_up",
  "in_transit",
  "delivered",
  "returned",
  "failed",
  "cancelled",
];
const EMPTY = {
  visitors: [],
  buyers: [],
  orders: [],
  orderItems: [],
  products: [],
  variants: [],
  forms: [],
  fields: [],
  formProducts: [],
  bumps: [],
  agents: [],
  followups: [],
  deliveries: [],
  coupons: [],
  automations: [],
  integrations: [],
  webhooks: [],
  sites: [],
  payments: [],
};
const NAV = [
  ["Overview", LayoutDashboard],
  ["Live Visitors", Flame],
  ["Orders", ShoppingBag],
  ["Customers", Users],
  ["Products", Boxes],
  ["Order Forms", FileText],
  ["Agents", UserRoundCheck],
  ["Follow-ups", MessageCircle],
  ["Deliveries", Truck],
  ["Coupons", BadgePercent],
  ["Automations", WandSparkles],
  ["Analytics", BarChart3],
  ["Integrations", Webhook],
  ["Settings", Settings],
];
const TABLES = {
  visitors: "crm_visitors",
  buyers: "crm_buyers",
  orders: "crm_orders",
  orderItems: "crm_order_items",
  products: "crm_products",
  variants: "crm_product_variants",
  forms: "crm_order_forms",
  fields: "crm_form_fields",
  formProducts: "crm_form_products",
  bumps: "crm_order_bumps",
  agents: "crm_agents",
  followups: "crm_followups",
  deliveries: "crm_deliveries",
  coupons: "crm_coupons",
  automations: "crm_automations",
  integrations: "crm_integrations",
  webhooks: "crm_webhooks",
  sites: "crm_sites",
  payments: "crm_payments",
};
const TIMESTAMPED = new Set([
  "crm_buyers",
  "crm_visitors",
  "crm_workspaces",
  "crm_sites",
  "crm_products",
  "crm_product_variants",
  "crm_coupons",
  "crm_order_forms",
  "crm_agents",
  "crm_orders",
  "crm_followups",
  "crm_deliveries",
  "crm_automations",
  "crm_integrations",
  "crm_webhooks",
]);

export default function Studio() {
  const publicMatch = window.location.pathname.match(/^\/form\/([^/]+)$/);
  if (publicMatch)
    return <PublicOrderForm slug={decodeURIComponent(publicMatch[1])} />;
  const [session, setSession] = useState(null),
    [authLoading, setAuthLoading] = useState(true),
    [workspace, setWorkspace] = useState(null),
    [role, setRole] = useState(null),
    [data, setData] = useState(EMPTY),
    [page, setPage] = useState("Overview"),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(false),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState(null),
    [drawer, setDrawer] = useState(null),
    [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setAuthLoading(false);
    });
    const { data: l } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => l.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session?.user) {
      setWorkspace(null);
      setData(EMPTY);
      return;
    }
    bootstrap();
  }, [session?.user?.id]);
  useEffect(() => {
    if (!workspace?.id) return;
    const ch = supabase.channel(`crm-ui-${workspace.id}`);
    [
      "crm_visitors",
      "crm_buyers",
      "crm_orders",
      "crm_followups",
      "crm_deliveries",
    ].forEach((table) =>
      ch.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => loadAll(workspace.id, false), 300);
        },
      ),
    );
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  }, [workspace?.id]);
  const notify = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };
  async function bootstrap() {
    setLoading(true);
    const { data: m, error } = await supabase
      .from("crm_workspace_members")
      .select("workspace_id,role")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();
    if (error || !m) {
      notify(error?.message || "No CRM workspace attached", "error");
      setLoading(false);
      return;
    }
    const { data: w, error: we } = await supabase
      .from("crm_workspaces")
      .select("*")
      .eq("id", m.workspace_id)
      .single();
    if (we) {
      notify(we.message, "error");
      setLoading(false);
      return;
    }
    setWorkspace(w);
    setRole(m.role);
    await loadAll(m.workspace_id, false);
    setLoading(false);
  }
  async function loadAll(id = workspace?.id, spin = true) {
    if (!id) return;
    if (spin) setLoading(true);
    const ordered = {
      visitors: ["last_seen_at", false],
      buyers: ["created_at", false],
      orders: ["created_at", false],
      followups: ["due_at", true],
      deliveries: ["created_at", false],
    };
    const entries = await Promise.all(
      Object.entries(TABLES).map(async ([k, t]) => {
        let q = supabase.from(t).select("*").eq("workspace_id", id);
        if (ordered[k])
          q = q.order(ordered[k][0], { ascending: ordered[k][1] }).limit(700);
        const { data: r, error } = await q;
        if (error) console.error(t, error);
        return [k, r || []];
      }),
    );
    setData(Object.fromEntries(entries));
    if (spin) setLoading(false);
  }
  async function insert(table, payload, label = "Saved", reload = true) {
    const { data: r, error } = await supabase
      .from(table)
      .insert({ workspace_id: workspace.id, ...payload })
      .select()
      .single();
    if (error) {
      notify(error.message, "error");
      return null;
    }
    if (reload) await loadAll(workspace.id, false);
    notify(label);
    return r;
  }
  async function update(table, id, patch, label = "Updated", reload = true) {
    const body = TIMESTAMPED.has(table)
      ? { ...patch, updated_at: new Date().toISOString() }
      : patch;
    const { data: r, error } = await supabase
      .from(table)
      .update(body)
      .eq("id", id)
      .eq("workspace_id", workspace.id)
      .select()
      .maybeSingle();
    if (error) {
      notify(error.message, "error");
      return null;
    }
    if (reload) await loadAll(workspace.id, false);
    notify(label);
    return r;
  }
  async function remove(table, id, label = "Deleted") {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspace.id);
    if (error) {
      notify(error.message, "error");
      return false;
    }
    await loadAll(workspace.id, false);
    notify(label);
    return true;
  }
  async function saveWorkspace(patch) {
    const { data: w, error } = await supabase
      .from("crm_workspaces")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", workspace.id)
      .select()
      .single();
    if (error) return notify(error.message, "error");
    setWorkspace(w);
    notify("Workspace saved");
  }
  async function crmAction(functionName, args, successMessage) {
    const { data: result, error } = await supabase.rpc(functionName, args);
    if (error) {
      notify(error.message, "error");
      return null;
    }
    await loadAll(workspace.id, false);
    if (successMessage) notify(successMessage);
    return result;
  }
  async function markLeadContacted(visitorId) {
    return crmAction(
      "crm_mark_lead_contacted",
      { p_visitor_id: visitorId },
      "Lead marked contacted",
    );
  }
  async function convertLead(visitorId) {
    const result = await crmAction(
      "crm_convert_lead_to_order",
      { p_visitor_id: visitorId },
      null,
    );
    if (result) {
      notify(
        result.already_exists
          ? "Existing order " + result.order_number + " returned"
          : "Order " + result.order_number + " created",
      );
    }
    return result;
  }
  async function markOrderPaid(order, reference = null, method = null) {
    const result = await crmAction(
      "crm_mark_order_paid",
      {
        p_order_id: order.id,
        p_reference: reference,
        p_method: method,
      },
      "Payment marked paid",
    );
    if (result) {
      trackTikTokEvent("CompletePayment", {
        content_id: "caressence-mini-stepper",
        content_type: "product",
        value: Number(order.total || 0),
        currency: order.currency || "NGN",
        event_id: order.id,
        ...(order.attribution || {}),
      });
    }
    return result;
  }
  async function markOrderDelivered(order) {
    return crmAction(
      "crm_mark_order_delivered",
      { p_order_id: order.id },
      "Order marked delivered",
    );
  }
  if (authLoading) return <Splash />;
  if (!session) return <Login notify={notify} />;
  const ctx = {
    session,
    workspace,
    role,
    data,
    search,
    loading,
    notify,
    insert,
    update,
    remove,
    saveWorkspace,
    markLeadContacted,
    convertLead,
    markOrderPaid,
    markOrderDelivered,
    refresh: () => loadAll(),
    open: (type, props = {}) => setModal({ type, ...props }),
    details: (kind, id) => setDrawer({ kind, id }),
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand sidebar-brand">
          <div className="brand-mark">u</div>
          <div>
            <strong>useCRM</strong>
            <span>Commerce operations</span>
          </div>
          <button className="mobile-close" onClick={() => setMobile(false)}>
            <X size={20} />
          </button>
        </div>
        <nav>
          {NAV.map(([n, I]) => (
            <button
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => {
                setPage(n);
                setSearch("");
                setMobile(false);
              }}
            >
              <I size={18} />
              <span>{n}</span>
              {n === "Live Visitors" && (
                <b className="nav-count">
                  {
                    data.visitors.filter(
                      (v) => v.intent_score >= 70 && v.status !== "submitted",
                    ).length
                  }
                </b>
              )}
              {n === "Follow-ups" &&
                data.followups.filter((f) => f.status === "pending").length >
                  0 && (
                  <b className="nav-count">
                    {
                      data.followups.filter((f) => f.status === "pending")
                        .length
                    }
                  </b>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-pill">
            <div className="avatar">{workspace?.name?.[0] || "U"}</div>
            <div>
              <strong>{workspace?.name || "useCRM"}</strong>
              <span>{role} · live</span>
            </div>
          </div>
          <button className="logout" onClick={() => supabase.auth.signOut()}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button className="menu-button" onClick={() => setMobile(true)}>
              <Menu size={20} />
            </button>
            <div>
              <p>Workspace</p>
              <h1>{page}</h1>
            </div>
          </div>
          <div className="top-actions">
            <div className="search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${page.toLowerCase()}`}
              />
            </div>
            <button
              className="quick-create"
              onClick={() => setModal({ type: "order" })}
            >
              <Plus size={16} /> New order
            </button>
            <button className="icon-btn" onClick={() => loadAll()}>
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
            <button className="icon-btn">
              <BellRing size={17} />
            </button>
            <div className="user-dot">
              {(session.user.user_metadata?.full_name ||
                session.user.email ||
                "U")[0].toUpperCase()}
            </div>
          </div>
        </header>
        <section className="content">
          {loading && !data.visitors.length && !data.buyers.length ? (
            <Loading />
          ) : (
            <Page page={page} ctx={ctx} />
          )}
        </section>
      </main>
      {modal && <Modal modal={modal} close={() => setModal(null)} ctx={ctx} />}{" "}
      {drawer && (
        <Drawer drawer={drawer} close={() => setDrawer(null)} ctx={ctx} />
      )}{" "}
      {toast && (
        <div className={`toast ${toast.tone === "error" ? "toast-error" : ""}`}>
          {toast.tone === "error" ? <X size={17} /> : <Check size={17} />}{" "}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Login({ notify }) {
  const [email, setEmail] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) notify(error.message, "error");
  }
  async function magic(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    notify(
      error ? error.message : "Check your email for the sign-in link.",
      error ? "error" : "ok",
    );
    setBusy(false);
  }
  return (
    <div className="login-page">
      <div className="login-orb orb-a" />
      <div className="login-orb orb-b" />
      <div className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark">u</div>
          <div>
            <strong>useCRM</strong>
            <span>Commerce operations</span>
          </div>
        </div>
        <div className="eyebrow">
          <Sparkles size={15} /> Buyer intent + fulfillment
        </div>
        <h1>Run sales, not spreadsheets.</h1>
        <p className="login-copy">
          Track intent, create orders, manage customers, products, agents,
          follow-ups and delivery.
        </p>
        <button className="auth-btn google" onClick={google}>
          <span className="google-g">G</span> Continue with Google
        </button>
        {!show ? (
          <button className="auth-btn secondary" onClick={() => setShow(true)}>
            Continue with email link
          </button>
        ) : (
          <form className="email-login" onSubmit={magic}>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <button disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}{" "}
              Send link
            </button>
          </form>
        )}
      </div>
      <div className="login-proof">
        <Proof
          I={Flame}
          t="Live intent"
          s="See what buyers typed before submitting."
        />
        <Proof
          I={ShoppingBag}
          t="Order desk"
          s="Create, confirm and close orders."
        />
        <Proof
          I={Truck}
          t="Fulfillment"
          s="Schedule follow-ups and delivery."
        />
      </div>
    </div>
  );
}
const Proof = ({ I, t, s }) => (
  <div>
    <I size={22} />
    <strong>{t}</strong>
    <span>{s}</span>
  </div>
);
const Splash = () => (
  <div className="splash">
    <div className="brand-mark">u</div>
    <Loader2 className="spin" />
  </div>
);
const Loading = () => (
  <div className="loading-card">
    <Loader2 className="spin" />
    Loading live CRM data…
  </div>
);

function Page({ page, ctx }) {
  const m = {
    Overview: <Overview c={ctx} />,
    "Live Visitors": <Visitors c={ctx} />,
    Orders: <Orders c={ctx} />,
    Customers: <Customers c={ctx} />,
    Products: <Products c={ctx} />,
    "Order Forms": <Forms c={ctx} />,
    Agents: <Agents c={ctx} />,
    "Follow-ups": <Followups c={ctx} />,
    Deliveries: <Deliveries c={ctx} />,
    Coupons: <Coupons c={ctx} />,
    Automations: <Automations c={ctx} />,
    Analytics: <Analytics c={ctx} />,
    Integrations: <Integrations c={ctx} />,
    Settings: <SettingsPage c={ctx} />,
  };
  return m[page] || m.Overview;
}
function Overview({ c }) {
  const { data, open, details } = c,
    productionVisitors = data.visitors.filter((v) => !isInternalTest(v)),
    productionOrders = data.orders.filter((o) => !isInternalTest(o)),
    hot = productionVisitors.filter(
      (v) => v.intent_score >= 70 && v.status !== "submitted",
    ),
    del = productionOrders.filter((o) => o.status === "delivered"),
    rev = del.reduce((s, o) => s + Number(o.total || 0), 0),
    fu = data.followups.filter((f) => f.status === "pending");
  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">
            <Activity size={14} /> Live commerce command center
          </div>
          <h2>Know who wants to buy, then move them to delivered.</h2>
          <p>One operating surface from buyer intent to fulfillment.</p>
          <div className="hero-actions">
            <button onClick={() => open("order")}>
              <ShoppingBag size={16} /> Create order
            </button>
            <button onClick={() => open("customer")}>
              <UserPlus size={16} /> Add customer
            </button>
          </div>
        </div>
        <div className="hero-score">
          <span>Hot leads</span>
          <strong>{hot.length}</strong>
          <small>{productionVisitors.length} sessions</small>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          I={Flame}
          t="Hot intent"
          v={hot.length}
          s="recoverable sessions"
        />
        <Metric
          I={ShoppingBag}
          t="Open orders"
          v={
            productionOrders.filter(
              (o) =>
                !["delivered", "cancelled", "returned", "failed"].includes(
                  o.status,
                ),
            ).length
          }
          s={`${productionOrders.length} total`}
        />
        <Metric
          I={CircleDollarSign}
          t="Delivered revenue"
          v={money(rev)}
          s={`${del.length} delivered`}
        />
        <Metric
          I={MessageCircle}
          t="Follow-ups due"
          v={fu.length}
          s={`${data.deliveries.filter((d) => !["delivered", "returned", "failed", "cancelled"].includes(d.status)).length} active deliveries`}
        />
      </div>
      <div className="workspace-grid">
        <Panel title="Sales pipeline">
          <Pipeline orders={productionOrders} />
        </Panel>
        <Panel title="Hot visitors">
          <div className="stack-list">
            {hot.slice(0, 6).map((v) => (
              <button
                className="mini-row mini-button"
                key={v.id}
                onClick={() => details("visitor", v.id)}
              >
                <Intent n={v.intent_score} />
                <div>
                  <strong>{v.name || v.phone || "Anonymous visitor"}</strong>
                  <span>
                    {v.last_event_type?.replaceAll("_", " ")} ·{" "}
                    {v.source_website}
                  </span>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
            {!hot.length && <Empty compact label="No hot visitors right now" />}
          </div>
        </Panel>
        <Panel title="Next follow-ups">
          <div className="stack-list">
            {fu.slice(0, 6).map((f) => {
              const b = data.buyers.find((x) => x.id === f.buyer_id);
              return (
                <button
                  className="mini-row mini-button"
                  key={f.id}
                  onClick={() => details("followup", f.id)}
                >
                  <div className="round-icon">
                    <MessageCircle size={16} />
                  </div>
                  <div>
                    <strong>{b?.name || "Customer"}</strong>
                    <span>
                      {f.channel} · {fmtDate(f.due_at)}
                    </span>
                  </div>
                  <Status v={f.status} />
                </button>
              );
            })}
            {!fu.length && <Empty compact label="No pending follow-ups" />}
          </div>
        </Panel>
        <Panel title="Delivery health">
          <div className="delivery-summary">
            <div>
              <strong>
                {
                  data.deliveries.filter(
                    (d) =>
                      ![
                        "delivered",
                        "returned",
                        "failed",
                        "cancelled",
                      ].includes(d.status),
                  ).length
                }
              </strong>
              <span>In progress</span>
            </div>
            <div>
              <strong>
                {data.deliveries.filter((d) => d.status === "delivered").length}
              </strong>
              <span>Delivered</span>
            </div>
            <div>
              <strong>
                {
                  data.deliveries.filter((d) =>
                    ["returned", "failed"].includes(d.status),
                  ).length
                }
              </strong>
              <span>Exceptions</span>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
const Metric = ({ I, t, v, s }) => (
  <div className="metric">
    <div className="metric-icon">
      <I size={19} />
    </div>
    <div>
      <span>{t}</span>
      <strong>{v}</strong>
      <small>{s}</small>
    </div>
  </div>
);
const Intent = ({ n = 0 }) => (
  <div className={`intent-ring ${n >= 70 ? "hot" : ""}`}>{n}</div>
);
function Pipeline({ orders }) {
  return (
    <div className="pipeline">
      {[
        "pending",
        "contacted",
        "confirmed",
        "scheduled",
        "dispatched",
        "delivered",
      ].map((s) => {
        const n = orders.filter((o) => o.status === s).length,
          p = orders.length ? Math.max(3, (n / orders.length) * 100) : 0;
        return (
          <div key={s}>
            <span>{s}</span>
            <strong>{n}</strong>
            <i>
              <b style={{ width: `${p}%` }} />
            </i>
          </div>
        );
      })}
    </div>
  );
}

function Visitors({ c }) {
  const r = filter(c.data.visitors, c.search, [
    "name",
    "phone",
    "email",
    "source_website",
    "status",
    "city",
    "state",
  ]),
    production = r.filter((v) => !isInternalTest(v));
  return (
    <>
      <Head
        title="Live buyer intent"
        copy="Click a session to inspect attribution, form progress and lead status. Internal test data is excluded from performance totals."
        right={
          <div className="page-kpis">
            <b>{production.length}</b>
            <span>sessions</span>
            <b>{production.filter((v) => v.intent_score >= 70).length}</b>
            <span>hot</span>
          </div>
        }
      />
      <Panel noPad>
        <div className="table-wrap">
          <table className="clickable-table">
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Intent</th>
                <th>Progress</th>
                <th>Location</th>
                <th>Website</th>
                <th>Status</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {r.map((v) => (
                <tr key={v.id} onClick={() => c.details("visitor", v.id)}>
                  <td>
                    <strong>{v.name || "Unknown"}</strong>
                    <small>
                      {isInternalTest(v)
                        ? "Internal test data"
                        : v.phone || v.email || "Not identified"}
                    </small>
                  </td>
                  <td>
                    <div className="intent-cell">
                      <b>{v.intent_score}</b>
                      <span>
                        <i style={{ width: `${v.intent_score}%` }} />
                      </span>
                    </div>
                  </td>
                  <td>
                    {Array.isArray(v.fields_touched)
                      ? new Set(v.fields_touched).size
                      : 0}{" "}
                    fields
                    <small>{v.last_event_type?.replaceAll("_", " ")}</small>
                  </td>
                  <td>{[v.city, v.state].filter(Boolean).join(", ") || "—"}</td>
                  <td>{v.source_website}</td>
                  <td>
                    <Status v={v.status} />
                  </td>
                  <td>{fmtDate(v.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
function Customers({ c }) {
  const r = filter(c.data.buyers, c.search, [
    "name",
    "phone",
    "email",
    "whatsapp",
    "state",
    "status",
  ]);
  return (
    <>
      <Head
        title="Customers"
        copy="Manage buyer profiles, notes and actions."
        button="Add customer"
        onClick={() => c.open("customer")}
      />
      <div className="customer-grid">
        {r.map((b) => (
          <button
            className="customer-card"
            key={b.id}
            onClick={() => c.details("customer", b.id)}
          >
            <div className="customer-avatar">
              {(b.name || "?")[0].toUpperCase()}
            </div>
            <div className="customer-main">
              <div className="row-between">
                <strong>{b.name}</strong>
                <Status v={b.status} />
              </div>
              <span>{b.phone}</span>
              <small>
                {isInternalTest(b)
                  ? "Internal test data"
                  : [b.city, b.state].filter(Boolean).join(", ") ||
                    b.source_website}
              </small>
              <div className="customer-stats">
                <div>
                  <b>{b.order_count || 0}</b>
                  <span>orders</span>
                </div>
                <div>
                  <b>{money(b.total_spent)}</b>
                  <span>lifetime value</span>
                </div>
              </div>
            </div>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      {!r.length && (
        <Empty
          label="No customers yet"
          action="Add customer"
          onAction={() => c.open("customer")}
        />
      )}
    </>
  );
}
function Orders({ c }) {
  const r = filter(c.data.orders, c.search, [
    "order_number",
    "status",
    "payment_status",
    "delivery_state",
  ]);
  return (
    <>
      <Head
        title="Orders"
        copy="Create, confirm, assign and fulfill orders."
        button="Create order"
        onClick={() => c.open("order")}
      />
      <div className="order-stage-strip">
        {["pending", "confirmed", "scheduled", "dispatched", "delivered"].map(
          (s) => (
            <div key={s}>
              <span>{s}</span>
              <b>{r.filter((o) => o.status === s).length}</b>
            </div>
          ),
        )}
      </div>
      <Panel noPad>
        <div className="table-wrap">
          <table className="clickable-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Delivery</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {r.map((o) => {
                const b = c.data.buyers.find((x) => x.id === o.buyer_id);
                return (
                  <tr key={o.id} onClick={() => c.details("order", o.id)}>
                    <td>
                      <strong>{o.order_number}</strong>
                      <small>{o.source || "manual"}</small>
                    </td>
                    <td>{b?.name || "Customer"}</td>
                    <td>
                      <strong>{money(o.total)}</strong>
                    </td>
                    <td>
                      <Status v={o.payment_status} />
                    </td>
                    <td>{o.delivery_state || o.delivery_city || "—"}</td>
                    <td>
                      <select
                        className="status-select"
                        value={o.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          c.update(
                            "crm_orders",
                            o.id,
                            {
                              status: e.target.value,
                              ...(e.target.value === "delivered"
                                ? { delivered_at: new Date().toISOString() }
                                : {}),
                            },
                            "Order status updated",
                          )
                        }
                      >
                        {orderStatuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>{fmtDate(o.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {!r.length && (
        <Empty
          label="No orders yet"
          action="Create order"
          onAction={() => c.open("order")}
        />
      )}
    </>
  );
}
function Products({ c }) {
  const r = filter(c.data.products, c.search, ["name", "sku", "category"]);
  return (
    <>
      <Head
        title="Products & packages"
        copy="Products, variants, prices and stock."
        button="Add product"
        onClick={() => c.open("product")}
      />
      <div className="product-grid">
        {r.map((p) => {
          const vs = c.data.variants.filter((v) => v.product_id === p.id);
          return (
            <button
              className="product-card v3"
              key={p.id}
              onClick={() => c.details("product", p.id)}
            >
              <div className="product-image">
                {p.image_url ? (
                  <img src={p.image_url} alt="" />
                ) : (
                  <Boxes size={30} />
                )}
              </div>
              <div className="product-body">
                <div className="row-between">
                  <strong>{p.name}</strong>
                  <Status v={p.active ? "active" : "inactive"} />
                </div>
                <span>{p.category || p.sku || "Uncategorised"}</span>
                <div className="price-line">
                  <strong>
                    {vs.length
                      ? money(Math.min(...vs.map((v) => Number(v.price || 0))))
                      : "No price"}
                  </strong>
                  <small>
                    {vs.length} package{vs.length === 1 ? "" : "s"}
                  </small>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!r.length && (
        <Empty
          label="No products yet"
          action="Add product"
          onAction={() => c.open("product")}
        />
      )}
    </>
  );
}

function Forms({ c }) {
  const [sel, setSel] = useState(null),
    forms = filter(c.data.forms, c.search, ["title", "slug", "subtitle"]),
    a = sel ? c.data.forms.find((f) => f.id === sel) : forms[0];
  async function copy(f) {
    const s = c.data.sites.find((x) => x.id === f.site_id) || c.data.sites[0];
    if (!s) return c.notify("Connect a website first", "error");
    await navigator.clipboard?.writeText(
      `${window.location.origin}/form/${f.slug}?site_key=${s.public_key}`,
    );
    c.notify("Form link copied");
  }
  return (
    <>
      <Head
        title="Order forms"
        copy="Build public checkout forms without editing code."
        button="Create form"
        onClick={() => c.open("form")}
      />
      <div className="forms-layout">
        <div className="form-list">
          {forms.map((f) => (
            <button
              className={`form-list-item ${a?.id === f.id ? "active" : ""}`}
              key={f.id}
              onClick={() => setSel(f.id)}
            >
              <div>
                <strong>{f.title}</strong>
                <span>/form/{f.slug}</span>
              </div>
              <Status v={f.published ? "published" : "draft"} />
            </button>
          ))}
        </div>
        {a ? (
          <div className="form-editor">
            <div className="editor-head">
              <div>
                <span>Form builder</span>
                <h3>{a.title}</h3>
                <p>{a.subtitle || "Configure fields, packages and offers."}</p>
              </div>
              <div className="inline-actions">
                <button className="outline-btn" onClick={() => copy(a)}>
                  <Copy size={14} /> Link
                </button>
                <button
                  className="outline-btn"
                  onClick={() => c.open("form", { record: a })}
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  className="primary-btn"
                  onClick={() =>
                    c.update(
                      "crm_order_forms",
                      a.id,
                      { published: !a.published },
                      a.published ? "Form unpublished" : "Form published",
                    )
                  }
                >
                  {a.published ? "Unpublish" : "Publish"}
                </button>
              </div>
            </div>
            <Builder
              title="Customer fields"
              action="Add field"
              onAction={() => c.open("field", { form: a })}
            >
              {c.data.fields
                .filter((x) => x.form_id === a.id)
                .sort((x, y) => x.sort_order - y.sort_order)
                .map((x) => (
                  <div className="builder-row" key={x.id}>
                    <FileText size={16} />
                    <div>
                      <strong>{x.label}</strong>
                      <small>
                        {x.field_type} · {x.field_key}
                        {x.required ? " · required" : ""}
                      </small>
                    </div>
                    <button
                      className="row-icon"
                      onClick={() => c.open("field", { form: a, record: x })}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="row-icon danger"
                      onClick={() =>
                        c.remove("crm_form_fields", x.id, "Field removed")
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </Builder>
            <Builder
              title="Products & packages"
              action="Attach package"
              onAction={() => c.open("attach", { form: a })}
            >
              {c.data.formProducts
                .filter((x) => x.form_id === a.id)
                .map((x) => {
                  const v = c.data.variants.find((v) => v.id === x.variant_id),
                    p = c.data.products.find((p) => p.id === v?.product_id);
                  return (
                    <div className="builder-row" key={x.id}>
                      <PackageCheck size={16} />
                      <div>
                        <strong>
                          {p?.name} — {v?.name}
                        </strong>
                        <small>{money(x.offer_price ?? v?.price)}</small>
                      </div>
                      <button
                        className="row-icon danger"
                        onClick={() =>
                          c.remove("crm_form_products", x.id, "Package removed")
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
            </Builder>
            <Builder
              title="Order bumps"
              action="Add bump"
              onAction={() => c.open("bump", { form: a })}
              highlight
            >
              {c.data.bumps
                .filter((x) => x.form_id === a.id)
                .map((x) => (
                  <div className="builder-row" key={x.id}>
                    <Sparkles size={16} />
                    <div>
                      <strong>{x.title}</strong>
                      <small>
                        {money(x.offer_price)} · {x.description || "add-on"}
                      </small>
                    </div>
                    <button
                      className="row-icon"
                      onClick={() => c.open("bump", { form: a, record: x })}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="row-icon danger"
                      onClick={() =>
                        c.remove("crm_order_bumps", x.id, "Bump removed")
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </Builder>
          </div>
        ) : (
          <Empty
            label="Create your first order form"
            action="Create form"
            onAction={() => c.open("form")}
          />
        )}
      </div>
    </>
  );
}
const Builder = ({ title, action, onAction, children, highlight }) => (
  <div className={`editor-section ${highlight ? "highlight" : ""}`}>
    <div className="section-title">
      <div>
        <strong>{title}</strong>
      </div>
      <button onClick={onAction}>
        <Plus size={15} />
        {action}
      </button>
    </div>
    {children}
  </div>
);
function Agents({ c }) {
  const r = filter(c.data.agents, c.search, [
    "name",
    "company_name",
    "phone",
    "email",
  ]);
  return (
    <>
      <Head
        title="Agents"
        copy="Sales and delivery agents, coverage and commissions."
        button="Add agent"
        onClick={() => c.open("agent")}
      />
      <div className="agent-grid">
        {r.map((a) => (
          <button
            className="agent-card"
            key={a.id}
            onClick={() => c.details("agent", a.id)}
          >
            <div className="avatar lg">{a.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="row-between">
                <strong>{a.name}</strong>
                <Status v={a.status} />
              </div>
              <span>{a.company_name || a.phone || "Agent"}</span>
              <div className="chips">
                {(a.states_covered || []).map((s) => (
                  <b key={s}>{s}</b>
                ))}
              </div>
              <small>
                {a.commission_type === "none"
                  ? "No commission"
                  : `${a.commission_type} · ${a.commission_type === "percent" ? `${a.commission_value}%` : money(a.commission_value)}`}
              </small>
            </div>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      {!r.length && (
        <Empty
          label="No agents yet"
          action="Add agent"
          onAction={() => c.open("agent")}
        />
      )}
    </>
  );
}
function Followups({ c }) {
  const r = filter(c.data.followups, c.search, [
    "channel",
    "status",
    "note",
    "outcome",
  ]);
  return (
    <>
      <Head
        title="Follow-ups"
        copy="Recovery, confirmation and customer-care tasks."
        button="Schedule follow-up"
        onClick={() => c.open("followup")}
      />
      <div className="task-board">
        {["pending", "snoozed", "done"].map((s) => (
          <div className="task-column" key={s}>
            <div className="col-head">
              <span>{s}</span>
              <b>{r.filter((f) => f.status === s).length}</b>
            </div>
            {r
              .filter((f) => f.status === s)
              .map((f) => {
                const b = c.data.buyers.find((x) => x.id === f.buyer_id);
                return (
                  <div className="task-card" key={f.id}>
                    <button
                      className="task-main"
                      onClick={() => c.details("followup", f.id)}
                    >
                      <div className="task-channel">
                        <MessageCircle size={15} />
                        {f.channel}
                      </div>
                      <strong>{b?.name || "Customer"}</strong>
                      <span>{f.note || "Follow up"}</span>
                      <small>
                        <CalendarDays size={12} />
                        {fmtDate(f.due_at)}
                      </small>
                    </button>
                    {f.status === "pending" && (
                      <button
                        className="task-done"
                        onClick={() =>
                          c.update(
                            "crm_followups",
                            f.id,
                            {
                              status: "done",
                              completed_at: new Date().toISOString(),
                            },
                            "Follow-up completed",
                          )
                        }
                      >
                        <Check size={14} /> Done
                      </button>
                    )}
                  </div>
                );
              })}
            {!r.some((f) => f.status === s) && (
              <Empty compact label={`No ${s} tasks`} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
function Deliveries({ c }) {
  const r = filter(c.data.deliveries, c.search, [
    "provider",
    "rider_name",
    "tracking_code",
    "status",
  ]);
  return (
    <>
      <Head
        title="Deliveries"
        copy="Schedule fulfillment and move shipments through delivery stages."
        button="Schedule delivery"
        onClick={() => c.open("delivery")}
      />
      <div className="delivery-board">
        {[
          "scheduled",
          "awaiting",
          "picked_up",
          "in_transit",
          "delivered",
          "returned",
        ].map((s) => (
          <div className="delivery-col" key={s}>
            <div className="col-head">
              <span>{s.replace("_", " ")}</span>
              <b>{r.filter((d) => d.status === s).length}</b>
            </div>
            {r
              .filter((d) => d.status === s)
              .map((d) => {
                const o = c.data.orders.find((x) => x.id === d.order_id);
                return (
                  <div className="delivery-card" key={d.id}>
                    <button
                      className="delivery-main"
                      onClick={() => c.details("delivery", d.id)}
                    >
                      <strong>
                        {o?.order_number || d.provider || "Delivery"}
                      </strong>
                      <span>
                        {d.provider || "Provider"} ·{" "}
                        {d.rider_name || "No rider"}
                      </span>
                      <small>{fmtDate(d.scheduled_for || d.created_at)}</small>
                      <b>{money(d.fee)}</b>
                    </button>
                    {!["delivered", "returned"].includes(s) && (
                      <button
                        onClick={() =>
                          c.update(
                            "crm_deliveries",
                            d.id,
                            {
                              status:
                                s === "in_transit" ? "delivered" : "in_transit",
                              ...(s === "in_transit"
                                ? { delivered_at: new Date().toISOString() }
                                : {}),
                            },
                            "Delivery updated",
                          )
                        }
                      >
                        {s === "in_transit"
                          ? "Mark delivered"
                          : "Move in transit"}
                      </button>
                    )}
                  </div>
                );
              })}
            {!r.some((d) => d.status === s) && (
              <div className="column-empty">No deliveries</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
function Coupons({ c }) {
  const r = filter(c.data.coupons, c.search, ["code", "discount_type"]);
  return (
    <>
      <Head
        title="Coupons"
        copy="Discount codes with limits and validity windows."
        button="Create coupon"
        onClick={() => c.open("coupon")}
      />
      <div className="coupon-grid">
        {r.map((x) => (
          <button
            className="coupon"
            key={x.id}
            onClick={() => c.open("coupon", { record: x })}
          >
            <div className="coupon-notch left" />
            <div className="coupon-notch right" />
            <span>COUPON</span>
            <strong>{x.code}</strong>
            <h3>
              {x.discount_type === "percent"
                ? `${x.discount_value}% off`
                : money(x.discount_value)}
            </h3>
            <small>
              {x.uses_count || 0}
              {x.max_uses ? ` / ${x.max_uses}` : ""} uses · min{" "}
              {money(x.min_subtotal)}
            </small>
            <Status v={x.active ? "active" : "inactive"} />
          </button>
        ))}
      </div>
      {!r.length && (
        <Empty
          label="No coupons yet"
          action="Create coupon"
          onAction={() => c.open("coupon")}
        />
      )}
    </>
  );
}
function Automations({ c }) {
  return (
    <>
      <Head
        title="Automations"
        copy="Create reusable rules for recovery and follow-up workflows."
        button="New rule"
        onClick={() => c.open("automation")}
      />
      <div className="automation-list">
        {c.data.automations.map((a) => (
          <button
            className="automation"
            key={a.id}
            onClick={() => c.open("automation", { record: a })}
          >
            <div className="automation-icon">
              <WandSparkles size={20} />
            </div>
            <div>
              <strong>{a.name}</strong>
              <span>
                When <b>{a.trigger_event}</b>
              </span>
            </div>
            <div className="automation-flow">
              <code>{JSON.stringify(a.conditions)}</code>
              <span>→</span>
              <code>
                {Array.isArray(a.actions)
                  ? a.actions.map((x) => x.type).join(", ")
                  : "action"}
              </code>
            </div>
            <Status v={a.active ? "active" : "paused"} />
          </button>
        ))}
      </div>
      {!c.data.automations.length && (
        <Empty
          label="No automation rules"
          action="New rule"
          onAction={() => c.open("automation")}
        />
      )}
      <p className="feature-note">
        Rules are stored and editable here. Execution workers and channel
        dispatchers are a separate backend layer.
      </p>
    </>
  );
}
function Analytics({ c }) {
  const raw = c.data,
    d = {
      ...raw,
      visitors: raw.visitors.filter((v) => !isInternalTest(v)),
      orders: raw.orders.filter((o) => !isInternalTest(o)),
    },
    started = d.visitors.filter((v) => v.status !== "anonymous").length,
    identified = d.visitors.filter((v) =>
      ["identified", "submitted"].includes(v.status),
    ).length,
    submitted = d.visitors.filter((v) => v.status === "submitted").length,
    del = d.orders.filter((o) => o.status === "delivered").length,
    rev = d.orders
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + Number(o.total || 0), 0),
    rate = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "0%");
  const src = Object.entries(
    d.visitors.reduce((m, v) => {
      const k = v.utm_source || v.referrer || "Direct";
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  return (
    <>
      <Head
        title="Analytics"
        copy="Funnel from page sessions to WhatsApp leads, confirmed orders and delivery. Internal test data is excluded."
      />
      <div className="analytics-grid">
        <Panel title="Conversion funnel">
          <div className="funnel">
            {[
              ["Page sessions", d.visitors.length, 100],
              ["Form interaction", started, 82],
              ["Identified", identified, 66],
              ["WhatsApp leads", submitted, 52],
              ["CRM orders", d.orders.length, 39],
              ["Delivered", del, 28],
            ].map(([l, v, w]) => (
              <div className="funnel-row" key={l}>
                <span>{l}</span>
                <div>
                  <i style={{ width: `${w}%` }} />
                  <b>{v}</b>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Acquisition sources">
          <div className="source-chart">
            {src.map(([s, n]) => (
              <div key={s}>
                <span>{s}</span>
                <div>
                  <i
                    style={{
                      width: `${d.visitors.length ? (n / d.visitors.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <b>{n}</b>
              </div>
            ))}
            {!src.length && <Empty compact label="No acquisition data" />}
          </div>
        </Panel>
      </div>
      <div className="metric-grid analytics">
        <Metric
          I={Flame}
          t="Identification"
          v={rate(identified, started)}
          s="started → identified"
        />
        <Metric
          I={FileText}
          t="Submission"
          v={rate(submitted, started)}
          s="started → submitted"
        />
        <Metric
          I={Truck}
          t="Delivery rate"
          v={rate(del, d.orders.length)}
          s="orders → delivered"
        />
        <Metric
          I={CircleDollarSign}
          t="Delivered revenue"
          v={money(rev)}
          s="recognized sales"
        />
      </div>
    </>
  );
}
function Integrations({ c }) {
  const site = c.data.sites[0],
    snippet = site
      ? `<script>\nwindow.useCRM={siteKey:"${site.public_key}"};\n// send form events to crm_track_event\n<\/script>`
      : "Connect a website first.";
  return (
    <>
      <Head
        title="Integrations"
        copy="Connect websites, external systems and webhook endpoints."
        button="Connect website"
        onClick={() => c.open("site")}
      />
      <div className="integration-grid">
        <Panel
          title="Connected websites"
          action={`${c.data.sites.length} sites`}
        >
          <div className="stack-list">
            {c.data.sites.map((s) => (
              <button
                className="mini-row mini-button"
                key={s.id}
                onClick={() => c.open("site", { record: s })}
              >
                <div className="round-icon">
                  <Globe2 size={16} />
                </div>
                <div>
                  <strong>{s.name}</strong>
                  <span>{s.domain}</span>
                </div>
                <Status v={s.active ? "active" : "inactive"} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Tracking install" action="Public site key">
          <p className="muted">
            Use the scoped site key for new installations. Your existing legacy
            tracker remains supported.
          </p>
          <pre className="snippet">{snippet}</pre>
          <button
            className="outline-btn"
            onClick={async () => {
              await navigator.clipboard?.writeText(snippet);
              c.notify("Snippet copied");
            }}
          >
            <Copy size={15} /> Copy
          </button>
        </Panel>
        <Panel title="Webhooks" action={`${c.data.webhooks.length} endpoints`}>
          <div className="stack-list">
            {c.data.webhooks.map((w) => (
              <button
                className="mini-row mini-button"
                key={w.id}
                onClick={() => c.open("webhook", { record: w })}
              >
                <div className="round-icon">
                  <Webhook size={16} />
                </div>
                <div>
                  <strong>{w.url}</strong>
                  <span>
                    {Array.isArray(w.events) ? w.events.join(", ") : "Events"}
                  </span>
                </div>
                <Status v={w.active ? "active" : "inactive"} />
              </button>
            ))}
          </div>
          <button
            className="outline-btn full"
            onClick={() => c.open("webhook")}
          >
            <Plus size={15} /> Add webhook
          </button>
        </Panel>
        <Panel title="Channel records">
          <div className="connector-list">
            {["whatsapp", "paystack", "custom_api"].map((t) => {
              const r = c.data.integrations.find(
                (i) => i.integration_type === t,
              );
              return (
                <div key={t}>
                  <div className="connector-logo">{t[0].toUpperCase()}</div>
                  <div>
                    <strong>{t.replace("_", " ")}</strong>
                    <span>
                      {r ? "Configuration record saved" : "Not configured"}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      c.open("integration", { kind: t, record: r })
                    }
                  >
                    {r ? "Edit" : "Configure"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="feature-note">
            Secrets are not stored in this browser UI. Provider credentials
            should live in server-side secret storage.
          </p>
        </Panel>
      </div>
    </>
  );
}
function SettingsPage({ c }) {
  return (
    <>
      <Head
        title="Settings"
        copy="Workspace defaults, access and environment."
        button="Edit workspace"
        onClick={() => c.open("workspace", { record: c.workspace })}
      />
      <div className="settings-grid">
        <Panel title="Workspace">
          <dl className="details">
            <div>
              <dt>Name</dt>
              <dd>{c.workspace.name}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{c.workspace.currency}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{c.workspace.timezone}</dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>{c.role}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Authentication">
          <div className="auth-status">
            <div className="provider enabled">
              <span>G</span>
              <div>
                <strong>Google</strong>
                <small>Google Identity → Supabase session</small>
              </div>
              <Status v="active" />
            </div>
          </div>
        </Panel>
        <Panel title="Multi-site">
          <div className="big-stat">
            {c.data.sites.length}
            <span>connected websites</span>
          </div>
          <p className="muted">
            Sites share customer and order operations inside this workspace
            while keeping scoped tracking keys.
          </p>
        </Panel>
        <Panel title="Security">
          <dl className="details">
            <div>
              <dt>Tenant RLS</dt>
              <dd>Enabled</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{c.role}</dd>
            </div>
            <div>
              <dt>Legacy tracker</dt>
              <dd>Compatible</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </>
  );
}

function Modal({ modal, close, ctx }) {
  const forms = {
      customer: CustomerForm,
      order: OrderForm,
      product: ProductForm,
      variant: VariantForm,
      form: FormForm,
      field: FieldForm,
      attach: AttachForm,
      bump: BumpForm,
      agent: AgentForm,
      followup: FollowupForm,
      delivery: DeliveryForm,
      coupon: CouponForm,
      automation: AutomationForm,
      site: SiteForm,
      webhook: WebhookForm,
      integration: IntegrationForm,
      workspace: WorkspaceForm,
    },
    C = forms[modal.type];
  if (!C) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="modal-card">
        <div className="modal-top">
          <div>
            <span>useCRM</span>
            <h3>{titleFor(modal.type, modal.record)}</h3>
          </div>
          <button onClick={close}>
            <X size={18} />
          </button>
        </div>
        <C modal={modal} close={close} c={ctx} />
      </div>
    </div>
  );
}
const titleFor = (t, r) =>
  ({
    customer: r ? "Edit customer" : "Add customer",
    order: r ? "Edit order" : "Create order",
    product: r ? "Edit product" : "Add product",
    variant: r ? "Edit package" : "Add package",
    form: r ? "Edit order form" : "Create order form",
    field: r ? "Edit field" : "Add field",
    attach: "Attach package",
    bump: r ? "Edit order bump" : "Add order bump",
    agent: r ? "Edit agent" : "Add agent",
    followup: r ? "Edit follow-up" : "Schedule follow-up",
    delivery: r ? "Edit delivery" : "Schedule delivery",
    coupon: r ? "Edit coupon" : "Create coupon",
    automation: r ? "Edit automation" : "Create automation",
    site: r ? "Edit website" : "Connect website",
    webhook: r ? "Edit webhook" : "Add webhook",
    integration: r ? "Edit integration" : "Configure integration",
    workspace: "Workspace settings",
  })[t] || "Edit";
const val = (o, k, d = "") => o?.[k] ?? d;
function CustomerForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      name: val(r, "name"),
      phone: val(r, "phone"),
      whatsapp: val(r, "whatsapp"),
      email: val(r, "email"),
      address: val(r, "address"),
      city: val(r, "city"),
      state: val(r, "state"),
      country: val(r, "country", "Nigeria"),
      status: val(r, "status", "new"),
      notes: val(r, "notes"),
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      ...f,
      source_website: r?.source_website || c.data.sites[0]?.domain || "manual",
      order_count: r?.order_count ?? 0,
      total_spent: r?.total_spent ?? 0,
    };
    const ok = r
      ? await c.update("crm_buyers", r.id, p, "Customer updated")
      : await c.insert("crm_buyers", p, "Customer added");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Full name"
          req
          v={f.name}
          set={(x) => setF({ ...f, name: x })}
        />
        <Input
          l="Phone"
          req
          v={f.phone}
          set={(x) => setF({ ...f, phone: x })}
        />
        <Input
          l="WhatsApp"
          v={f.whatsapp}
          set={(x) => setF({ ...f, whatsapp: x })}
        />
        <Input
          l="Email"
          type="email"
          v={f.email}
          set={(x) => setF({ ...f, email: x })}
        />
        <Input l="City" v={f.city} set={(x) => setF({ ...f, city: x })} />
        <Input l="State" v={f.state} set={(x) => setF({ ...f, state: x })} />
        <Select
          l="Status"
          v={f.status}
          set={(x) => setF({ ...f, status: x })}
          opts={["new", "contacted", "repeat", "inactive"]}
        />
        <Input
          l="Country"
          v={f.country}
          set={(x) => setF({ ...f, country: x })}
        />
        <Area
          l="Address"
          v={f.address}
          set={(x) => setF({ ...f, address: x })}
        />
        <Area l="Notes" v={f.notes} set={(x) => setF({ ...f, notes: x })} />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function OrderForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      buyer_id: val(r, "buyer_id"),
      status: val(r, "status", "pending"),
      payment_status: val(r, "payment_status", "unpaid"),
      assigned_agent_id: val(r, "assigned_agent_id"),
      delivery_address: val(r, "delivery_address"),
      delivery_city: val(r, "delivery_city"),
      delivery_state: val(r, "delivery_state"),
      customer_note: val(r, "customer_note"),
      delivery_fee: String(val(r, "delivery_fee", 0)),
    }),
    [items, setItems] = useState(
      r
        ? c.data.orderItems
            .filter((i) => i.order_id === r.id)
            .map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))
        : [],
    );
  const vars = c.data.variants;
  function addItem() {
    if (vars[0]) setItems([...items, { variant_id: vars[0].id, quantity: 1 }]);
  }
  async function save(e) {
    e.preventDefault();
    const lines = items.map((x) => {
        const v = vars.find((v) => v.id === x.variant_id),
          p = c.data.products.find((p) => p.id === v?.product_id);
        return {
          variant: v,
          product: p,
          qty: Number(x.quantity || 1),
          line: Number(v?.price || 0) * Number(x.quantity || 1),
        };
      }),
      subtotal = lines.reduce((s, x) => s + x.line, 0),
      fee = Number(f.delivery_fee || 0),
      payload = {
        buyer_id: f.buyer_id || null,
        assigned_agent_id: f.assigned_agent_id || null,
        status: f.status,
        payment_status: f.payment_status,
        fulfillment_status: r?.fulfillment_status || "unfulfilled",
        currency: "NGN",
        subtotal,
        discount_total: r?.discount_total || 0,
        delivery_fee: fee,
        total: subtotal + fee,
        delivery_address: f.delivery_address || null,
        delivery_city: f.delivery_city || null,
        delivery_state: f.delivery_state || null,
        delivery_country: "Nigeria",
        customer_note: f.customer_note || null,
        source: r?.source || "manual",
        site_id: r?.site_id || c.data.sites[0]?.id || null,
        order_number:
          r?.order_number ||
          `CRM-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      };
    let order;
    if (r) {
      order = await c.update(
        "crm_orders",
        r.id,
        payload,
        "Order updated",
        false,
      );
      if (!order) return;
      const old = c.data.orderItems.filter((i) => i.order_id === r.id);
      for (const x of old)
        await supabase
          .from("crm_order_items")
          .delete()
          .eq("id", x.id)
          .eq("workspace_id", c.workspace.id);
    } else {
      order = await c.insert("crm_orders", payload, "Order created", false);
      if (!order) return;
    }
    for (const x of lines)
      await supabase
        .from("crm_order_items")
        .insert({
          workspace_id: c.workspace.id,
          order_id: order.id,
          product_id: x.product?.id || null,
          variant_id: x.variant?.id || null,
          name: `${x.product?.name || "Product"} — ${x.variant?.name || "Package"}`,
          sku: x.variant?.sku || x.product?.sku || null,
          quantity: x.qty,
          unit_price: Number(x.variant?.price || 0),
          line_total: x.line,
          is_bump: false,
        });
    await c.refresh();
    close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Select
          l="Customer"
          req
          v={f.buyer_id}
          set={(x) => setF({ ...f, buyer_id: x })}
          opts={c.data.buyers.map((b) => ({
            value: b.id,
            label: `${b.name} · ${b.phone}`,
          }))}
          placeholder="Select customer"
        />
        <Select
          l="Assigned agent"
          v={f.assigned_agent_id}
          set={(x) => setF({ ...f, assigned_agent_id: x })}
          opts={c.data.agents.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="Unassigned"
        />
        <Select
          l="Order status"
          v={f.status}
          set={(x) => setF({ ...f, status: x })}
          opts={orderStatuses}
        />
        <Select
          l="Payment"
          v={f.payment_status}
          set={(x) => setF({ ...f, payment_status: x })}
          opts={paymentStatuses}
        />
        <Input
          l="Delivery city"
          v={f.delivery_city}
          set={(x) => setF({ ...f, delivery_city: x })}
        />
        <Input
          l="Delivery state"
          v={f.delivery_state}
          set={(x) => setF({ ...f, delivery_state: x })}
        />
        <Input
          l="Delivery fee"
          type="number"
          v={f.delivery_fee}
          set={(x) => setF({ ...f, delivery_fee: x })}
        />
        <Area
          l="Delivery address"
          v={f.delivery_address}
          set={(x) => setF({ ...f, delivery_address: x })}
        />
        <Area
          l="Customer note"
          v={f.customer_note}
          set={(x) => setF({ ...f, customer_note: x })}
        />
      </Grid>
      <div className="modal-section">
        <div className="section-title">
          <div>
            <strong>Order items</strong>
            <span>Choose packages and quantities</span>
          </div>
          <button type="button" onClick={addItem}>
            <Plus size={14} /> Add item
          </button>
        </div>
        {items.map((it, i) => (
          <div className="item-editor" key={i}>
            <select
              value={it.variant_id}
              onChange={(e) =>
                setItems(
                  items.map((x, j) =>
                    j === i ? { ...x, variant_id: e.target.value } : x,
                  ),
                )
              }
            >
              {vars.map((v) => {
                const p = c.data.products.find((p) => p.id === v.product_id);
                return (
                  <option key={v.id} value={v.id}>
                    {p?.name} — {v.name} · {money(v.price)}
                  </option>
                );
              })}
            </select>
            <input
              type="number"
              min="1"
              value={it.quantity}
              onChange={(e) =>
                setItems(
                  items.map((x, j) =>
                    j === i ? { ...x, quantity: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!vars.length && (
          <div className="form-help">
            Create a product/package first to add items.
          </div>
        )}
      </div>
      <Actions close={close} />
    </Form>
  );
}
function ProductForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      name: val(r, "name"),
      sku: val(r, "sku"),
      category: val(r, "category"),
      description: val(r, "description"),
      image_url: val(r, "image_url"),
      active: r?.active ?? true,
      track_inventory: r?.track_inventory ?? false,
      price: "",
      stock: "0",
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      name: f.name,
      sku: f.sku || null,
      category: f.category || null,
      description: f.description || null,
      image_url: f.image_url || null,
      active: f.active,
      track_inventory: f.track_inventory,
    };
    let prod = r
      ? await c.update("crm_products", r.id, p, "Product updated", false)
      : await c.insert("crm_products", p, "Product created", false);
    if (!prod) return;
    if (!r && f.price !== "")
      await supabase
        .from("crm_product_variants")
        .insert({
          workspace_id: c.workspace.id,
          product_id: prod.id,
          name: "Default",
          sku: f.sku || null,
          price: Number(f.price || 0),
          stock_qty: Number(f.stock || 0),
          active: true,
        });
    await c.refresh();
    close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Product name"
          req
          v={f.name}
          set={(x) => setF({ ...f, name: x })}
        />
        <Input l="SKU" v={f.sku} set={(x) => setF({ ...f, sku: x })} />
        <Input
          l="Category"
          v={f.category}
          set={(x) => setF({ ...f, category: x })}
        />
        <Input
          l="Image URL"
          v={f.image_url}
          set={(x) => setF({ ...f, image_url: x })}
        />
        {!r && (
          <>
            <Input
              l="Default price"
              type="number"
              v={f.price}
              set={(x) => setF({ ...f, price: x })}
            />
            <Input
              l="Starting stock"
              type="number"
              v={f.stock}
              set={(x) => setF({ ...f, stock: x })}
            />
          </>
        )}
        <Area
          l="Description"
          v={f.description}
          set={(x) => setF({ ...f, description: x })}
        />
        <CheckField
          label="Active"
          v={f.active}
          set={(x) => setF({ ...f, active: x })}
        />
        <CheckField
          label="Track inventory"
          v={f.track_inventory}
          set={(x) => setF({ ...f, track_inventory: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function VariantForm({ modal, close, c }) {
  const r = modal.record,
    p = modal.product,
    [f, setF] = useState({
      name: val(r, "name", "Default"),
      sku: val(r, "sku"),
      price: String(val(r, "price", 0)),
      compare: String(val(r, "compare_at_price", "")),
      stock: String(val(r, "stock_qty", 0)),
      active: r?.active ?? true,
    });
  async function save(e) {
    e.preventDefault();
    const q = {
      product_id: p.id,
      name: f.name,
      sku: f.sku || null,
      price: Number(f.price || 0),
      compare_at_price: f.compare === "" ? null : Number(f.compare),
      stock_qty: Number(f.stock || 0),
      active: f.active,
    };
    const ok = r
      ? await c.update("crm_product_variants", r.id, q, "Package updated")
      : await c.insert("crm_product_variants", q, "Package added");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Package name"
          req
          v={f.name}
          set={(x) => setF({ ...f, name: x })}
        />
        <Input l="SKU" v={f.sku} set={(x) => setF({ ...f, sku: x })} />
        <Input
          l="Price"
          type="number"
          req
          v={f.price}
          set={(x) => setF({ ...f, price: x })}
        />
        <Input
          l="Compare-at price"
          type="number"
          v={f.compare}
          set={(x) => setF({ ...f, compare: x })}
        />
        <Input
          l="Stock quantity"
          type="number"
          v={f.stock}
          set={(x) => setF({ ...f, stock: x })}
        />
        <CheckField
          label="Active"
          v={f.active}
          set={(x) => setF({ ...f, active: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function FormForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      title: val(r, "title"),
      slug: val(r, "slug"),
      subtitle: val(r, "subtitle"),
      submit_label: val(r, "submit_label", "Place order"),
      success_message: val(
        r,
        "success_message",
        "Your order has been received.",
      ),
      site_id: val(r, "site_id", c.data.sites[0]?.id || ""),
      published: r?.published ?? false,
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      ...f,
      slug: slugify(f.slug || f.title),
      site_id: f.site_id || null,
      settings: r?.settings || {},
      theme: r?.theme || {},
    };
    let form = r
      ? await c.update("crm_order_forms", r.id, p, "Form updated", false)
      : await c.insert("crm_order_forms", p, "Form created", false);
    if (!form) return;
    if (!r) {
      const defs = [
        ["name", "Full name", "text", true],
        ["phone", "Phone number", "tel", true],
        ["whatsapp", "WhatsApp number", "tel", false],
        ["address", "Delivery address", "textarea", true],
        ["state", "Delivery state", "text", true],
      ];
      for (let i = 0; i < defs.length; i++) {
        const [d, l, t, req] = defs[i];
        await supabase
          .from("crm_form_fields")
          .insert({
            workspace_id: c.workspace.id,
            form_id: form.id,
            field_key: d,
            label: l,
            field_type: t,
            required: req,
            sort_order: i + 1,
            active: true,
          });
      }
    }
    await c.refresh();
    close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Form title"
          req
          v={f.title}
          set={(x) => setF({ ...f, title: x, slug: r ? f.slug : slugify(x) })}
        />
        <Input
          l="URL slug"
          req
          v={f.slug}
          set={(x) => setF({ ...f, slug: x })}
        />
        <Select
          l="Website"
          v={f.site_id}
          set={(x) => setF({ ...f, site_id: x })}
          opts={c.data.sites.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="No site"
        />
        <Input
          l="Button text"
          v={f.submit_label}
          set={(x) => setF({ ...f, submit_label: x })}
        />
        <Area
          l="Subtitle"
          v={f.subtitle}
          set={(x) => setF({ ...f, subtitle: x })}
        />
        <Area
          l="Success message"
          v={f.success_message}
          set={(x) => setF({ ...f, success_message: x })}
        />
        <CheckField
          label="Published"
          v={f.published}
          set={(x) => setF({ ...f, published: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function FieldForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      label: val(r, "label"),
      field_key: val(r, "field_key"),
      field_type: val(r, "field_type", "text"),
      placeholder: val(r, "placeholder"),
      required: r?.required ?? false,
      options: Array.isArray(r?.options) ? r.options.join(", ") : "",
      active: r?.active ?? true,
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      form_id: modal.form.id,
      label: f.label,
      field_key: (f.field_key || slugify(f.label)).replaceAll("-", "_"),
      field_type: f.field_type,
      placeholder: f.placeholder || null,
      required: f.required,
      options: f.options
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      validation: r?.validation || {},
      maps_to: r?.maps_to || null,
      sort_order:
        r?.sort_order ??
        c.data.fields.filter((x) => x.form_id === modal.form.id).length + 1,
      active: f.active,
    };
    const ok = r
      ? await c.update("crm_form_fields", r.id, p, "Field updated")
      : await c.insert("crm_form_fields", p, "Field added");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Field label"
          req
          v={f.label}
          set={(x) =>
            setF({
              ...f,
              label: x,
              field_key: r ? f.field_key : slugify(x).replaceAll("-", "_"),
            })
          }
        />
        <Input
          l="Field key"
          req
          v={f.field_key}
          set={(x) => setF({ ...f, field_key: x })}
        />
        <Select
          l="Field type"
          v={f.field_type}
          set={(x) => setF({ ...f, field_type: x })}
          opts={[
            "text",
            "email",
            "tel",
            "textarea",
            "select",
            "radio",
            "checkbox",
            "date",
            "number",
            "hidden",
          ]}
        />
        <Input
          l="Placeholder"
          v={f.placeholder}
          set={(x) => setF({ ...f, placeholder: x })}
        />
        {["select", "radio"].includes(f.field_type) && (
          <Input
            l="Options"
            hint="Comma separated"
            v={f.options}
            set={(x) => setF({ ...f, options: x })}
          />
        )}
        <CheckField
          label="Required"
          v={f.required}
          set={(x) => setF({ ...f, required: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function AttachForm({ modal, close, c }) {
  const [v, setV] = useState(c.data.variants[0]?.id || ""),
    [price, setPrice] = useState("");
  async function save(e) {
    e.preventDefault();
    const ok = await c.insert(
      "crm_form_products",
      {
        form_id: modal.form.id,
        variant_id: v,
        offer_price: price === "" ? null : Number(price),
        default_quantity: 1,
        sort_order: c.data.formProducts.filter(
          (x) => x.form_id === modal.form.id,
        ).length,
        active: true,
      },
      "Package attached",
    );
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Select
        l="Package"
        req
        v={v}
        set={setV}
        opts={c.data.variants.map((x) => {
          const p = c.data.products.find((p) => p.id === x.product_id);
          return {
            value: x.id,
            label: `${p?.name} — ${x.name} · ${money(x.price)}`,
          };
        })}
        placeholder="Select package"
      />
      <Input
        l="Offer price"
        hint="Leave blank for package price"
        type="number"
        v={price}
        set={setPrice}
      />
      <Actions close={close} />
    </Form>
  );
}
function BumpForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      variant_id: val(r, "variant_id", c.data.variants[0]?.id || ""),
      title: val(r, "title"),
      description: val(r, "description"),
      offer_price: String(val(r, "offer_price", 0)),
      active: r?.active ?? true,
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      form_id: modal.form.id,
      variant_id: f.variant_id,
      title: f.title,
      description: f.description || null,
      offer_price: Number(f.offer_price || 0),
      sort_order: r?.sort_order ?? 0,
      active: f.active,
    };
    const ok = r
      ? await c.update("crm_order_bumps", r.id, p, "Bump updated")
      : await c.insert("crm_order_bumps", p, "Bump added");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Select
          l="Package"
          v={f.variant_id}
          set={(x) => setF({ ...f, variant_id: x })}
          opts={c.data.variants.map((x) => {
            const p = c.data.products.find((p) => p.id === x.product_id);
            return { value: x.id, label: `${p?.name} — ${x.name}` };
          })}
        />
        <Input
          l="Headline"
          req
          v={f.title}
          set={(x) => setF({ ...f, title: x })}
        />
        <Input
          l="Offer price"
          type="number"
          req
          v={f.offer_price}
          set={(x) => setF({ ...f, offer_price: x })}
        />
        <Area
          l="Description"
          v={f.description}
          set={(x) => setF({ ...f, description: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function AgentForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      name: val(r, "name"),
      company_name: val(r, "company_name"),
      email: val(r, "email"),
      phone: val(r, "phone"),
      whatsapp: val(r, "whatsapp"),
      states: (r?.states_covered || []).join(", "),
      status: val(r, "status", "active"),
      commission_type: val(r, "commission_type", "none"),
      commission_value: String(val(r, "commission_value", 0)),
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      name: f.name,
      company_name: f.company_name || null,
      email: f.email || null,
      phone: f.phone || null,
      whatsapp: f.whatsapp || null,
      country: "Nigeria",
      states_covered: f.states
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      status: f.status,
      commission_type: f.commission_type,
      commission_value: Number(f.commission_value || 0),
    };
    const ok = r
      ? await c.update("crm_agents", r.id, p, "Agent updated")
      : await c.insert("crm_agents", p, "Agent added");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Agent name"
          req
          v={f.name}
          set={(x) => setF({ ...f, name: x })}
        />
        <Input
          l="Company"
          v={f.company_name}
          set={(x) => setF({ ...f, company_name: x })}
        />
        <Input l="Phone" v={f.phone} set={(x) => setF({ ...f, phone: x })} />
        <Input
          l="WhatsApp"
          v={f.whatsapp}
          set={(x) => setF({ ...f, whatsapp: x })}
        />
        <Input
          l="Email"
          type="email"
          v={f.email}
          set={(x) => setF({ ...f, email: x })}
        />
        <Input
          l="States covered"
          hint="Comma separated"
          v={f.states}
          set={(x) => setF({ ...f, states: x })}
        />
        <Select
          l="Status"
          v={f.status}
          set={(x) => setF({ ...f, status: x })}
          opts={["active", "inactive", "suspended"]}
        />
        <Select
          l="Commission"
          v={f.commission_type}
          set={(x) => setF({ ...f, commission_type: x })}
          opts={["none", "fixed", "percent"]}
        />
        {f.commission_type !== "none" && (
          <Input
            l="Commission value"
            type="number"
            v={f.commission_value}
            set={(x) => setF({ ...f, commission_value: x })}
          />
        )}
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function FollowupForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      buyer_id: val(r, "buyer_id", modal.buyer?.id || ""),
      order_id: val(r, "order_id", modal.order?.id || ""),
      agent_id: val(r, "agent_id"),
      channel: val(r, "channel", "whatsapp"),
      due_at: dtLocal(
        val(r, "due_at", new Date(Date.now() + 3600000).toISOString()),
      ),
      status: val(r, "status", "pending"),
      note: val(r, "note"),
      outcome: val(r, "outcome"),
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      buyer_id: f.buyer_id || null,
      order_id: f.order_id || null,
      agent_id: f.agent_id || null,
      channel: f.channel,
      due_at: new Date(f.due_at).toISOString(),
      status: f.status,
      note: f.note || null,
      outcome: f.outcome || null,
      ...(f.status === "done"
        ? { completed_at: r?.completed_at || new Date().toISOString() }
        : {}),
    };
    const ok = r
      ? await c.update("crm_followups", r.id, p, "Follow-up updated")
      : await c.insert("crm_followups", p, "Follow-up scheduled");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Select
          l="Customer"
          v={f.buyer_id}
          set={(x) => setF({ ...f, buyer_id: x })}
          opts={c.data.buyers.map((b) => ({ value: b.id, label: b.name }))}
          placeholder="No customer"
        />
        <Select
          l="Order"
          v={f.order_id}
          set={(x) => setF({ ...f, order_id: x })}
          opts={c.data.orders.map((o) => ({
            value: o.id,
            label: o.order_number,
          }))}
          placeholder="No order"
        />
        <Select
          l="Agent"
          v={f.agent_id}
          set={(x) => setF({ ...f, agent_id: x })}
          opts={c.data.agents.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="Unassigned"
        />
        <Select
          l="Channel"
          v={f.channel}
          set={(x) => setF({ ...f, channel: x })}
          opts={["call", "whatsapp", "sms", "email", "other"]}
        />
        <Input
          l="Due"
          type="datetime-local"
          req
          v={f.due_at}
          set={(x) => setF({ ...f, due_at: x })}
        />
        <Select
          l="Status"
          v={f.status}
          set={(x) => setF({ ...f, status: x })}
          opts={["pending", "done", "snoozed", "cancelled"]}
        />
        <Area l="Task note" v={f.note} set={(x) => setF({ ...f, note: x })} />
        <Area
          l="Outcome"
          v={f.outcome}
          set={(x) => setF({ ...f, outcome: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function DeliveryForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      order_id: val(r, "order_id", modal.order?.id || ""),
      agent_id: val(r, "agent_id"),
      provider: val(r, "provider", "In-house"),
      rider_name: val(r, "rider_name"),
      rider_phone: val(r, "rider_phone"),
      tracking_code: val(r, "tracking_code"),
      fee: String(val(r, "fee", 0)),
      status: val(r, "status", "scheduled"),
      scheduled_for: dtLocal(
        val(r, "scheduled_for", new Date(Date.now() + 3600000).toISOString()),
      ),
      notes: val(r, "notes"),
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      order_id: f.order_id,
      agent_id: f.agent_id || null,
      provider: f.provider || null,
      rider_name: f.rider_name || null,
      rider_phone: f.rider_phone || null,
      tracking_code: f.tracking_code || null,
      fee: Number(f.fee || 0),
      status: f.status,
      scheduled_for: f.scheduled_for
        ? new Date(f.scheduled_for).toISOString()
        : null,
      notes: f.notes || null,
      ...(f.status === "delivered"
        ? { delivered_at: r?.delivered_at || new Date().toISOString() }
        : {}),
    };
    const ok = r
      ? await c.update("crm_deliveries", r.id, p, "Delivery updated", false)
      : await c.insert("crm_deliveries", p, "Delivery scheduled", false);
    if (!ok) return;
    if (f.order_id)
      await c.update(
        "crm_orders",
        f.order_id,
        {
          status: f.status === "delivered" ? "delivered" : "scheduled",
          fulfillment_status:
            f.status === "delivered" ? "delivered" : "scheduled",
          delivery_fee: Number(f.fee || 0),
        },
        "Order fulfillment updated",
        false,
      );
    await c.refresh();
    close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Select
          l="Order"
          req
          v={f.order_id}
          set={(x) => setF({ ...f, order_id: x })}
          opts={c.data.orders.map((o) => ({
            value: o.id,
            label: o.order_number,
          }))}
          placeholder="Select order"
        />
        <Select
          l="Agent"
          v={f.agent_id}
          set={(x) => setF({ ...f, agent_id: x })}
          opts={c.data.agents.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="No agent"
        />
        <Input
          l="Provider"
          v={f.provider}
          set={(x) => setF({ ...f, provider: x })}
        />
        <Input
          l="Rider name"
          v={f.rider_name}
          set={(x) => setF({ ...f, rider_name: x })}
        />
        <Input
          l="Rider phone"
          v={f.rider_phone}
          set={(x) => setF({ ...f, rider_phone: x })}
        />
        <Input
          l="Tracking code"
          v={f.tracking_code}
          set={(x) => setF({ ...f, tracking_code: x })}
        />
        <Input
          l="Fee"
          type="number"
          v={f.fee}
          set={(x) => setF({ ...f, fee: x })}
        />
        <Select
          l="Status"
          v={f.status}
          set={(x) => setF({ ...f, status: x })}
          opts={deliveryStatuses}
        />
        <Input
          l="Scheduled for"
          type="datetime-local"
          v={f.scheduled_for}
          set={(x) => setF({ ...f, scheduled_for: x })}
        />
        <Area l="Notes" v={f.notes} set={(x) => setF({ ...f, notes: x })} />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function CouponForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      code: val(r, "code"),
      discount_type: val(r, "discount_type", "percent"),
      discount_value: String(val(r, "discount_value", 10)),
      min_subtotal: String(val(r, "min_subtotal", 0)),
      max_uses: String(val(r, "max_uses", "")),
      starts_at: dtLocal(val(r, "starts_at", "")),
      ends_at: dtLocal(val(r, "ends_at", "")),
      active: r?.active ?? true,
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      code: f.code.toUpperCase(),
      discount_type: f.discount_type,
      discount_value: Number(f.discount_value || 0),
      min_subtotal: Number(f.min_subtotal || 0),
      max_uses: f.max_uses === "" ? null : Number(f.max_uses),
      uses_count: r?.uses_count || 0,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      active: f.active,
    };
    const ok = r
      ? await c.update("crm_coupons", r.id, p, "Coupon updated")
      : await c.insert("crm_coupons", p, "Coupon created");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Coupon code"
          req
          v={f.code}
          set={(x) => setF({ ...f, code: x })}
        />
        <Select
          l="Discount type"
          v={f.discount_type}
          set={(x) => setF({ ...f, discount_type: x })}
          opts={["percent", "fixed"]}
        />
        <Input
          l="Discount value"
          type="number"
          req
          v={f.discount_value}
          set={(x) => setF({ ...f, discount_value: x })}
        />
        <Input
          l="Minimum subtotal"
          type="number"
          v={f.min_subtotal}
          set={(x) => setF({ ...f, min_subtotal: x })}
        />
        <Input
          l="Max uses"
          type="number"
          v={f.max_uses}
          set={(x) => setF({ ...f, max_uses: x })}
        />
        <Input
          l="Starts"
          type="datetime-local"
          v={f.starts_at}
          set={(x) => setF({ ...f, starts_at: x })}
        />
        <Input
          l="Ends"
          type="datetime-local"
          v={f.ends_at}
          set={(x) => setF({ ...f, ends_at: x })}
        />
        <CheckField
          label="Active"
          v={f.active}
          set={(x) => setF({ ...f, active: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function AutomationForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      name: val(r, "name"),
      trigger_event: val(r, "trigger_event", "visitor.abandoned"),
      intent: String(r?.conditions?.intent_score_gte ?? 70),
      channel: r?.actions?.[0]?.channel || "whatsapp",
      delay: String(r?.actions?.[0]?.delay_minutes ?? 10),
      active: r?.active ?? true,
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      name: f.name,
      trigger_event: f.trigger_event,
      conditions: { intent_score_gte: Number(f.intent || 0) },
      actions: [
        {
          type: "create_followup",
          channel: f.channel,
          delay_minutes: Number(f.delay || 0),
        },
      ],
      active: f.active,
    };
    const ok = r
      ? await c.update("crm_automations", r.id, p, "Automation updated")
      : await c.insert("crm_automations", p, "Automation created");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Rule name"
          req
          v={f.name}
          set={(x) => setF({ ...f, name: x })}
        />
        <Select
          l="Trigger"
          v={f.trigger_event}
          set={(x) => setF({ ...f, trigger_event: x })}
          opts={[
            "visitor.abandoned",
            "visitor.identified",
            "order.created",
            "order.confirmed",
            "order.delivered",
          ]}
        />
        <Input
          l="Minimum intent score"
          type="number"
          v={f.intent}
          set={(x) => setF({ ...f, intent: x })}
        />
        <Select
          l="Follow-up channel"
          v={f.channel}
          set={(x) => setF({ ...f, channel: x })}
          opts={["whatsapp", "call", "sms", "email"]}
        />
        <Input
          l="Delay minutes"
          type="number"
          v={f.delay}
          set={(x) => setF({ ...f, delay: x })}
        />
        <CheckField
          label="Active"
          v={f.active}
          set={(x) => setF({ ...f, active: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function SiteForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      name: val(r, "name"),
      domain: val(r, "domain"),
      active: r?.active ?? true,
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      name: f.name,
      domain: f.domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      active: f.active,
      settings: r?.settings || {},
    };
    const ok = r
      ? await c.update("crm_sites", r.id, p, "Website updated")
      : await c.insert("crm_sites", p, "Website connected");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Website name"
          req
          v={f.name}
          set={(x) => setF({ ...f, name: x })}
        />
        <Input
          l="Domain"
          req
          v={f.domain}
          set={(x) => setF({ ...f, domain: x })}
        />
        <CheckField
          label="Active"
          v={f.active}
          set={(x) => setF({ ...f, active: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}
function WebhookForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      url: val(r, "url"),
      events: Array.isArray(r?.events)
        ? r.events.join(", ")
        : "order.created, order.updated, visitor.identified",
      active: r?.active ?? true,
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      url: f.url,
      events: f.events
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      active: f.active,
      secret_ref: r?.secret_ref || null,
    };
    const ok = r
      ? await c.update("crm_webhooks", r.id, p, "Webhook updated")
      : await c.insert("crm_webhooks", p, "Webhook added");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Webhook URL"
          type="url"
          req
          v={f.url}
          set={(x) => setF({ ...f, url: x })}
        />
        <Area l="Events" v={f.events} set={(x) => setF({ ...f, events: x })} />
        <CheckField
          label="Active"
          v={f.active}
          set={(x) => setF({ ...f, active: x })}
        />
      </Grid>
      <div className="form-help">
        Webhook signing and retry dispatch should be implemented server-side;
        this stores endpoint configuration only.
      </div>
      <Actions close={close} />
    </Form>
  );
}
function IntegrationForm({ modal, close, c }) {
  const r = modal.record,
    [f, setF] = useState({
      name: val(r, "name", modal.kind?.replace("_", " ")),
      active: r?.active ?? true,
      mode: r?.config?.mode || "",
      public_id: r?.config?.public_id || "",
    });
  async function save(e) {
    e.preventDefault();
    const p = {
      integration_type: modal.kind || r.integration_type,
      name: f.name,
      active: f.active,
      config: { mode: f.mode, public_id: f.public_id },
      secret_ref: r?.secret_ref || null,
    };
    const ok = r
      ? await c.update("crm_integrations", r.id, p, "Integration updated")
      : await c.insert("crm_integrations", p, "Integration configured");
    if (ok) close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input l="Name" req v={f.name} set={(x) => setF({ ...f, name: x })} />
        <Input
          l="Mode / environment"
          v={f.mode}
          set={(x) => setF({ ...f, mode: x })}
        />
        <Input
          l="Public ID / sender ID"
          v={f.public_id}
          set={(x) => setF({ ...f, public_id: x })}
        />
        <CheckField
          label="Active"
          v={f.active}
          set={(x) => setF({ ...f, active: x })}
        />
      </Grid>
      <div className="form-help">
        Do not put API secrets here. Store credentials in a server-side secret
        manager.
      </div>
      <Actions close={close} />
    </Form>
  );
}
function WorkspaceForm({ close, c }) {
  const [f, setF] = useState({
    name: c.workspace.name,
    currency: c.workspace.currency || "NGN",
    timezone: c.workspace.timezone || "Africa/Lagos",
  });
  async function save(e) {
    e.preventDefault();
    await c.saveWorkspace(f);
    close();
  }
  return (
    <Form onSubmit={save}>
      <Grid>
        <Input
          l="Workspace name"
          req
          v={f.name}
          set={(x) => setF({ ...f, name: x })}
        />
        <Input
          l="Currency"
          v={f.currency}
          set={(x) => setF({ ...f, currency: x })}
        />
        <Input
          l="Timezone"
          v={f.timezone}
          set={(x) => setF({ ...f, timezone: x })}
        />
      </Grid>
      <Actions close={close} />
    </Form>
  );
}

function Drawer({ drawer, close, ctx: c }) {
  let r;
  if (drawer.kind === "visitor")
    r = c.data.visitors.find((x) => x.id === drawer.id);
  if (drawer.kind === "customer")
    r = c.data.buyers.find((x) => x.id === drawer.id);
  if (drawer.kind === "order")
    r = c.data.orders.find((x) => x.id === drawer.id);
  if (drawer.kind === "product")
    r = c.data.products.find((x) => x.id === drawer.id);
  if (drawer.kind === "agent")
    r = c.data.agents.find((x) => x.id === drawer.id);
  if (drawer.kind === "followup")
    r = c.data.followups.find((x) => x.id === drawer.id);
  if (drawer.kind === "delivery")
    r = c.data.deliveries.find((x) => x.id === drawer.id);
  if (!r) return null;
  return (
    <div
      className="drawer-wrap"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <aside className="drawer">
        <div className="drawer-top">
          <div>
            <span>{drawer.kind}</span>
            <h3>{drawerTitle(drawer.kind, r)}</h3>
          </div>
          <button onClick={close}>
            <X size={18} />
          </button>
        </div>
        <DrawerBody kind={drawer.kind} r={r} c={c} close={close} />
      </aside>
    </div>
  );
}
const drawerTitle = (k, r) =>
  k === "visitor"
    ? r.name || r.phone || "Visitor"
    : k === "customer"
      ? r.name
      : k === "order"
        ? r.order_number
        : k === "product"
          ? r.name
          : k === "agent"
            ? r.name
            : k === "followup"
              ? "Follow-up"
              : k === "delivery"
                ? "Delivery"
                : "Details";
function DrawerBody({ kind, r, c, close }) {
  if (kind === "visitor")
    return (
      <>
        <div className="intent-hero">
          <Intent n={r.intent_score} />
          <div>
            <strong>{r.status}</strong>
            <span>
              {r.last_event_type?.replaceAll("_", " ")} · {r.event_count || 0}{" "}
              events
            </span>
          </div>
        </div>
        <D title="Contact">
          <Details
            x={[
              ["Name", r.name],
              ["Phone", r.phone],
              ["WhatsApp", r.whatsapp],
              ["Email", r.email],
              ["Address", r.address],
              [
                "Location",
                [r.city, r.state, r.country].filter(Boolean).join(", "),
              ],
            ]}
          />
        </D>
        <D title="Captured form data">
          <div className="answer-list">
            {Object.entries(r.form_data || {})
              .filter(([, v]) => v !== null && v !== "")
              .map(([k, v]) => (
                <div key={k}>
                  <span>{k.replaceAll("_", " ")}</span>
                  <strong>
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </strong>
                </div>
              ))}
          </div>
        </D>
        <D title="Attribution">
          <Details
            x={[
              ["Source", r.utm_source],
              ["Medium", r.utm_medium],
              ["Campaign", r.utm_campaign],
              ["Campaign ID", r.utm_id],
              ["TikTok click ID", r.ttclid],
              ["Referrer", r.referrer],
              ["Website", r.source_website],
              ["Last page", r.last_page_url],
              ["Device", r.device ? JSON.stringify(r.device) : null],
            ]}
          />
        </D>
        <div className="drawer-actions">
          {r.phone && (
            <a className="outline-btn" href={`tel:${r.phone}`}>
              <Phone size={14} /> Call
            </a>
          )}
          {(r.whatsapp || r.phone) && (
            <a
              className="outline-btn"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${String(r.whatsapp || r.phone).replace(/\D/g, "")}`}
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {isInternalTest(r) ? (
            <span className="status status-internal">Internal test</span>
          ) : (
            <>
              <button
                className="outline-btn"
                onClick={async () => {
                  await c.markLeadContacted(r.id);
                  close();
                }}
              >
                <Phone size={14} /> Mark contacted
              </button>
              {r.status === "submitted" && (
                <button
                  className="primary-btn"
                  onClick={async () => {
                    const result = await c.convertLead(r.id);
                    if (result) close();
                  }}
                >
                  <ShoppingBag size={14} /> Convert to order
                </button>
              )}
            </>
          )}
        </div>
      </>
    );
  if (kind === "customer") {
    const orders = c.data.orders.filter((o) => o.buyer_id === r.id),
      fu = c.data.followups.filter((f) => f.buyer_id === r.id);
    return (
      <>
        <D title="Customer profile">
          <Details
            x={[
              ["Phone", r.phone],
              ["WhatsApp", r.whatsapp],
              ["Email", r.email],
              [
                "Location",
                [r.city, r.state, r.country].filter(Boolean).join(", "),
              ],
              ["Address", r.address],
              ["Status", r.status],
              ["Orders", r.order_count || 0],
              ["Lifetime value", money(r.total_spent)],
              ["Notes", r.notes],
            ]}
          />
        </D>
        <D title="Orders">
          <div className="stack-list">
            {orders.map((o) => (
              <button
                className="mini-row mini-button"
                key={o.id}
                onClick={() => c.details("order", o.id)}
              >
                <div className="round-icon">
                  <ShoppingBag size={15} />
                </div>
                <div>
                  <strong>{o.order_number}</strong>
                  <span>
                    {money(o.total)} · {o.status}
                  </span>
                </div>
                <ChevronRight size={14} />
              </button>
            ))}
            {!orders.length && <Empty compact label="No orders" />}
          </div>
        </D>
        <D title="Follow-ups">
          <div className="stack-list">
            {fu.map((f) => (
              <div className="mini-row" key={f.id}>
                <div className="round-icon">
                  <MessageCircle size={15} />
                </div>
                <div>
                  <strong>{f.note || "Follow-up"}</strong>
                  <span>
                    {f.channel} · {fmtDate(f.due_at)}
                  </span>
                </div>
                <Status v={f.status} />
              </div>
            ))}
          </div>
        </D>
        <div className="drawer-actions">
          {r.payment_status !== "paid" && (
            <button
              className="outline-btn"
              onClick={async () => {
                const result = await c.markOrderPaid(r);
                if (result) close();
              }}
            >
              <CircleDollarSign size={14} /> Mark paid
            </button>
          )}
          {r.status !== "delivered" && (
            <button
              className="primary-btn"
              onClick={async () => {
                const result = await c.markOrderDelivered(r);
                if (result) close();
              }}
            >
              <Check size={14} /> Mark delivered
            </button>
          )}
          <button
            className="outline-btn"
            onClick={() => c.open("customer", { record: r })}
          >
            <Edit3 size={14} /> Edit
          </button>
          <button
            className="outline-btn"
            onClick={() => c.open("followup", { buyer: r })}
          >
            <MessageCircle size={14} /> Follow-up
          </button>
          <button
            className="primary-btn"
            onClick={() => c.open("order", { record: null, buyer: r })}
          >
            <ShoppingBag size={14} /> New order
          </button>
        </div>
      </>
    );
  }
  if (kind === "order") {
    const b = c.data.buyers.find((x) => x.id === r.buyer_id),
      items = c.data.orderItems.filter((i) => i.order_id === r.id),
      del = c.data.deliveries.find((d) => d.order_id === r.id);
    return (
      <>
        <D title="Order">
          <Details
            x={[
              ["Customer", b?.name],
              ["Phone", b?.phone],
              ["Status", r.status],
              ["Payment", r.payment_status],
              [
                "Agent",
                c.data.agents.find((a) => a.id === r.assigned_agent_id)?.name,
              ],
              ["Delivery state", r.delivery_state],
              ["Address", r.delivery_address],
              ["Customer note", r.customer_note],
            ]}
          />
        </D>
        <D title="Items">
          <div className="order-lines">
            {items.map((i) => (
              <div key={i.id}>
                <div>
                  <strong>{i.name}</strong>
                  <span>
                    {i.quantity} × {money(i.unit_price)}
                  </span>
                </div>
                <b>{money(i.line_total)}</b>
              </div>
            ))}
          </div>
          <div className="totals">
            <div>
              <span>Subtotal</span>
              <b>{money(r.subtotal)}</b>
            </div>
            <div>
              <span>Delivery</span>
              <b>{money(r.delivery_fee)}</b>
            </div>
            <div>
              <span>Total</span>
              <strong>{money(r.total)}</strong>
            </div>
          </div>
        </D>
        <D title="Fulfillment">
          {del ? (
            <button
              className="mini-row mini-button"
              onClick={() => c.details("delivery", del.id)}
            >
              <div className="round-icon">
                <Truck size={15} />
              </div>
              <div>
                <strong>{del.provider || "Delivery"}</strong>
                <span>
                  {del.status} · {del.rider_name || "no rider"}
                </span>
              </div>
              <ChevronRight size={14} />
            </button>
          ) : (
            <Empty compact label="No delivery scheduled" />
          )}
        </D>
        <div className="drawer-actions">
          <button
            className="outline-btn"
            onClick={() => c.open("order", { record: r })}
          >
            <Edit3 size={14} /> Edit
          </button>
          <button
            className="outline-btn"
            onClick={() => c.open("followup", { order: r, buyer: b })}
          >
            <MessageCircle size={14} /> Follow-up
          </button>
          <button
            className="primary-btn"
            onClick={() => c.open("delivery", { order: r })}
          >
            <Truck size={14} /> {del ? "New delivery" : "Schedule delivery"}
          </button>
        </div>
      </>
    );
  }
  if (kind === "product") {
    const vs = c.data.variants.filter((v) => v.product_id === r.id);
    return (
      <>
        <D title="Product">
          <Details
            x={[
              ["SKU", r.sku],
              ["Category", r.category],
              ["Description", r.description],
              ["Inventory tracking", r.track_inventory ? "On" : "Off"],
              ["Status", r.active ? "Active" : "Inactive"],
            ]}
          />
        </D>
        <D title="Packages">
          <div className="variant-drawer-list">
            {vs.map((v) => (
              <button
                key={v.id}
                onClick={() => c.open("variant", { product: r, record: v })}
              >
                <div>
                  <strong>{v.name}</strong>
                  <span>
                    {v.sku || "No SKU"} · {v.stock_qty} stock
                  </span>
                </div>
                <b>{money(v.price)}</b>
                <Edit3 size={14} />
              </button>
            ))}
            {!vs.length && <Empty compact label="No packages" />}
          </div>
        </D>
        <div className="drawer-actions">
          <button
            className="outline-btn"
            onClick={() => c.open("product", { record: r })}
          >
            <Edit3 size={14} /> Edit product
          </button>
          <button
            className="primary-btn"
            onClick={() => c.open("variant", { product: r })}
          >
            <PackagePlus size={14} /> Add package
          </button>
        </div>
      </>
    );
  }
  if (kind === "agent") {
    const orders = c.data.orders.filter((o) => o.assigned_agent_id === r.id),
      del = c.data.deliveries.filter((d) => d.agent_id === r.id);
    return (
      <>
        <D title="Agent">
          <Details
            x={[
              ["Company", r.company_name],
              ["Phone", r.phone],
              ["WhatsApp", r.whatsapp],
              ["Email", r.email],
              ["Coverage", (r.states_covered || []).join(", ")],
              ["Status", r.status],
              [
                "Commission",
                r.commission_type === "none"
                  ? "None"
                  : `${r.commission_type} ${r.commission_value}`,
              ],
            ]}
          />
        </D>
        <D title="Workload">
          <Details
            x={[
              ["Assigned orders", orders.length],
              ["Deliveries", del.length],
              [
                "Open deliveries",
                del.filter(
                  (d) =>
                    !["delivered", "returned", "failed", "cancelled"].includes(
                      d.status,
                    ),
                ).length,
              ],
            ]}
          />
        </D>
        <div className="drawer-actions">
          <button
            className="primary-btn"
            onClick={() => c.open("agent", { record: r })}
          >
            <Edit3 size={14} /> Edit agent
          </button>
        </div>
      </>
    );
  }
  if (kind === "followup") {
    const b = c.data.buyers.find((x) => x.id === r.buyer_id);
    return (
      <>
        <D title="Task">
          <Details
            x={[
              ["Customer", b?.name],
              ["Channel", r.channel],
              ["Due", fmtDate(r.due_at)],
              ["Status", r.status],
              ["Note", r.note],
              ["Outcome", r.outcome],
            ]}
          />
        </D>
        <div className="drawer-actions">
          <button
            className="outline-btn"
            onClick={() => c.open("followup", { record: r })}
          >
            <Edit3 size={14} /> Edit
          </button>
          {r.status === "pending" && (
            <button
              className="primary-btn"
              onClick={async () => {
                await c.update(
                  "crm_followups",
                  r.id,
                  { status: "done", completed_at: new Date().toISOString() },
                  "Completed",
                );
                close();
              }}
            >
              <Check size={14} /> Mark done
            </button>
          )}
        </div>
      </>
    );
  }
  if (kind === "delivery") {
    const o = c.data.orders.find((x) => x.id === r.order_id);
    return (
      <>
        <D title="Delivery">
          <Details
            x={[
              ["Order", o?.order_number],
              ["Provider", r.provider],
              ["Rider", r.rider_name],
              ["Rider phone", r.rider_phone],
              ["Tracking code", r.tracking_code],
              ["Fee", money(r.fee)],
              ["Status", r.status],
              ["Scheduled", fmtDate(r.scheduled_for)],
              ["Notes", r.notes],
            ]}
          />
        </D>
        <div className="drawer-actions">
          <button
            className="primary-btn"
            onClick={() => c.open("delivery", { record: r })}
          >
            <Edit3 size={14} /> Edit delivery
          </button>
        </div>
      </>
    );
  }
  return null;
}
const D = ({ title, children }) => (
  <section className="detail-section">
    <h4>{title}</h4>
    {children}
  </section>
);
const Details = ({ x }) => (
  <dl className="detail-grid">
    {x
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{String(v)}</dd>
        </div>
      ))}
  </dl>
);

const Form = ({ onSubmit, children }) => (
  <form className="crud-form" onSubmit={onSubmit}>
    {children}
  </form>
);
const Grid = ({ children }) => <div className="form-grid">{children}</div>;
const Input = ({ l, hint, v, set, type = "text", req = false }) => (
  <label className="form-field">
    <span>
      {l}
      {hint && <small>{hint}</small>}
    </span>
    <input
      required={req}
      type={type}
      value={v ?? ""}
      onChange={(e) => set(e.target.value)}
    />
  </label>
);
const Area = ({ l, v, set }) => (
  <label className="form-field form-span">
    <span>{l}</span>
    <textarea value={v ?? ""} onChange={(e) => set(e.target.value)} />
  </label>
);
const Select = ({ l, v, set, opts = [], placeholder, req = false }) => (
  <label className="form-field">
    <span>{l}</span>
    <select
      required={req}
      value={v ?? ""}
      onChange={(e) => set(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o.replaceAll("_", " ")}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  </label>
);
const CheckField = ({ label, v, set }) => (
  <label className="switch-field">
    <input
      type="checkbox"
      checked={!!v}
      onChange={(e) => set(e.target.checked)}
    />
    <span>
      <b>{label}</b>
    </span>
  </label>
);
const Actions = ({ close }) => (
  <div className="modal-actions">
    <button type="button" className="outline-btn" onClick={close}>
      Cancel
    </button>
    <button type="submit" className="primary-btn">
      <Save size={15} /> Save
    </button>
  </div>
);
const Panel = ({ title, action, children, noPad = false }) => (
  <div className={`panel ${noPad ? "panel-no-pad" : ""}`}>
    {(title || action) && (
      <div className="panel-head">
        <h3>{title}</h3>
        {action && <span>{action}</span>}
      </div>
    )}
    {children}
  </div>
);
const Head = ({ title, copy, button, onClick, right }) => (
  <div className="page-head">
    <div>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
    {right ||
      (button && (
        <button className="primary-btn" onClick={onClick}>
          <Plus size={17} />
          {button}
        </button>
      ))}
  </div>
);
const Status = ({ v }) => {
  const s = String(v || "unknown").toLowerCase();
  return (
    <span className={`status status-${s.replace(/[^a-z0-9]/g, "-")}`}>
      {s.replaceAll("_", " ")}
    </span>
  );
};
const Empty = ({
  label = "Nothing here yet",
  compact = false,
  action,
  onAction,
}) => (
  <div className={`empty ${compact ? "compact" : ""}`}>
    <ClipboardList size={compact ? 20 : 28} />
    <strong>{label}</strong>
    {action && (
      <button className="outline-btn" onClick={onAction}>
        <Plus size={14} />
        {action}
      </button>
    )}
  </div>
);
const filter = (rows, q, keys) =>
  !q?.trim()
    ? rows
    : rows.filter((r) =>
        keys.some((k) =>
          String(r[k] ?? "")
            .toLowerCase()
            .includes(q.toLowerCase()),
        ),
      );
const isInternalTest = (row) =>
  Boolean(
    row?.form_data?.internal_test ||
      row?.metadata?.internal_test ||
      row?.attribution?.internal_test ||
      (Array.isArray(row?.tags) && row.tags.includes("internal_test")),
  );

function PublicOrderForm({ slug }) {
  const params = new URLSearchParams(window.location.search),
    siteKey = params.get("site_key"),
    [form, setForm] = useState(null),
    [error, setError] = useState(null),
    [values, setValues] = useState({}),
    [qty, setQty] = useState({}),
    [bumps, setBumps] = useState([]),
    [coupon, setCoupon] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [done, setDone] = useState(null),
    visitor = useRef(
      localStorage.getItem("usecrm_visitor_id") || crypto.randomUUID(),
    ),
    sess = useRef(
      sessionStorage.getItem("usecrm_session_id") || crypto.randomUUID(),
    ),
    timer = useRef(null);
  useEffect(() => {
    localStorage.setItem("usecrm_visitor_id", visitor.current);
    sessionStorage.setItem("usecrm_session_id", sess.current);
    load();
  }, [slug, siteKey]);
  async function load() {
    if (!siteKey) {
      setError("This order-form link is missing its site key.");
      return;
    }
    const { data, error } = await supabase.rpc("crm_get_public_form", {
      p_site_key: siteKey,
      p_slug: slug,
    });
    if (error || !data) {
      setError(error?.message || "Order form not found.");
      return;
    }
    setForm(data);
    const initial = {};
    (data.products || []).forEach(
      (p, i) => (initial[p.variant_id] = i === 0 ? p.default_quantity || 1 : 0),
    );
    setQty(initial);
    track("page_view", {});
  }
  async function track(event, next) {
    if (!siteKey) return;
    const fields = Object.keys(next || values).filter((k) =>
      String((next || values)[k] ?? "").trim(),
    );
    await supabase.rpc("crm_track_event", {
      p_site_key: siteKey,
      p_visitor_id: visitor.current,
      p_session_id: sess.current,
      p_page_url: window.location.href,
      p_form_name: slug,
      p_event_type: event,
      p_fields_touched: fields,
      p_form_data: {
        ...(next || values),
        referrer: document.referrer || null,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_id: params.get("utm_id"),
      ttclid: params.get("ttclid"),
      },
    });
  }
  function change(k, v) {
    const n = { ...values, [k]: v };
    setValues(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => track("form_progress", n), 500);
  }
  async function submit(e) {
    e.preventDefault();
    const items = Object.entries(qty)
      .filter(([, q]) => Number(q) > 0)
      .map(([variant_id, quantity]) => ({
        variant_id,
        quantity: Number(quantity),
      }));
    if (!items.length) return setError("Select at least one package.");
    setSubmitting(true);
    const payload = {
      customer: {
        name: values.name,
        phone: values.phone,
        email: values.email,
        whatsapp: values.whatsapp,
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country || "Nigeria",
      },
      items,
      bumps,
      coupon_code: coupon,
      payment_method: values.payment_method,
      payment_readiness: values.payment_readiness,
      delivery_date: values.delivery_date,
      delivery_window: values.delivery_window,
      delivery_address: values.address,
      delivery_city: values.city,
      delivery_state: values.state,
      answers: values,
      attribution: {
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
      },
    };
    const { data, error } = await supabase.rpc("crm_submit_public_order", {
      p_site_key: siteKey,
      p_form_slug: slug,
      p_payload: payload,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(data);
  }
  if (error && !form)
    return (
      <PublicShell>
        <div className="public-message">
          <X size={28} />
          <h2>Order form unavailable</h2>
          <p>{error}</p>
        </div>
      </PublicShell>
    );
  if (!form)
    return (
      <PublicShell>
        <Loading />
      </PublicShell>
    );
  if (done)
    return (
      <PublicShell>
        <div className="public-message success">
          <Check size={30} />
          <h2>{done.success_message || "Order received"}</h2>
          <p>
            Your order number is <strong>{done.order_number}</strong>.
          </p>
          <div className="public-total">
            <span>Total</span>
            <strong>{money(done.total)}</strong>
          </div>
        </div>
      </PublicShell>
    );
  return (
    <PublicShell>
      <div className="checkout-card">
        <div className="checkout-head">
          <div className="brand">
            <div className="brand-mark">u</div>
            <div>
              <strong>Secure order</strong>
              <span>Powered by useCRM</span>
            </div>
          </div>
          <span className="secure-pill">Live checkout</span>
        </div>
        <div className="checkout-title">
          <h1>{form.title}</h1>
          {form.subtitle && <p>{form.subtitle}</p>}
        </div>
      <form onSubmit={submit} onFocus={() => track("form_field_focus", values)}>
          <div className="public-fields">
            {(form.fields || []).map((f) => (
              <PublicField
                key={f.id}
                field={f}
                value={values[f.key] || ""}
                onChange={(v) => change(f.key, v)}
              />
            ))}
          </div>
          <div className="checkout-section">
            <h3>Choose your package</h3>
            {(form.products || []).map((p) => (
              <label
                className={`package-option ${Number(qty[p.variant_id]) > 0 ? "selected" : ""}`}
                key={p.variant_id}
              >
                <input
                  type="radio"
                  name="package"
                  checked={Number(qty[p.variant_id]) > 0}
                  onChange={() =>
                    setQty(
                      Object.fromEntries(
                        (form.products || []).map((x) => [
                          x.variant_id,
                          x.variant_id === p.variant_id
                            ? p.default_quantity || 1
                            : 0,
                        ]),
                      ),
                    )
                  }
                />
                <div className="package-image">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" />
                  ) : (
                    <ShoppingBag size={24} />
                  )}
                </div>
                <div>
                  <strong>{p.product_name}</strong>
                  <span>{p.variant_name}</span>
                </div>
                <b>{money(p.price)}</b>
              </label>
            ))}
          </div>
          {(form.bumps || []).length > 0 && (
            <div className="checkout-section bump-section">
              <div className="bump-heading">
                <Sparkles size={18} />
                <div>
                  <strong>Special add-on</strong>
                </div>
              </div>
              {form.bumps.map((b) => (
                <label className="bump-option" key={b.id}>
                  <input
                    type="checkbox"
                    checked={bumps.includes(b.id)}
                    onChange={(e) =>
                      setBumps(
                        e.target.checked
                          ? [...bumps, b.id]
                          : bumps.filter((x) => x !== b.id),
                      )
                    }
                  />
                  <div>
                    <strong>{b.title}</strong>
                    <span>
                      {b.description || `${b.product_name} — ${b.variant_name}`}
                    </span>
                  </div>
                  <b>+ {money(b.price)}</b>
                </label>
              ))}
            </div>
          )}
          <div className="coupon-entry">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="Coupon code"
            />
            <BadgePercent size={18} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="place-order" disabled={submitting}>
            {submitting ? (
              <Loader2 className="spin" size={19} />
            ) : (
              <ShoppingBag size={19} />
            )}{" "}
            {form.submit_label || "Place order"}
          </button>
        </form>
      </div>
    </PublicShell>
  );
}
function PublicField({ field, value, onChange }) {
  const common = {
    value,
    onChange: (e) =>
      onChange(
        e.target.type === "checkbox" ? e.target.checked : e.target.value,
      ),
    required: field.required,
    placeholder: field.placeholder || field.label,
  };
  if (field.type === "textarea")
    return (
      <label className="field">
        <span>{field.label}</span>
        <textarea {...common} />
      </label>
    );
  if (["select", "radio"].includes(field.type)) {
    const o = Array.isArray(field.options) ? field.options : [];
    return (
      <label className="field">
        <span>{field.label}</span>
        <select {...common}>
          <option value="">Select…</option>
          {o.map((x) => (
            <option
              key={typeof x === "string" ? x : x.value}
              value={typeof x === "string" ? x : x.value}
            >
              {typeof x === "string" ? x : x.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "checkbox")
    return (
      <label className="check-field">
        <input type="checkbox" checked={!!value} onChange={common.onChange} />
        <span>{field.label}</span>
      </label>
    );
  return (
    <label className="field">
      <span>{field.label}</span>
      <input type={field.type || "text"} {...common} />
    </label>
  );
}
const PublicShell = ({ children }) => (
  <div className="public-page">
    <div className="public-bg" />
    {children}
  </div>
);
