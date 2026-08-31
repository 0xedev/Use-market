import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, BadgePercent, BarChart3, BellRing, Boxes, Check, CircleDollarSign,
  ClipboardList, Copy, ExternalLink, FileText, Flame, Globe2, LayoutDashboard, Loader2, LogOut,
  Menu, MessageCircle, PackageCheck, Plus, RefreshCw, Search, Settings, ShoppingBag, Sparkles,
  Truck, UserRoundCheck, Users, WandSparkles, Webhook, X
} from 'lucide-react'
import { supabase } from './supabase'
import './styles.css'

const money = (v = 0) => `₦${Number(v || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
const date = (v) => v ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—'
const slugify = (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const ORDER_STATUSES = ['pending','contacted','confirmed','scheduled','awaiting','dispatched','delivered','returned','cancelled','failed']

const emptyData = {
  visitors: [], buyers: [], orders: [], products: [], variants: [], forms: [], fields: [], formProducts: [], bumps: [],
  agents: [], followups: [], deliveries: [], coupons: [], automations: [], integrations: [], webhooks: [], sites: [], activities: [], payments: []
}

const demoData = {
  visitors: [
    { id:'v1', name:'Amina K.', phone:'080•••2144', source_website:'store.example', status:'identified', intent_score:92, last_event_type:'form_progress', last_seen_at:new Date().toISOString(), fields_touched:['name','phone','state','address','package'] },
    { id:'v2', name:null, phone:null, source_website:'store.example', status:'started', intent_score:46, last_event_type:'field_started', last_seen_at:new Date(Date.now()-120000).toISOString(), fields_touched:['name','phone'] },
    { id:'v3', name:'Tobi A.', phone:'081•••9801', source_website:'store.example', status:'submitted', intent_score:100, last_event_type:'form_submitted', last_seen_at:new Date(Date.now()-240000).toISOString(), fields_touched:['name','phone','whatsapp','address','state','package'] },
  ],
  buyers: [
    { id:'b1', name:'Tobi A.', phone:'081•••9801', whatsapp:'081•••9801', source_website:'store.example', order_count:2, total_spent:97000, status:'repeat', created_at:new Date().toISOString() },
    { id:'b2', name:'Amina K.', phone:'080•••2144', source_website:'store.example', order_count:0, total_spent:0, status:'new', created_at:new Date().toISOString() },
  ],
  orders: [
    { id:'o1', order_number:'CRM-260901-A1B2C3D4', status:'confirmed', payment_status:'unpaid', total:52000, delivery_state:'Lagos', created_at:new Date().toISOString(), buyer_id:'b1' },
    { id:'o2', order_number:'CRM-260831-F8E7D6C5', status:'delivered', payment_status:'paid', total:45000, delivery_state:'Oyo', created_at:new Date(Date.now()-86400000).toISOString(), buyer_id:'b1' },
  ],
  products: [{ id:'p1', name:'Walking Pad Pro', sku:'WP-PRO', category:'Fitness', active:true, track_inventory:true, created_at:new Date().toISOString() }],
  variants: [{ id:'pv1', product_id:'p1', name:'Standard Package', price:52000, compare_at_price:65000, stock_qty:18, active:true }],
  forms: [{ id:'f1', title:'Walking Pad Order Form', slug:'walking-pad', published:true, submit_label:'Order now', success_message:'Order received. We will call you shortly.', settings:{ delivery_fee:2500, prepaid_discount_percent:5 } }],
  fields: [
    { id:'ff1', form_id:'f1', field_key:'name', label:'Full name', field_type:'text', required:true, sort_order:1 },
    { id:'ff2', form_id:'f1', field_key:'phone', label:'Phone number', field_type:'tel', required:true, sort_order:2 },
    { id:'ff3', form_id:'f1', field_key:'whatsapp', label:'WhatsApp number', field_type:'tel', required:false, sort_order:3 },
    { id:'ff4', form_id:'f1', field_key:'address', label:'Delivery address', field_type:'textarea', required:true, sort_order:4 },
  ],
  formProducts: [{ id:'fp1', form_id:'f1', variant_id:'pv1', default_quantity:1, active:true }],
  bumps: [{ id:'ob1', form_id:'f1', variant_id:'pv1', title:'Add a second unit', description:'One-time bundle offer', offer_price:41000, active:true }],
  agents: [{ id:'a1', name:'Delivery Team Lagos', phone:'080•••6612', whatsapp:'080•••6612', states_covered:['Lagos'], status:'active', commission_type:'fixed', commission_value:1500 }],
  followups: [{ id:'fu1', channel:'whatsapp', due_at:new Date(Date.now()+3600000).toISOString(), status:'pending', note:'Recover abandoned checkout', buyer_id:'b2' }],
  deliveries: [{ id:'d1', order_id:'o1', provider:'In-house', rider_name:'Assigned rider', fee:2500, status:'scheduled', scheduled_for:new Date(Date.now()+7200000).toISOString() }],
  coupons: [{ id:'c1', code:'WELCOME5', discount_type:'percent', discount_value:5, uses_count:12, max_uses:100, active:true }],
  automations: [{ id:'au1', name:'Recover checkout', trigger_event:'visitor.abandoned', conditions:{ intent_score_gte:70 }, actions:[{ type:'create_followup', delay_minutes:10 }], active:true }],
  integrations: [{ id:'i1', integration_type:'whatsapp', name:'WhatsApp follow-up', active:true }],
  webhooks: [], sites: [{ id:'s1', name:'Demo Store', domain:'store.example', public_key:'demo_public_key', active:true }], activities: [], payments: []
}

const nav = [
  ['Overview', LayoutDashboard], ['Live Visitors', Flame], ['Orders', ShoppingBag], ['Customers', Users], ['Products', Boxes],
  ['Order Forms', FileText], ['Agents', UserRoundCheck], ['Follow-ups', MessageCircle], ['Deliveries', Truck], ['Coupons', BadgePercent],
  ['Automations', WandSparkles], ['Analytics', BarChart3], ['Integrations', Webhook], ['Settings', Settings]
]

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [demo, setDemo] = useState(false)
  const [workspace, setWorkspace] = useState(null)
  const [role, setRole] = useState(null)
  const [data, setData] = useState(emptyData)
  const [page, setPage] = useState('Overview')
  const [loading, setLoading] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')

  const publicFormMatch = window.location.pathname.match(/^\/form\/([^/]+)$/)
  if (publicFormMatch) return <PublicOrderForm slug={decodeURIComponent(publicFormMatch[1])} />

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setAuthLoading(false) })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (demo) { setWorkspace({ id:'demo', name:'useCRM Preview', currency:'NGN', timezone:'Africa/Lagos' }); setRole('owner'); setData(demoData); return }
    if (!session?.user) { setWorkspace(null); setData(emptyData); return }
    bootstrap()
  }, [session, demo])

  async function bootstrap() {
    setLoading(true)
    const { data: member, error } = await supabase.from('crm_workspace_members').select('workspace_id,role').eq('user_id', session.user.id).limit(1).maybeSingle()
    if (error || !member) { notify(error?.message || 'No CRM workspace is attached to this account.'); setLoading(false); return }
    const { data: ws } = await supabase.from('crm_workspaces').select('*').eq('id', member.workspace_id).single()
    setWorkspace(ws); setRole(member.role)
    await loadAll(member.workspace_id)
    setLoading(false)
  }

  async function loadAll(workspaceId = workspace?.id) {
    if (!workspaceId || workspaceId === 'demo') return
    setLoading(true)
    const tables = {
      visitors:'crm_visitors', buyers:'crm_buyers', orders:'crm_orders', products:'crm_products', variants:'crm_product_variants', forms:'crm_order_forms', fields:'crm_form_fields',
      formProducts:'crm_form_products', bumps:'crm_order_bumps', agents:'crm_agents', followups:'crm_followups', deliveries:'crm_deliveries', coupons:'crm_coupons',
      automations:'crm_automations', integrations:'crm_integrations', webhooks:'crm_webhooks', sites:'crm_sites', activities:'crm_activities', payments:'crm_payments'
    }
    const entries = await Promise.all(Object.entries(tables).map(async ([key, table]) => {
      let q = supabase.from(table).select('*').eq('workspace_id', workspaceId)
      if (['visitors','buyers','orders','followups','deliveries','activities'].includes(key)) q = q.order(key === 'visitors' ? 'last_seen_at' : key === 'followups' ? 'due_at' : 'created_at', { ascending:false }).limit(500)
      const { data: rows, error } = await q
      if (error) console.error(table, error)
      return [key, rows || []]
    }))
    setData(Object.fromEntries(entries)); setLoading(false)
  }

  function notify(message) { setToast(message); setTimeout(() => setToast(null), 2800) }

  async function signInGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin } })
    if (error) notify(error.message)
  }

  async function emailLink() {
    const email = window.prompt('Email address for a secure sign-in link')
    if (!email) return
    const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo:window.location.origin } })
    notify(error ? error.message : 'Check your email for the sign-in link.')
  }

  async function signOut() { if (demo) { setDemo(false); return } await supabase.auth.signOut() }

  async function insert(table, payload, label='Saved') {
    if (demo) { notify(`${label} in preview mode`); return { id:crypto.randomUUID(), ...payload } }
    const { data: row, error } = await supabase.from(table).insert({ workspace_id:workspace.id, ...payload }).select().single()
    if (error) { notify(error.message); return null }
    notify(label); await loadAll(); return row
  }

  async function update(table, id, patch, label='Updated') {
    if (demo) {
      setData(prev => ({
        ...prev,
        orders: table==='crm_orders' ? prev.orders.map(x=>x.id===id?{...x,...patch}:x) : prev.orders,
        forms: table==='crm_order_forms' ? prev.forms.map(x=>x.id===id?{...x,...patch}:x) : prev.forms,
        followups: table==='crm_followups' ? prev.followups.map(x=>x.id===id?{...x,...patch}:x) : prev.followups,
        deliveries: table==='crm_deliveries' ? prev.deliveries.map(x=>x.id===id?{...x,...patch}:x) : prev.deliveries,
      }))
      notify(`${label} in preview mode`); return
    }
    const { error } = await supabase.from(table).update(patch).eq('id', id).eq('workspace_id', workspace.id)
    if (error) notify(error.message); else { notify(label); await loadAll() }
  }

  async function addProduct() {
    const name = window.prompt('Product name'); if (!name) return
    const price = Number(window.prompt('Default selling price (NGN)', '0')); if (!Number.isFinite(price) || price < 0) return notify('Enter a valid price.')
    const sku = window.prompt('SKU (optional)', '') || null
    if (demo) {
      const pid=crypto.randomUUID(), vid=crypto.randomUUID()
      setData(p=>({...p,products:[{id:pid,name,sku,active:true,track_inventory:false,created_at:new Date().toISOString()},...p.products],variants:[{id:vid,product_id:pid,name:'Default',price,stock_qty:0,active:true},...p.variants]}))
      notify('Product added in preview mode'); return
    }
    const product = await insert('crm_products',{ name, sku, active:true },'Product created'); if (!product) return
    await insert('crm_product_variants',{ product_id:product.id, name:'Default', sku, price, active:true },'Default package created')
  }

  async function addAgent() {
    const name=window.prompt('Agent or delivery company name'); if(!name)return
    const phone=window.prompt('Phone number','')||null
    const whatsapp=window.prompt('WhatsApp number',phone||'')||null
    const states=(window.prompt('States covered, comma separated','Lagos')||'').split(',').map(x=>x.trim()).filter(Boolean)
    const row={name,phone,whatsapp,states_covered:states,status:'active',commission_type:'none',commission_value:0}
    if(demo){setData(p=>({...p,agents:[{id:crypto.randomUUID(),...row},...p.agents]}));notify('Agent added in preview mode');return}
    await insert('crm_agents',row,'Agent added')
  }

  async function addCoupon() {
    const code=(window.prompt('Coupon code','SAVE10')||'').trim().toUpperCase(); if(!code)return
    const type=window.confirm('OK = percentage discount. Cancel = fixed amount.')?'percent':'fixed'
    const value=Number(window.prompt(type==='percent'?'Percentage':'Discount amount','10')); if(!Number.isFinite(value))return
    const row={code,discount_type:type,discount_value:value,active:true,uses_count:0}
    if(demo){setData(p=>({...p,coupons:[{id:crypto.randomUUID(),...row},...p.coupons]}));notify('Coupon added in preview mode');return}
    await insert('crm_coupons',row,'Coupon created')
  }

  async function addForm() {
    const title=window.prompt('Order form title','New Order Form'); if(!title)return
    const slug=slugify(window.prompt('Public URL slug',slugify(title))||slugify(title))
    const site=data.sites[0]
    const row={site_id:site?.id||null,title,slug,published:false,submit_label:'Place order',success_message:'Your order has been received.',settings:{currency:'NGN'}}
    if(demo){const id=crypto.randomUUID();setData(p=>({...p,forms:[{id,...row},...p.forms]}));notify('Form created in preview mode');return}
    const form=await insert('crm_order_forms',row,'Order form created'); if(!form)return
    const defaults=[['name','Full name','text',true],['phone','Phone number','tel',true],['whatsapp','WhatsApp number','tel',false],['address','Delivery address','textarea',true],['state','Delivery state','text',true]]
    for(let i=0;i<defaults.length;i++){
      const [field_key,label,field_type,required]=defaults[i]
      await supabase.from('crm_form_fields').insert({workspace_id:workspace.id,form_id:form.id,field_key,label,field_type,required,sort_order:i+1})
    }
    await loadAll()
  }

  async function addField(form) {
    const label=window.prompt('Field label','Delivery date'); if(!label)return
    const key=slugify(window.prompt('Field key',slugify(label))||slugify(label)).replace(/-/g,'_')
    const type=window.prompt('Type: text, tel, email, textarea, select, radio, checkbox, date, number','text')||'text'
    await insert('crm_form_fields',{form_id:form.id,field_key:key,label,field_type:type,required:false,sort_order:data.fields.filter(x=>x.form_id===form.id).length+1},'Field added')
  }

  async function attachVariant(form, bump=false) {
    if(!data.variants.length)return notify('Create a product first.')
    const list=data.variants.map((v,i)=>`${i+1}. ${data.products.find(p=>p.id===v.product_id)?.name||'Product'} — ${v.name} (${money(v.price)})`).join('\n')
    const idx=Number(window.prompt(`Choose package:\n${list}`,'1'))-1
    const variant=data.variants[idx]; if(!variant)return
    if(bump){
      const title=window.prompt('Order bump headline','Add this special offer')||'Special offer'
      const price=Number(window.prompt('Bump price',variant.price))
      await insert('crm_order_bumps',{form_id:form.id,variant_id:variant.id,title,offer_price:price,active:true},'Order bump added')
    } else {
      await insert('crm_form_products',{form_id:form.id,variant_id:variant.id,default_quantity:1,active:true},'Package attached')
    }
  }

  async function addFollowup() {
    if(!data.buyers.length)return notify('No customers yet.')
    const buyer=data.buyers[0]
    const channel=window.prompt('Channel: call, whatsapp, sms, email','whatsapp')||'whatsapp'
    const note=window.prompt(`Follow-up note for ${buyer.name}`,'Confirm order / recover checkout')||''
    const due=new Date(Date.now()+30*60000).toISOString()
    const row={buyer_id:buyer.id,channel,due_at:due,status:'pending',note}
    if(demo){setData(p=>({...p,followups:[{id:crypto.randomUUID(),...row},...p.followups]}));notify('Follow-up added in preview mode');return}
    await insert('crm_followups',row,'Follow-up scheduled')
  }

  async function addDelivery() {
    const order=data.orders.find(o=>!['delivered','returned','cancelled'].includes(o.status)); if(!order)return notify('No eligible order.')
    const provider=window.prompt('Delivery provider','In-house')||'In-house'
    const rider_name=window.prompt('Rider name (optional)','')||null
    const fee=Number(window.prompt('Delivery fee','0')||0)
    const row={order_id:order.id,provider,rider_name,fee,status:'scheduled',scheduled_for:new Date(Date.now()+3600000).toISOString()}
    if(demo){setData(p=>({...p,deliveries:[{id:crypto.randomUUID(),...row},...p.deliveries]}));notify('Delivery scheduled in preview mode');return}
    await insert('crm_deliveries',row,'Delivery scheduled')
    await update('crm_orders',order.id,{status:'scheduled',fulfillment_status:'scheduled',delivery_fee:fee,total:Number(order.total||0)+fee},'Order scheduled')
  }

  async function addAutomation() {
    const name=window.prompt('Automation name','Recover hot abandoned checkout'); if(!name)return
    const trigger=window.prompt('Trigger event','visitor.abandoned')||'visitor.abandoned'
    const row={name,trigger_event:trigger,conditions:{intent_score_gte:70},actions:[{type:'create_followup',channel:'whatsapp',delay_minutes:10}],active:true}
    if(demo){setData(p=>({...p,automations:[{id:crypto.randomUUID(),...row},...p.automations]}));notify('Automation added in preview mode');return}
    await insert('crm_automations',row,'Automation created')
  }

  if(authLoading) return <Splash />
  if(!session && !demo) return <Login onGoogle={signInGoogle} onEmail={emailLink} onPreview={()=>setDemo(true)} />

  const ctx={ workspace,role,data,setData,search,setSearch,demo,insert,update,notify,addProduct,addAgent,addCoupon,addForm,addField,attachVariant,addFollowup,addDelivery,addAutomation,refresh:()=>loadAll() }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'open':''}`}>
      <div className="brand"><div className="brand-mark">u</div><div><strong>useCRM</strong><span>Commerce intelligence</span></div><button className="mobile-close" onClick={()=>setMobileNav(false)}><X size={20}/></button></div>
      <nav>{nav.map(([name,Icon])=><button key={name} className={page===name?'active':''} onClick={()=>{setPage(name);setMobileNav(false)}}><Icon size={18}/><span>{name}</span>{name==='Live Visitors'&&<b className="nav-count">{data.visitors.filter(v=>v.intent_score>=70&&v.status!=='submitted').length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="workspace-pill"><div className="avatar">{workspace?.name?.[0]||'U'}</div><div><strong>{workspace?.name||'useCRM'}</strong><span>{role||'owner'} · {demo?'preview':'live'}</span></div></div><button className="logout" onClick={signOut}><LogOut size={17}/> {demo?'Exit preview':'Sign out'}</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="top-left"><button className="menu-button" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div><p>Workspace</p><h1>{page}</h1></div></div><div className="top-actions"><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search current view"/></div><button className="icon-btn" title="Refresh" onClick={()=>loadAll()}><RefreshCw size={17} className={loading?'spin':''}/></button><button className="icon-btn"><BellRing size={17}/></button><div className="user-dot">{(session?.user?.email||'P')[0].toUpperCase()}</div></div></header>
      {demo&&<div className="demo-banner"><Sparkles size={16}/><span>You are viewing the rebuilt CRM in preview mode. Sign in to use live data.</span><button onClick={()=>setDemo(false)}>Sign in</button></div>}
      <section className="content">{loading&&!demo?<LoadingCard/>:<Page page={page} ctx={ctx}/>}</section>
    </main>
    {toast&&<div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function Login({onGoogle,onEmail,onPreview}) {
  return <div className="login-page"><div className="login-orb orb-a"/><div className="login-orb orb-b"/><div className="login-card">
    <div className="brand login-brand"><div className="brand-mark">u</div><div><strong>useCRM</strong><span>Commerce intelligence</span></div></div>
    <div className="eyebrow"><Sparkles size={15}/> Sniper-style operations + buyer intent</div><h1>Turn every visitor into an opportunity.</h1><p className="login-copy">Track buyer intent before checkout, manage orders, agents, deliveries, follow-ups, products, coupons and high-converting order forms in one workspace.</p>
    <button className="auth-btn google" onClick={onGoogle}><span className="google-g">G</span> Continue with Google</button>
    <button className="auth-btn secondary" onClick={onEmail}>Continue with email link</button>
    <div className="auth-divider"><span>or</span></div><button className="preview-btn" onClick={onPreview}>Preview the rebuilt dashboard <ExternalLink size={15}/></button>
    <p className="auth-note">Google OAuth is wired through Supabase Auth. Your existing ChatGPT Sites sign-in can remain available during migration.</p>
  </div><div className="login-proof"><div><Flame size={22}/><strong>Intent before submission</strong><span>See partial checkout data and hot abandoned buyers.</span></div><div><PackageCheck size={22}/><strong>Full order operations</strong><span>Confirm, assign, deliver, return and follow up.</span></div><div><WandSparkles size={22}/><strong>Conversion tools</strong><span>Packages, coupons, bumps and prepaid incentives.</span></div></div></div>
}

function Splash(){return <div className="splash"><div className="brand-mark">u</div><Loader2 className="spin"/></div>}
function LoadingCard(){return <div className="loading-card"><Loader2 className="spin"/><span>Loading live CRM data…</span></div>}

function Page({page,ctx}) {
  const map={
    Overview:<Overview ctx={ctx}/>, 'Live Visitors':<Visitors ctx={ctx}/>, Orders:<Orders ctx={ctx}/>, Customers:<Customers ctx={ctx}/>, Products:<Products ctx={ctx}/>,
    'Order Forms':<OrderForms ctx={ctx}/>, Agents:<Agents ctx={ctx}/>, 'Follow-ups':<Followups ctx={ctx}/>, Deliveries:<Deliveries ctx={ctx}/>, Coupons:<Coupons ctx={ctx}/>,
    Automations:<Automations ctx={ctx}/>, Analytics:<Analytics ctx={ctx}/>, Integrations:<Integrations ctx={ctx}/>, Settings:<SettingsPage ctx={ctx}/>
  }
  return map[page] || map.Overview
}

function Overview({ctx:{data}}){
  const delivered=data.orders.filter(o=>o.status==='delivered')
  const revenue=delivered.reduce((s,o)=>s+Number(o.total||0),0)
  const hot=data.visitors.filter(v=>v.intent_score>=70&&v.status!=='submitted')
  const cards=[['Hot buyer intent',hot.length,Flame,'Visitors ready for recovery'],['Orders',data.orders.length,ShoppingBag,`${data.orders.filter(o=>o.status==='pending').length} awaiting confirmation`],['Delivered revenue',money(revenue),CircleDollarSign,`${delivered.length} delivered orders`],['Customers',data.buyers.length,Users,`${data.buyers.filter(b=>b.order_count>1).length} repeat buyers`]]
  return <>
    <div className="hero"><div><div className="eyebrow"><Activity size={14}/> Live commerce command center</div><h2>Know who wants to buy — then close the order.</h2><p>Buyer intent, orders, confirmation, delivery and repeat sales in one pipeline.</p></div><div className="hero-score"><span>Intent engine</span><strong>{hot.length?Math.round(hot.reduce((s,v)=>s+v.intent_score,0)/hot.length):0}</strong><small>avg hot lead score</small></div></div>
    <div className="metric-grid">{cards.map(([title,value,Icon,sub])=><div className="metric" key={title}><div className="metric-icon"><Icon size={19}/></div><div><span>{title}</span><strong>{value}</strong><small>{sub}</small></div></div>)}</div>
    <div className="split-grid"><Panel title="Order pipeline" action="Live"><Pipeline orders={data.orders}/></Panel><Panel title="Highest intent visitors" action={`${hot.length} recoverable`}><div className="stack-list">{(hot.length?hot:data.visitors).slice(0,5).map(v=><VisitorRow v={v} key={v.id}/>)}</div></Panel></div>
    <div className="split-grid"><Panel title="Upcoming follow-ups" action="Next actions"><div className="stack-list">{data.followups.filter(f=>f.status==='pending').slice(0,5).map(f=><div className="mini-row" key={f.id}><div className="round-icon"><MessageCircle size={16}/></div><div><strong>{f.note||'Customer follow-up'}</strong><span>{f.channel} · {date(f.due_at)}</span></div><Status value={f.status}/></div>)}</div></Panel><Panel title="Delivery health" action="Operations"><div className="delivery-summary"><div><strong>{data.deliveries.filter(d=>d.status==='delivered').length}</strong><span>Delivered</span></div><div><strong>{data.deliveries.filter(d=>['scheduled','awaiting','picked_up','in_transit'].includes(d.status)).length}</strong><span>In progress</span></div><div><strong>{data.deliveries.filter(d=>['returned','failed'].includes(d.status)).length}</strong><span>Exception</span></div></div></Panel></div>
  </>
}

function Pipeline({orders}){return <div className="pipeline">{['pending','confirmed','scheduled','dispatched','delivered','returned'].map(s=><div key={s}><span>{s}</span><strong>{orders.filter(o=>o.status===s).length}</strong><i style={{width:`${Math.min(100,orders.length?orders.filter(o=>o.status===s).length/orders.length*100:0)}%`}}/></div>)}</div>}
function VisitorRow({v}){return <div className="mini-row"><div className={`intent-ring ${v.intent_score>=70?'hot':''}`}>{v.intent_score}</div><div><strong>{v.name||v.phone||'Anonymous visitor'}</strong><span>{v.last_event_type?.replaceAll('_',' ')} · {v.source_website}</span></div><Status value={v.status}/></div>}

function Visitors({ctx:{data,search}}){
  const rows=filterRows(data.visitors,search,['name','phone','email','source_website','status'])
  return <Panel title="Live buyer intent" subtitle="Real-time checkout behavior, including visitors who leave without submitting." action={`${rows.length} sessions`}><div className="table-wrap"><table><thead><tr><th>Buyer</th><th>Intent</th><th>Progress</th><th>Website</th><th>Status</th><th>Last seen</th></tr></thead><tbody>{rows.map(v=><tr key={v.id}><td><strong>{v.name||'Unknown'}</strong><small>{v.phone||v.email||'Not identified yet'}</small></td><td><div className="intent-cell"><b>{v.intent_score}</b><span><i style={{width:`${v.intent_score}%`}}/></span></div></td><td>{Array.isArray(v.fields_touched)?[...new Set(v.fields_touched)].length:0} fields</td><td>{v.source_website}</td><td><Status value={v.status}/></td><td>{date(v.last_seen_at)}</td></tr>)}</tbody></table></div></Panel>
}

function Orders({ctx:{data,search,update}}){
  const rows=filterRows(data.orders,search,['order_number','status','payment_status','delivery_state'])
  return <Panel title="Orders" subtitle="Confirm, schedule, dispatch, deliver or return every order." action={`${rows.length} orders`}><div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Delivery</th><th>Status</th><th>Created</th></tr></thead><tbody>{rows.map(o=>{const buyer=data.buyers.find(b=>b.id===o.buyer_id);return <tr key={o.id}><td><strong>{o.order_number}</strong><small>{o.source||'form'}</small></td><td>{buyer?.name||'Customer'}</td><td><strong>{money(o.total)}</strong></td><td><Status value={o.payment_status}/></td><td>{o.delivery_state||o.delivery_city||'—'}</td><td><select className="status-select" value={o.status} onChange={e=>update('crm_orders',o.id,{status:e.target.value},'Order status updated')}>{ORDER_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td><td>{date(o.created_at)}</td></tr>})}</tbody></table></div></Panel>
}

function Customers({ctx:{data,search}}){
  const rows=filterRows(data.buyers,search,['name','phone','email','whatsapp','source_website','status'])
  return <Panel title="Customers" subtitle="Unified buyer profile, order history, spend and contact details." action={`${rows.length} customers`}><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Location</th><th>Orders</th><th>Lifetime value</th><th>Status</th></tr></thead><tbody>{rows.map(b=><tr key={b.id}><td><strong>{b.name}</strong><small>{b.source_website}</small></td><td>{b.phone}<small>{b.whatsapp?`WA ${b.whatsapp}`:b.email||''}</small></td><td>{[b.city,b.state,b.country].filter(Boolean).join(', ')||'—'}</td><td>{b.order_count}</td><td><strong>{money(b.total_spent)}</strong></td><td><Status value={b.status}/></td></tr>)}</tbody></table></div></Panel>
}

function Products({ctx:{data,search,addProduct}}){
  const rows=filterRows(data.products,search,['name','sku','category'])
  return <>
    <PageHead title="Products & packages" copy="Create products, package variations, prices and stock." button="Add product" onClick={addProduct}/>
    <div className="card-grid">{rows.map(p=>{
      const vars=data.variants.filter(v=>v.product_id===p.id)
      return <div className="product-card" key={p.id}><div className="product-image">{p.image_url?<img src={p.image_url}/>:<Boxes size={30}/>}</div><div className="product-body"><div className="row-between"><strong>{p.name}</strong><Status value={p.active?'active':'inactive'}/></div><span>{p.sku||p.category||'No SKU'}</span><div className="variant-list">{vars.map(v=><div key={v.id}><span>{v.name}</span><strong>{money(v.price)}</strong><small>{p.track_inventory?`${v.stock_qty} in stock`:'Stock tracking off'}</small></div>)}</div></div></div>
    })}</div>
    {!rows.length&&<Empty label="No products yet"/>}
  </>
}

function OrderForms({ctx}){
  const {data,search,addForm,addField,attachVariant,update}=ctx
  const [selected,setSelected]=useState(null)
  const forms=filterRows(data.forms,search,['title','slug'])
  const active=selected?data.forms.find(f=>f.id===selected):forms[0]
  return <>
    <PageHead title="Order forms" copy="Sniper-style configurable checkout forms with packages, coupons, bumps and payment incentives." button="Create form" onClick={addForm}/>
    <div className="forms-layout">
      <div className="form-list">{forms.map(f=><button className={`form-list-item ${active?.id===f.id?'active':''}`} key={f.id} onClick={()=>setSelected(f.id)}><div><strong>{f.title}</strong><span>/form/{f.slug}</span></div><Status value={f.published?'published':'draft'}/></button>)}</div>
      {active?<div className="form-editor">
        <div className="editor-head"><div><span>Form builder</span><h3>{active.title}</h3><p>{active.subtitle||'Configure fields, products and conversion offers.'}</p></div><button className="outline-btn" onClick={()=>update('crm_order_forms',active.id,{published:!active.published},active.published?'Form unpublished':'Form published')}>{active.published?'Unpublish':'Publish'}</button></div>
        <div className="editor-section"><div className="section-title"><div><strong>Customer fields</strong><span>Capture the information your sales team needs.</span></div><button onClick={()=>addField(active)}><Plus size={15}/> Field</button></div>{data.fields.filter(x=>x.form_id===active.id).sort((a,b)=>a.sort_order-b.sort_order).map(x=><div className="builder-row" key={x.id}><span className="drag">⋮⋮</span><div><strong>{x.label}</strong><small>{x.field_type} · {x.field_key}</small></div>{x.required&&<b>Required</b>}</div>)}</div>
        <div className="editor-section"><div className="section-title"><div><strong>Products & packages</strong><span>Selectable packages shown on the order form.</span></div><button onClick={()=>attachVariant(active,false)}><Plus size={15}/> Package</button></div>{data.formProducts.filter(x=>x.form_id===active.id).map(x=>{
          const v=data.variants.find(v=>v.id===x.variant_id)
          const p=data.products.find(p=>p.id===v?.product_id)
          return <div className="builder-row" key={x.id}><PackageCheck size={18}/><div><strong>{p?.name||'Product'} — {v?.name}</strong><small>{money(x.offer_price??v?.price)}</small></div></div>
        })}</div>
        <div className="editor-section highlight"><div className="section-title"><div><strong>Order bumps / upsells</strong><span>One-click add-ons before the order is submitted.</span></div><button onClick={()=>attachVariant(active,true)}><Plus size={15}/> Bump</button></div>{data.bumps.filter(x=>x.form_id===active.id).map(x=><div className="builder-row" key={x.id}><Sparkles size={18}/><div><strong>{x.title}</strong><small>{money(x.offer_price)} · one-time offer</small></div></div>)}</div>
        <div className="editor-foot"><span>Public endpoint</span><code>/form/{active.slug}?site_key={'<site-key>'}</code></div>
      </div>:<Empty label="Create your first order form"/>}
    </div>
  </>
}

function Agents({ctx:{data,search,addAgent}}){
  const rows=filterRows(data.agents,search,['name','company_name','phone','email'])
  return <><PageHead title="Agents" copy="Sales and delivery agents, coverage, assignment and commission settings." button="Add agent" onClick={addAgent}/><div className="card-grid compact">{rows.map(a=><div className="agent-card" key={a.id}><div className="avatar lg">{a.name?.[0]}</div><div><strong>{a.name}</strong><span>{a.company_name||a.phone||'Agent'}</span><div className="chips">{(a.states_covered||[]).slice(0,4).map(s=><b key={s}>{s}</b>)}</div></div><Status value={a.status}/></div>)}</div>{!rows.length&&<Empty label="No agents yet"/>}</>
}

function Followups({ctx:{data,search,addFollowup,update}}){
  const rows=filterRows(data.followups,search,['channel','status','note','outcome'])
  return <><PageHead title="Follow-ups" copy="Call and WhatsApp recovery tasks for pending orders and abandoned buyers." button="Schedule follow-up" onClick={addFollowup}/><Panel><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Channel</th><th>Task</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(f=>{const b=data.buyers.find(x=>x.id===f.buyer_id);return <tr key={f.id}><td><strong>{b?.name||'Customer'}</strong><small>{b?.phone||''}</small></td><td><Status value={f.channel}/></td><td>{f.note||'Follow up'}</td><td>{date(f.due_at)}</td><td><Status value={f.status}/></td><td>{f.status==='pending'&&<button className="tiny-btn" onClick={()=>update('crm_followups',f.id,{status:'done',completed_at:new Date().toISOString()},'Follow-up completed')}>Done</button>}</td></tr>})}</tbody></table></div></Panel></>
}

function Deliveries({ctx:{data,search,addDelivery,update}}){
  const rows=filterRows(data.deliveries,search,['provider','rider_name','tracking_code','status'])
  return <><PageHead title="Deliveries" copy="Schedule riders, track fulfillment fees and close delivered or returned orders." button="Schedule delivery" onClick={addDelivery}/><div className="delivery-board">{['scheduled','awaiting','picked_up','in_transit','delivered','returned'].map(status=><div className="delivery-col" key={status}><div className="col-head"><span>{status.replace('_',' ')}</span><b>{rows.filter(d=>d.status===status).length}</b></div>{rows.filter(d=>d.status===status).map(d=><div className="delivery-card" key={d.id}><strong>{d.provider||'Delivery'}</strong><span>{d.rider_name||'No rider name'} · {money(d.fee)}</span><small>{date(d.scheduled_for||d.created_at)}</small>{!['delivered','returned'].includes(status)&&<button onClick={()=>update('crm_deliveries',d.id,{status:status==='in_transit'?'delivered':'in_transit',delivered_at:status==='in_transit'?new Date().toISOString():null},'Delivery updated')}>{status==='in_transit'?'Mark delivered':'Move in transit'}</button>}</div>)}</div>)}</div></>
}

function Coupons({ctx:{data,search,addCoupon}}){
  const rows=filterRows(data.coupons,search,['code','discount_type'])
  return <><PageHead title="Coupons" copy="Discount codes with percentage/fixed values, usage limits and validity windows." button="Create coupon" onClick={addCoupon}/><div className="coupon-grid">{rows.map(c=><div className="coupon" key={c.id}><div className="coupon-notch left"/><div className="coupon-notch right"/><span>COUPON</span><strong>{c.code}</strong><h3>{c.discount_type==='percent'?`${c.discount_value}% off`:money(c.discount_value)}</h3><small>{c.uses_count||0}{c.max_uses?` / ${c.max_uses}`:''} uses</small><Status value={c.active?'active':'inactive'}/></div>)}</div>{!rows.length&&<Empty label="No coupons yet"/>}</>
}

function Automations({ctx:{data,addAutomation}}){
  return <><PageHead title="Automations" copy="Trigger recovery, assignments and follow-ups from buyer and order events." button="New automation" onClick={addAutomation}/><div className="automation-list">{data.automations.map(a=><div className="automation" key={a.id}><div className="automation-icon"><WandSparkles size={20}/></div><div><strong>{a.name}</strong><span>When <b>{a.trigger_event}</b></span></div><div className="automation-flow"><code>{JSON.stringify(a.conditions)}</code><span>→</span><code>{Array.isArray(a.actions)?a.actions.map(x=>x.type).join(', '):'action'}</code></div><Status value={a.active?'active':'paused'}/></div>)}</div>{!data.automations.length&&<Empty label="No automations yet"/>}</>
}

function Analytics({ctx:{data}}){
  const submitted=data.visitors.filter(v=>v.status==='submitted').length
  const started=data.visitors.filter(v=>v.status!=='anonymous').length
  const identified=data.visitors.filter(v=>['identified','submitted'].includes(v.status)).length
  const delivered=data.orders.filter(o=>o.status==='delivered').length
  const revenue=data.orders.filter(o=>o.status==='delivered').reduce((s,o)=>s+Number(o.total||0),0)
  const rate=(a,b)=>b?`${Math.round(a/b*100)}%`:'0%'
  return <><PageHead title="Analytics" copy="See the whole funnel from anonymous traffic to delivered revenue."/><div className="funnel"><FunnelStep label="Visitors" value={data.visitors.length} width={100}/><FunnelStep label="Started checkout" value={started} width={82}/><FunnelStep label="Identified" value={identified} width={67}/><FunnelStep label="Submitted" value={submitted} width={54}/><FunnelStep label="Orders" value={data.orders.length} width={42}/><FunnelStep label="Delivered" value={delivered} width={30}/></div><div className="metric-grid analytics"><Metric title="Checkout identification" value={rate(identified,started)} sub="started → identifiable"/><Metric title="Submission conversion" value={rate(submitted,started)} sub="started → submitted"/><Metric title="Delivery rate" value={rate(delivered,data.orders.length)} sub="orders → delivered"/><Metric title="Delivered revenue" value={money(revenue)} sub="recognized sales"/></div></>
}
function FunnelStep({label,value,width}){return <div className="funnel-row"><span>{label}</span><div><i style={{width:`${width}%`}}/><b>{value}</b></div></div>}
function Metric({title,value,sub}){return <div className="metric"><div><span>{title}</span><strong>{value}</strong><small>{sub}</small></div></div>}

function Integrations({ctx:{data,demo,insert,notify}}){
  const site=data.sites[0]
  const snippet=site?`<script>\nwindow.useCRM={siteKey:"${site.public_key}"};\n/* send page/form events to crm_track_event */\n<\/script>`:'Create a site connection first.'
  async function addSite(){const domain=window.prompt('Website domain','your-store.com');if(!domain)return;const row={name:domain,domain,active:true};if(demo){notify('Site added in preview mode');return}await insert('crm_sites',row,'Website connected')}
  async function addWebhook(){const url=window.prompt('Webhook URL','https://example.com/webhooks/usecrm');if(!url)return;await insert('crm_webhooks',{url,events:['order.created','order.updated','visitor.identified'],active:true},'Webhook added')}
  return <><PageHead title="Integrations" copy="Connect websites, WhatsApp workflows, payment providers and external systems." button="Connect website" onClick={addSite}/><div className="integration-grid"><Panel title="Connected websites" action={`${data.sites.length} sites`}><div className="stack-list">{data.sites.map(s=><div className="mini-row" key={s.id}><div className="round-icon"><Globe2 size={16}/></div><div><strong>{s.name}</strong><span>{s.domain}</span></div><Status value={s.active?'active':'inactive'}/></div>)}</div></Panel><Panel title="Tracking install" action="Copy snippet"><p className="muted">Use a scoped public site key for live visitor intent. Existing legacy token-based snippets continue to work.</p><pre className="snippet">{snippet}</pre><button className="outline-btn" onClick={()=>{navigator.clipboard?.writeText(snippet);notify('Snippet copied')}}><Copy size={15}/> Copy</button></Panel><Panel title="Webhooks" action={`${data.webhooks.length} endpoints`}><div className="stack-list">{data.webhooks.map(w=><div className="mini-row" key={w.id}><div className="round-icon"><Webhook size={16}/></div><div><strong>{w.url}</strong><span>{Array.isArray(w.events)?w.events.join(', '):'Events'}</span></div></div>)}</div><button className="outline-btn full" onClick={addWebhook}><Plus size={15}/> Add webhook</button></Panel><Panel title="Channel connectors" action="Ready"><div className="connector-list">{[['WhatsApp','Follow-up & recovery'],['Paystack','Prepaid checkout incentives'],['Custom API','Orders & fulfillment']].map(([n,s])=><div key={n}><div className="connector-logo">{n[0]}</div><div><strong>{n}</strong><span>{s}</span></div><button>Configure</button></div>)}</div></Panel></div></>
}

function SettingsPage({ctx:{workspace,data,role,demo}}){
  return <><PageHead title="Settings" copy="Workspace, sites, access and checkout defaults."/><div className="settings-grid"><Panel title="Workspace"><dl className="details"><div><dt>Name</dt><dd>{workspace?.name}</dd></div><div><dt>Currency</dt><dd>{workspace?.currency||'NGN'}</dd></div><div><dt>Timezone</dt><dd>{workspace?.timezone||'Africa/Lagos'}</dd></div><div><dt>Your role</dt><dd>{role}</dd></div></dl></Panel><Panel title="Authentication"><div className="auth-status"><div className="provider enabled"><span>G</span><div><strong>Google OAuth</strong><small>Frontend integration ready</small></div><Status value="configured in app"/></div><div className="provider"><span>◎</span><div><strong>ChatGPT</strong><small>Keep the existing ChatGPT Sites login during migration; standalone provider access depends on OpenAI partner onboarding.</small></div></div></div></Panel><Panel title="Multi-site"><div className="big-stat">{data.sites.length}<span>connected websites</span></div><p className="muted">Each site has its own scoped tracking key while sharing customers, orders and analytics inside this workspace.</p></Panel><Panel title="Environment"><dl className="details"><div><dt>Mode</dt><dd>{demo?'Preview':'Live Supabase'}</dd></div><div><dt>Tenant RLS</dt><dd>Enabled</dd></div><div><dt>Legacy tracker</dt><dd>Compatible</dd></div></dl></Panel></div></>
}

function PublicOrderForm({slug}){
  const params=new URLSearchParams(window.location.search)
  const siteKey=params.get('site_key')
  const [form,setForm]=useState(null)
  const [error,setError]=useState(null)
  const [values,setValues]=useState({})
  const [qty,setQty]=useState({})
  const [bumps,setBumps]=useState([])
  const [coupon,setCoupon]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [done,setDone]=useState(null)
  const visitor=useRef(localStorage.getItem('usecrm_visitor_id')||crypto.randomUUID())
  const session=useRef(sessionStorage.getItem('usecrm_session_id')||crypto.randomUUID())
  const timer=useRef(null)

  useEffect(()=>{localStorage.setItem('usecrm_visitor_id',visitor.current);sessionStorage.setItem('usecrm_session_id',session.current);load()},[slug,siteKey])

  async function load(){
    if(!siteKey){setError('This order-form link is missing its site key.');return}
    const {data,error}=await supabase.rpc('crm_get_public_form',{p_site_key:siteKey,p_slug:slug})
    if(error||!data){setError(error?.message||'Order form not found.');return}
    setForm(data)
    const initial={}
    ;(data.products||[]).forEach((p,i)=>initial[p.variant_id]=i===0?(p.default_quantity||1):0)
    setQty(initial)
    track('page_view',{})
  }

  async function track(event,next){
    if(!siteKey)return
    const fields=Object.keys(next||values).filter(k=>String((next||values)[k]??'').trim())
    await supabase.rpc('crm_track_event',{p_site_key:siteKey,p_visitor_id:visitor.current,p_session_id:session.current,p_page_url:window.location.href,p_form_name:slug,p_event_type:event,p_fields_touched:fields,p_form_data:{...(next||values),referrer:document.referrer||null,utm_source:params.get('utm_source'),utm_medium:params.get('utm_medium'),utm_campaign:params.get('utm_campaign')}})
  }

  function change(key,value){
    const next={...values,[key]:value}
    setValues(next)
    clearTimeout(timer.current)
    timer.current=setTimeout(()=>track('form_progress',next),500)
  }

  async function submit(e){
    e.preventDefault()
    const items=Object.entries(qty).filter(([,q])=>Number(q)>0).map(([variant_id,quantity])=>({variant_id,quantity:Number(quantity)}))
    if(!items.length)return setError('Select at least one package.')
    setSubmitting(true)
    const payload={customer:{name:values.name,phone:values.phone,email:values.email,whatsapp:values.whatsapp,address:values.address,city:values.city,state:values.state,country:values.country||'Nigeria'},items,bumps,coupon_code:coupon,payment_method:values.payment_method,payment_readiness:values.payment_readiness,delivery_date:values.delivery_date,delivery_window:values.delivery_window,delivery_address:values.address,delivery_city:values.city,delivery_state:values.state,answers:values,attribution:{utm_source:params.get('utm_source'),utm_medium:params.get('utm_medium'),utm_campaign:params.get('utm_campaign')}}
    const {data,error}=await supabase.rpc('crm_submit_public_order',{p_site_key:siteKey,p_form_slug:slug,p_payload:payload})
    setSubmitting(false)
    if(error){setError(error.message);return}
    await track('form_submitted',values)
    setDone(data)
  }

  if(error&&!form)return <PublicShell><div className="public-message"><X size={28}/><h2>Order form unavailable</h2><p>{error}</p></div></PublicShell>
  if(!form)return <PublicShell><LoadingCard/></PublicShell>
  if(done)return <PublicShell><div className="public-message success"><Check size={30}/><h2>{done.success_message||'Order received'}</h2><p>Your order number is <strong>{done.order_number}</strong>.</p><div className="public-total"><span>Total</span><strong>{money(done.total)}</strong></div></div></PublicShell>

  return <PublicShell><div className="checkout-card"><div className="checkout-head"><div className="brand"><div className="brand-mark">u</div><div><strong>Secure order</strong><span>Powered by useCRM</span></div></div><span className="secure-pill">Live checkout</span></div><div className="checkout-title"><h1>{form.title}</h1>{form.subtitle&&<p>{form.subtitle}</p>}</div><form onSubmit={submit} onFocus={()=>track('form_started',values)}><div className="public-fields">{(form.fields||[]).map(f=><Field key={f.id} field={f} value={values[f.key]||''} onChange={v=>change(f.key,v)}/>)}</div><div className="checkout-section"><h3>Choose your package</h3>{(form.products||[]).map(p=><label className={`package-option ${Number(qty[p.variant_id])>0?'selected':''}`} key={p.variant_id}><input type="radio" name="package" checked={Number(qty[p.variant_id])>0} onChange={()=>setQty(Object.fromEntries((form.products||[]).map(x=>[x.variant_id,x.variant_id===p.variant_id?(p.default_quantity||1):0])))}/><div className="package-image">{p.image_url?<img src={p.image_url}/>:<ShoppingBag size={24}/>}</div><div><strong>{p.product_name}</strong><span>{p.variant_name}</span>{p.compare_at_price&&<del>{money(p.compare_at_price)}</del>}</div><b>{money(p.price)}</b></label>)}</div>{(form.bumps||[]).length>0&&<div className="checkout-section bump-section"><div className="bump-heading"><Sparkles size={18}/><div><strong>Special add-on</strong><span>Available with this order</span></div></div>{form.bumps.map(b=><label className="bump-option" key={b.id}><input type="checkbox" checked={bumps.includes(b.id)} onChange={e=>setBumps(e.target.checked?[...bumps,b.id]:bumps.filter(x=>x!==b.id))}/><div><strong>{b.title}</strong><span>{b.description||`${b.product_name} — ${b.variant_name}`}</span></div><b>+ {money(b.price)}</b></label>)}</div>}<div className="coupon-entry"><input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code"/><BadgePercent size={18}/></div>{error&&<div className="form-error">{error}</div>}<button className="place-order" disabled={submitting}>{submitting?<Loader2 className="spin" size={19}/>:<ShoppingBag size={19}/>} {form.submit_label||'Place order'}</button><p className="checkout-footnote">Your details are used to process and fulfil this order.</p></form></div></PublicShell>
}

function Field({field,value,onChange}){
  const common={value,onChange:e=>onChange(e.target.type==='checkbox'?e.target.checked:e.target.value),required:field.required,placeholder:field.placeholder||field.label}
  if(field.type==='textarea')return <label className="field"><span>{field.label}{field.required&&' *'}</span><textarea {...common}/></label>
  if(['select','radio'].includes(field.type)){
    const opts=Array.isArray(field.options)?field.options:[]
    return <label className="field"><span>{field.label}{field.required&&' *'}</span><select {...common}><option value="">Select…</option>{opts.map(o=><option key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>{typeof o==='string'?o:o.label}</option>)}</select></label>
  }
  if(field.type==='checkbox')return <label className="check-field"><input type="checkbox" checked={Boolean(value)} onChange={common.onChange}/><span>{field.label}</span></label>
  return <label className="field"><span>{field.label}{field.required&&' *'}</span><input type={field.type||'text'} {...common}/></label>
}

function PublicShell({children}){return <div className="public-page"><div className="public-bg"/>{children}</div>}
function Panel({title,subtitle,action,children}){return <div className="panel">{(title||action)&&<div className="panel-head"><div>{title&&<h3>{title}</h3>}{subtitle&&<p>{subtitle}</p>}</div>{action&&<span>{action}</span>}</div>}{children}</div>}
function PageHead({title,copy,button,onClick}){return <div className="page-head"><div><h2>{title}</h2><p>{copy}</p></div>{button&&<button className="primary-btn" onClick={onClick}><Plus size={17}/>{button}</button>}</div>}
function Status({value}){const v=String(value||'unknown').toLowerCase();return <span className={`status status-${v.replace(/[^a-z0-9]/g,'-')}`}>{v.replaceAll('_',' ')}</span>}
function Empty({label='Nothing here yet'}){return <div className="empty"><ClipboardList size={28}/><strong>{label}</strong><span>New activity will appear here.</span></div>}
function filterRows(rows,search,keys){if(!search?.trim())return rows;const q=search.toLowerCase();return rows.filter(r=>keys.some(k=>String(r[k]??'').toLowerCase().includes(q)))}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
