"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Filter, Plus, MoreHorizontal, ChevronDown, ArrowUpRight, ArrowDownRight, Clock3, CheckCircle2, MessageCircle, Users, CalendarDays, Download, Zap, Plug, Mail, MessageSquare, Phone, Settings, CircleHelp, Sparkles, UserRound, Tag, Send } from "lucide-react";
import { CustomersDirectory } from "@/components/customers-directory";
import { InboxList } from "@/components/inbox-list";
import { createClient } from "@/lib/supabase/client";

const titles:Record<string,{title:string;subtitle:string}>={
"/inbox":{title:"Inbox",subtitle:"Manage all customer conversations in one place."},
"/assigned-to-me":{title:"Assigned to me",subtitle:"Conversations currently assigned to your support queue."},
"/customers":{title:"Customers",subtitle:"Understand customers through their profiles and conversation history."},
"/analytics":{title:"Analytics",subtitle:"Track support performance, response times, and customer satisfaction."},
"/automations":{title:"Automations",subtitle:"Build workflows that help your support team move faster."},
"/integrations":{title:"Integrations",subtitle:"Connect the tools and channels your support team uses."},
"/website-chat":{title:"Website Chat",subtitle:"Manage customer conversations coming from your website."},
"/email":{title:"Email",subtitle:"Handle customer support requests received by email."},
"/whatsapp":{title:"WhatsApp",subtitle:"Manage customer conversations from WhatsApp."},
"/settings":{title:"Settings",subtitle:"Manage your workspace, account, and support preferences."},
"/help-support":{title:"Help & Support",subtitle:"Find guidance and get help using ResolveIQ."}
};
function Heading({title,subtitle,action,onAction}:{title:string;subtitle:string;action?:string;onAction?:()=>void}){return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action&&<button className="primary-btn" onClick={onAction}><Plus size={16}/>{action}</button>}</div>}
function Panel({children,title,subtitle,action}:{children:ReactNode;title?:string;subtitle?:string;action?:ReactNode}){return <section className="panel content-panel">{(title||action)&&<div className="panel-title"><div>{title&&<h2>{title}</h2>}{subtitle&&<p>{subtitle}</p>}</div>{typeof action==="string"?action==="View all"?<Link className="outline-btn" href="/inbox">{action}</Link>:<span className="range-label">{action}</span>:action}</div>}{children}</section>}
function NewConversationDialog({open,onClose}:{open:boolean;onClose:()=>void}){
  const router=useRouter();
  const [customers,setCustomers]=useState<{id:string;name:string}[]>([]);
  const [customerId,setCustomerId]=useState("");
  const [subject,setSubject]=useState("");
const [channel,setChannel]=useState("email");
  const [priority,setPriority]=useState("normal");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!open)return;
    let active=true;
    setLoading(true);
    setError("");
    void (async()=>{
      try{
        const {data,error:loadError}=await createClient().from("customers").select("id,name").order("name");
        if(!active)return;
        if(loadError)setError(loadError.message);
        else {
          const available=data??[];
          setCustomers(available);
          setCustomerId((current)=>current||available[0]?.id||"");
        }
      }catch(loadError){
        if(active)setError(loadError instanceof Error?loadError.message:"Could not load customers.");
      }finally{
        if(active)setLoading(false);
      }
    })();
    return ()=>{active=false;};
  },[open]);

  async function createConversation(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");
    if(!customerId){setError("Add a customer before creating a conversation.");return;}
    setSaving(true);
    try{
      const supabase=createClient();
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError)throw authError;
      if(!user)throw new Error("Please log in again to create a conversation.");
      const {error:insertError}=await supabase.from("conversations").insert({
        customer_id:customerId,
        subject:subject.trim(),
        channel,
        priority,
        status:"open",
        assigned_to:user.id,
      });
      if(insertError)throw insertError;
      window.dispatchEvent(new Event("resolveiq:conversations-changed"));
      onClose();
      router.push("/inbox");
    }catch(caught){
      setError(formatSupabaseError(caught,"Could not create the conversation."));
    }finally{
      setSaving(false);
    }
  }

  if(!open)return null;
  return <Dialog title="New conversation" onClose={onClose}>
    <form className="dialog-form" onSubmit={createConversation}>
      <label>Customer<select required value={customerId} onChange={(event)=>setCustomerId(event.target.value)} disabled={loading||customers.length===0}>
        {customers.length===0&&<option value="">{loading?"Loading customers...":"No customers available"}</option>}
        {customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.name}</option>)}
      </select></label>
      <label>Subject<input required value={subject} onChange={(event)=>setSubject(event.target.value)} placeholder="What does the customer need help with?" /></label>
      <div className="dialog-field-row">
        <label>
  Channel
  <select
    value={channel}
    onChange={(event) => setChannel(event.target.value)}
  >
    <option value="email">Email</option>
    <option value="web">Website</option>
    <option value="whatsapp">WhatsApp</option>
  </select>
</label>
    <label>
  Priority
  <select
    value={priority}
    onChange={(event) => setPriority(event.target.value)}
  >
    <option value="low">Low</option>
    <option value="normal">Normal</option>
    <option value="high">High</option>
    <option value="urgent">Urgent</option>
  </select>
</label>
      </div>
      {error&&<p className="dialog-error" role="alert">{error}</p>}
      <button className="primary-btn" type="submit" disabled={saving||loading||!customerId}>{saving?"Creating...":"Create conversation"}</button>
    </form>
  </Dialog>;
}
function Dialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){return <div className="dialog-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div><div className="dialog-content">{children}</div></section></div>}
function formatSupabaseError(error:unknown,fallback:string){
  if(error instanceof Error)return error.message;
  if(error&&typeof error==="object"&&"message" in error){
    const details="details" in error&&typeof error.details==="string"?` ${error.details}`:"";
    const hint="hint" in error&&typeof error.hint==="string"?` ${error.hint}`:"";
    const errorCode="code" in error&&typeof error.code==="string"?error.code:"";
    const code=errorCode?` (${errorCode})`:"";
    const policyHint=errorCode==="42501"?" Check the Supabase conversations INSERT policy for the signed-in user.":"";
    return `${String(error.message)}${code}${details}${hint}${policyHint}`;
  }
  return fallback;
}
function TicketsTable({
  assigned = false,
  channel = "",
}: {
  assigned?: boolean;
  channel?: string;
}) {
  return <InboxList assigned={assigned} channel={channel} />;
}
function Metric({label,value,change,icon:Icon}:{label:string;value:string;change:string;icon:any}){return <div className="metric-card"><div className="metric-label">{label}<span><Icon size={18}/></span></div><strong>{value}</strong><small>{change}</small></div>}
type DashboardConversation={id:string;status:string|null;channel:string|null;created_at:string|null};
type DashboardMessage={conversation_id:string;sender_type:string;created_at:string|null;is_internal_note:boolean|null};
function useSupportData(){
  const [data,setData]=useState<{conversations:DashboardConversation[];messages:DashboardMessage[]}|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const supabase=createClient();
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(authError)throw authError;
        if(!user)throw new Error("Please sign in to view workspace analytics.");
        const conversations:DashboardConversation[]=[];
        for(let from=0;;from+=1000){
          const result=await supabase.from("conversations").select("id,status,channel,created_at").order("created_at",{ascending:false}).range(from,from+999);
          if(result.error)throw result.error;
          const page=(result.data??[]) as DashboardConversation[];
          conversations.push(...page);
          if(page.length<1000)break;
        }
        const messages:DashboardMessage[]=[];
        for(let from=0;;from+=1000){
          const result=await supabase.from("messages").select("conversation_id,sender_type,created_at,is_internal_note").order("created_at",{ascending:true}).range(from,from+999);
          if(result.error)throw result.error;
          const page=(result.data??[]) as DashboardMessage[];
          messages.push(...page);
          if(page.length<1000)break;
        }
        if(active)setData({conversations,messages});
      }catch(caught){
        if(active)setError(formatSupabaseError(caught,"Could not load workspace analytics."));
      }finally{
        if(active)setLoading(false);
      }
    })();
    return ()=>{active=false;};
  },[]);
  return {data,loading,error};
}
function formatResponseTime(messages:DashboardMessage[]){
  const grouped=new Map<string,DashboardMessage[]>();
  for(const message of messages){
    if(message.is_internal_note||!message.created_at)continue;
    const list=grouped.get(message.conversation_id)??[];
    list.push(message);
    grouped.set(message.conversation_id,list);
  }
  const times:number[]=[];
  for(const list of grouped.values()){
    const ordered=list.sort((a,b)=>Date.parse(a.created_at!)-Date.parse(b.created_at!));
    const firstCustomer=ordered.find((message)=>message.sender_type.toLowerCase()==="customer");
    if(!firstCustomer?.created_at)continue;
    const customerTime=Date.parse(firstCustomer.created_at);
    const firstAgent=ordered.find((message)=>message.sender_type.toLowerCase()==="agent"&&Date.parse(message.created_at!)>=customerTime);
    if(firstAgent?.created_at){
      const duration=Date.parse(firstAgent.created_at)-customerTime;
      if(Number.isFinite(duration)&&duration>=0)times.push(duration);
    }
  }
  if(!times.length)return "—";
  const average=times.reduce((sum,value)=>sum+value,0)/times.length;
  const minutes=Math.floor(average/60000);
  const seconds=Math.round((average%60000)/1000);
  return minutes?`${minutes}m ${seconds}s`:`${seconds}s`;
}
function statusCounts(conversations:DashboardConversation[]){
  return conversations.reduce((counts,conversation)=>{
    const status=(conversation.status??"unknown").toLowerCase();
    counts[status]=(counts[status]??0)+1;
    return counts;
  },{} as Record<string,number>);
}
export function Overview(){
  const {data,loading,error}=useSupportData();
  const conversations=data?.conversations??[];
  const counts=statusCounts(conversations);
  const resolved=Object.entries(counts).filter(([status])=>status==="resolved").reduce((sum,[,count])=>sum+count,0);
  const open=Object.entries(counts).filter(([status])=>status==="open").reduce((sum,[,count])=>sum+count,0);
  const pending=Object.entries(counts).filter(([status])=>status==="pending").reduce((sum,[,count])=>sum+count,0);
  const metricValue=(value:number)=>loading?"…":error?"—":value.toLocaleString();
  const today=new Date();
  const days=Array.from({length:7},(_,index)=>{
    const date=new Date(today);
    date.setDate(today.getDate()-6+index);
    date.setHours(0,0,0,0);
    const key=`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const count=conversations.filter((conversation)=>{
      if(!conversation.created_at)return false;
      const created=new Date(conversation.created_at);
      return `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`===key;
    }).length;
    return {label:date.toLocaleDateString(undefined,{weekday:"short"}),count};
  });
  const maxDaily=Math.max(1,...days.map((day)=>day.count));
  const [activityOpen,setActivityOpen]=useState(false);
  return <>
    <Heading title="Support overview" subtitle="Live conversation metrics from the records available to your account."/>
    {error&&<div className="data-error" role="alert">{error}</div>}
    <div className="metric-grid">
      <Metric label="Open conversations" value={metricValue(open)} change="Current status" icon={MessageCircle}/>
      <Metric label="Waiting for reply" value={metricValue(pending)} change="Pending status" icon={Clock3}/>
      <Metric label="Resolved conversations" value={metricValue(resolved)} change="Resolved status" icon={CheckCircle2}/>
      <Metric label="Avg. first response" value={loading?"…":error?"—":formatResponseTime(data?.messages??[])} change="From customer and agent messages" icon={Zap}/>
    </div>
    <div className="overview-grid">
      <div className="stack">
        <Panel title="Conversation volume" subtitle="Conversations created per day over the last 7 days">
          <div className="daily-chart" aria-label="Conversations created each day during the last seven days">
            {loading?<p>Loading conversation records…</p>:error?<p>Conversation volume unavailable.</p>:days.map((day)=><div className="daily-chart-column" key={day.label}><span>{day.count}</span><i><b style={{height:`${Math.max(day.count?5:0,day.count/maxDaily*100)}%`}}/></i><small>{day.label}</small></div>)}
          </div>
        </Panel>
        <Panel title="Conversation status" subtitle="Current status totals">
          <div className="category-bars">{loading?<p>Loading status totals…</p>:error?<p>Status totals unavailable.</p>:Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([status,count])=><div className="bar-row" key={status}><span>{status}</span><i><b style={{width:`${conversations.length?count/conversations.length*100:0}%`}}/></i><strong>{count}</strong></div>)}
            {!loading&&!error&&conversations.length===0&&<p>No conversations are available yet.</p>}
          </div>
        </Panel>
      </div>
      <div className="stack">
        <div className="ai-activity">
          <div><Sparkles size={20}/> AI Activity <button onClick={()=>setActivityOpen(true)}>View all ›</button></div>
          <article><b>✦</b><section><strong>AI provider not connected</strong><small>No AI activity has been recorded.</small></section></article>
        </div>
        <Panel title="Conversations by channel" subtitle="Distribution of conversation records">
          <ChannelCounts conversations={conversations} loading={loading} error={error}/>
        </Panel>
      </div>
    </div>
    {activityOpen&&<Dialog title="AI activity" onClose={()=>setActivityOpen(false)}><p>No AI activity is available because a live AI provider is not connected.</p><Link className="outline-btn" href="/integrations" onClick={()=>setActivityOpen(false)}>View integrations</Link></Dialog>}
  </>;
}
function ChannelCounts({conversations,loading,error}:{conversations:DashboardConversation[];loading:boolean;error:string}){
  const counts=conversations.reduce((values,conversation)=>{
    const channel=conversation.channel||"Unknown";
    values[channel]=(values[channel]??0)+1;
    return values;
  },{} as Record<string,number>);
  const max=Math.max(1,...Object.values(counts));
  if(loading)return <p>Loading channel metrics…</p>;
  if(error)return <p>Channel metrics unavailable.</p>;
  if(!Object.keys(counts).length)return <p>No channel data is available yet.</p>;
  return <div className="category-bars">{Object.entries(counts).sort(([,a],[,b])=>b-a).map(([channel,count])=><div className="bar-row" key={channel}><span>{channel}</span><i><b style={{width:`${count/max*100}%`}}/></i><strong>{count}</strong></div>)}</div>;
}
function Customers() {
  return <CustomersDirectory />;
}
function Automations(){const [enabled,setEnabled]=useState([true,true,false]);return <div className="automation-list">{["Auto-assign new conversations","Send follow-up after 24 hours","Escalate tickets with negative sentiment"].map((x,i)=><div className="automation-row" key={x}><span className="automation-icon"><Zap size={19}/></span><div><b>{x}</b><small>{["Automatically assign incoming tickets to available agents.","Remind customers when a conversation is waiting for a response.","Flag frustrated customers for priority review."][i]}</small></div><button className={`toggle ${enabled[i]?"on":""}`} onClick={()=>setEnabled(a=>a.map((v,j)=>i===j?!v:v))}><i/></button></div>)}</div>}
function Integrations(){
  const [selected,setSelected]=useState("");
  const integrations=[
    ["Hindsight Memory","Persistent customer memory and recall","HM","Connect a Hindsight service endpoint through a server-side integration. Keep API keys on the server; do not enter credentials in this browser prototype."],
    ["Groq AI","Fast AI responses and reasoning","G","Add a server-side AI provider integration and store its API key in your deployment environment before enabling assistant responses."],
    ["Gmail","Email support channel","M","Set up Gmail OAuth and a server-side message sync/webhook before email conversations can appear in the inbox."],
    ["WhatsApp Cloud API","WhatsApp messaging channel","W","Configure a Meta app, webhook verification, and a server-side access token before sending or receiving WhatsApp messages."],
    ["PostgreSQL","Customer and ticket database","P","The current app uses Supabase. Database credentials must remain server-side; configure a server integration before connecting another database."],
    ["Website Widget","Embedded customer chat","C","Install a chat widget endpoint and connect it to a server-side conversation creation route before accepting live chats."]
  ];
  const integration=integrations.find(([name])=>name===selected);
  return <><div className="integration-grid">{integrations.map(([name,desc,letter])=><div className="integration-card" key={name}><div className="integration-logo">{letter}</div><b>{name}</b><p>{desc}</p><button className="outline-btn" onClick={()=>setSelected(name)}>Configure</button></div>)}</div>
    {integration&&<Dialog title={`Set up ${integration[0]}`} onClose={()=>setSelected("")}><p>{integration[3]}</p><p className="dialog-note">Connection status: Not connected. This frontend prototype does not establish external provider connections or store provider credentials.</p><button className="primary-btn" onClick={()=>setSelected("")}>Got it</button></Dialog>}
  </>;
}
function ChannelPage({channel}:{channel:string}){
  const [showSetup,setShowSetup]=useState(false);
  return <><div className="channel-layout"><Panel title={`${channel} conversations`} subtitle={`Messages received through ${channel}`}><div className="channel-empty"><div><MessageSquare size={28}/></div><b>Connect your {channel} channel</b><p>Once configured, customer messages will appear here and be available to the AI support agent.</p><button className="primary-btn" onClick={()=>setShowSetup(true)}><Plug size={15}/>Set up {channel}</button></div></Panel><Panel title="Channel status"><div className="setting-line"><span>Connection</span><b className="muted-status">Not connected</b></div><div className="setting-line"><span>AI assistance</span><b>Ready to configure</b></div><div className="setting-line"><span>Message history</span><b>Waiting for connection</b></div></Panel></div>
    {showSetup&&<Dialog title={`Set up ${channel}`} onClose={()=>setShowSetup(false)}><p>To receive live {channel} messages, connect a provider account, configure its webhook, and add a server-side handler that writes messages to the ResolveIQ database.</p><p className="dialog-note">This project currently includes the channel screens but not provider credentials or webhook endpoints. No connection will be reported until that backend is added.</p><button className="primary-btn" onClick={()=>setShowSetup(false)}>Close setup guide</button></Dialog>}
  </>;
}
function SettingsPage(){
  const [selected,setSelected]=useState("");
  const [value,setValue]=useState("");
  const [saved,setSaved]=useState("");
  const [error,setError]=useState("");
  const settings=[
    ["Workspace profile","Company name, logo, and workspace details"],
    ["Team & permissions","Manage agents, roles, and access"],
    ["AI & memory","Configure AI provider, Hindsight memory, and recall"],
    ["Notifications","Choose how and when agents receive alerts"],
    ["Channels","Manage email, website chat, and WhatsApp settings"],
    ["Security","Manage authentication and data preferences"]
  ];
  function openSetting(name:string){
    setSelected(name);
    setError("");
    setSaved("");
    try{setValue(localStorage.getItem(`resolveiq-setting:${name}`)??"");}
    catch(caught){setValue("");setError(caught instanceof Error?caught.message:"Could not read this setting.");}
  }
  function saveSetting(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{
      localStorage.setItem(`resolveiq-setting:${selected}`,value);
      setSaved("Saved in this browser.");
      setError("");
    }catch(caught){setError(caught instanceof Error?caught.message:"Could not save this setting.");}
  }
  return <><div className="settings-grid">{settings.map(([name,description])=><div className="setting-card" key={name}><Settings size={20}/><b>{name}</b><p>{description}</p><button className="outline-btn" onClick={()=>openSetting(name)}>Manage settings</button></div>)}</div>
    {selected&&<Dialog title={selected} onClose={()=>setSelected("")}><form className="dialog-form" onSubmit={saveSetting}><p>{settings.find(([name])=>name===selected)?.[1]}. This preference is stored in this browser and is not synced to a team account.</p><label>Workspace note or preference<textarea rows={3} value={value} onChange={(event)=>setValue(event.target.value)} placeholder="Add a note or preference" /></label>{error&&<p className="dialog-error" role="alert">{error}</p>}{saved&&<p className="dialog-success" role="status">{saved}</p>}<button className="primary-btn" type="submit">Save preference</button></form></Dialog>}
  </>;
}
const helpArticles=[
  ["Getting started","Set up your workspace and support channels","Start by reviewing Workspace settings, then connect a supported channel from the Integrations page. Add customer profiles before creating conversations so messages have a customer record."],
  ["AI memory guide","Understand how customer memory and recall work","The prototype includes an AI assistant panel, but a live AI or memory provider is not connected. Configure a server-side provider before sending customer data to an AI service."],
  ["Inbox & tickets","Learn to manage and resolve conversations","Use the Inbox search and status filter to find conversations. Open a subject to read the message history and send a reply. Assigned to me shows tickets assigned to your signed-in account."],
  ["Contact support","Get assistance from the ResolveIQ team","Contact support is not connected in this prototype. Add your support email or help desk endpoint to the deployment before directing customers here."]
];
function Help(){
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState("");
  const articles=helpArticles.filter(([title,description])=>`${title} ${description}`.toLowerCase().includes(query.toLowerCase()));
  const article=helpArticles.find(([title])=>title===selected);
  return <><Panel title="How can we help?" subtitle="Browse guides to get the most out of ResolveIQ"><div className="help-search"><Search size={17}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search help articles..." aria-label="Search help articles" /></div></Panel><div className="settings-grid">{articles.map(([title,description])=><div className="setting-card" key={title}><CircleHelp size={20}/><b>{title}</b><p>{description}</p><button className="outline-btn" onClick={()=>setSelected(title)}>Read guide</button></div>)}{articles.length===0&&<p>No help articles match your search.</p>}</div>
    {article&&<Dialog title={article[0]} onClose={()=>setSelected("")}><p>{article[2]}</p><button className="primary-btn" onClick={()=>setSelected("")}>Done</button></Dialog>}
  </>;
}
export function WorkspacePage({path}:{path:string}){
  const [newConversationOpen,setNewConversationOpen]=useState(false);
  if(path==="/")return <Overview/>;
  if(path==="/analytics")return <LiveAnalytics/>;
  const meta=titles[path]||titles["/inbox"];
  return <><Heading title={meta.title} subtitle={meta.subtitle} action={["/inbox","/assigned-to-me"].includes(path)?"New conversation":undefined} onAction={()=>setNewConversationOpen(true)}/>{path==="/inbox"?<TicketsTable/>:path==="/assigned-to-me"?<TicketsTable assigned/>:path==="/customers"?<Customers/>:path==="/automations"?<Automations/>:path==="/integrations"?<Integrations/>:["/website-chat","/email","/whatsapp"].includes(path)?<ChannelPage channel={meta.title}/>:path==="/settings"?<SettingsPage/>:<Help/>}<NewConversationDialog open={newConversationOpen} onClose={()=>setNewConversationOpen(false)}/></>;
}
function LiveAnalytics(){
  const {data,loading,error}=useSupportData();
  const conversations=data?.conversations??[];
  const counts=statusCounts(conversations);
  const resolved=counts.resolved??0;
  const resolvedRate=conversations.length?`${(resolved/conversations.length*100).toFixed(1)}%`:"0%";
  const metricValue=(value:string)=>loading?"…":error?"—":value;
  const channelCount=Object.keys(conversations.reduce((channels,conversation)=>{
    if(conversation.channel)channels[conversation.channel]=true;
    return channels;
  },{} as Record<string,boolean>)).length;
  const today=new Date();
  const days=Array.from({length:7},(_,index)=>{
    const date=new Date(today);
    date.setDate(today.getDate()-6+index);
    date.setHours(0,0,0,0);
    const key=`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const count=conversations.filter((conversation)=>{
      if(!conversation.created_at)return false;
      const created=new Date(conversation.created_at);
      return `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`===key;
    }).length;
    return {label:date.toLocaleDateString(undefined,{weekday:"short"}),count};
  });
  const maxDaily=Math.max(1,...days.map((day)=>day.count));
  const agentMessages=data?.messages.filter((message)=>!message.is_internal_note&&message.sender_type.toLowerCase()==="agent"&&message.created_at).length??0;
  return <>
    <Heading title="Analytics" subtitle="Support performance calculated from conversation and message records."/>
    {error&&<div className="data-error" role="alert">{error}</div>}
    <div className="metric-grid">
      <Metric label="Total conversations" value={metricValue(conversations.length.toLocaleString())} change="All accessible conversation records" icon={MessageCircle}/>
      <Metric label="Resolved rate" value={metricValue(resolvedRate)} change={loading?"Loading records…":error?"Unavailable":`${resolved.toLocaleString()} resolved of ${conversations.length.toLocaleString()}`} icon={CheckCircle2}/>
      <Metric label="Avg. first response" value={loading?"…":error?"—":formatResponseTime(data?.messages??[])} change="Based on customer and agent message timestamps" icon={Clock3}/>
      <Metric label="Channels in use" value={metricValue(String(channelCount))} change="Distinct channels in conversation records" icon={Users}/>
    </div>
    <div className="two-col">
      <Panel title="Conversation volume" subtitle="New conversations created per day over the last 7 days">
        <div className="daily-chart analytics-daily-chart" aria-label="Conversations created each day during the last seven days">
          {loading?<p>Loading conversation records…</p>:error?<p>Conversation volume unavailable.</p>:days.map((day)=><div className="daily-chart-column" key={day.label}><span>{day.count}</span><i><b style={{height:`${Math.max(day.count?5:0,day.count/maxDaily*100)}%`}}/></i><small>{day.label}</small></div>)}
        </div>
      </Panel>
      <Panel title="Conversation status" subtitle="Current status totals">
        <div className="category-bars">{loading?<p>Loading status totals…</p>:error?<p>Status totals unavailable.</p>:Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([status,count])=><div className="bar-row" key={status}><span>{status}</span><i><b style={{width:`${conversations.length?count/conversations.length*100:0}%`}}/></i><strong>{count}</strong></div>)}
          {!loading&&!error&&conversations.length===0&&<p>No conversations are available yet.</p>}
        </div>
      </Panel>
    </div>
    <div className="two-col">
      <Panel title="Conversations by channel" subtitle="Counts from accessible conversation records"><ChannelCounts conversations={conversations} loading={loading} error={error}/></Panel>
      <Panel title="Response-time coverage" subtitle="Agent message records used for response-time calculations">
        <p>{loading?"Loading message records…":error?"Message records unavailable.":`${agentMessages.toLocaleString()} non-internal agent messages are available to calculate first responses.`}</p>
        <p className="dialog-note">This project has no customer satisfaction/rating data, so no CSAT score is shown.</p>
      </Panel>
    </div>
  </>;
}
