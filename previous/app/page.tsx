"use client";

import { useState } from "react";
import {
  Activity, AlertCircle, Bell, Bot, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Clock3, LayoutDashboard, Link2,
  Mail, MessageCircle, MoreHorizontal, Search, Settings, Sparkles, Users,
  UserRound, BarChart3, Workflow, MessageSquare, Phone, Smile, TrendingUp,
  TrendingDown, X, Send, Paperclip, Menu
} from "lucide-react";

const conversations = [
  { name: "Bessie Cooper", subject: "Where is my order?", channel: "WhatsApp", status: "Open", time: "2m ago", initials: "BC", color: "peach" },
  { name: "Brooklyn Simmons", subject: "Payment failed", channel: "Website", status: "Resolved", time: "8m ago", initials: "BS", color: "blue" },
  { name: "Eleanor Pena", subject: "Refund request", channel: "Email", status: "Pending", time: "14m ago", initials: "EP", color: "pink" },
  { name: "Darlene Robertson", subject: "Can't login", channel: "WhatsApp", status: "Open", time: "21m ago", initials: "DR", color: "green" },
];

const categories = [
  { name: "Shipping", value: 128, color: "#6250ed", width: "77%" },
  { name: "Payment", value: 86, color: "#1689e9", width: "59%" },
  { name: "Refund", value: 64, color: "#0dbb55", width: "48%" },
  { name: "Order", value: 52, color: "#f59e0b", width: "38%" },
  { name: "Technical", value: 41, color: "#27b5e9", width: "29%" },
  { name: "Login", value: 28, color: "#df4dc4", width: "21%" },
];

function SidebarItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`nav-item ${active ? "active" : ""}`}>
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, change, positive, icon: Icon }: any) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-main">
        <strong>{value}</strong>
        <span className="stat-icon"><Icon size={19} /></span>
      </div>
      <div className="stat-foot">
        <span className={`change ${positive ? "up" : "down"}`}>
          {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {change}
        </span>
        <span>vs yesterday</span>
      </div>
    </div>
  );
}

function ConversationChart() {
  const blue = "40,157 120,118 200,130 280,63 360,98 440,171 520,190";
  const green = "40,205 120,157 200,116 280,112 360,115 440,202 520,209";
  return (
    <div className="chart-wrap">
      <div className="chart-y-labels">
        {[600, 500, 400, 300, 200, 100, 0].map((v) => <span key={v}>{v}</span>)}
      </div>
      <svg className="line-chart" viewBox="0 0 560 260" preserveAspectRatio="none" role="img" aria-label="Incoming and resolved conversations over seven days">
        {[20, 60, 100, 140, 180, 220].map(y => <line key={y} x1="40" y1={y} x2="540" y2={y} className="gridline" />)}
        {[40, 120, 200, 280, 360, 440, 520].map(x => <line key={x} x1={x} y1="12" x2={x} y2="230" className="v-gridline" />)}
        <polyline points={blue} className="series-blue" />
        <polyline points={green} className="series-green" />
        {blue.split(" ").map((p, i) => { const [x,y] = p.split(","); return <circle key={"b"+i} cx={x} cy={y} r="4.5" className="point-blue" />; })}
        {green.split(" ").map((p, i) => { const [x,y] = p.split(","); return <circle key={"g"+i} cx={x} cy={y} r="4.5" className="point-green" />; })}
        <line x1="280" y1="12" x2="280" y2="230" className="focus-line" />
        <rect x="300" y="32" width="136" height="72" rx="12" fill="white" stroke="#edf0f6" />
        <text x="315" y="51" className="tooltip-heading">THURSDAY</text>
        <circle cx="319" cy="68" r="4" fill="#6250ed" /><text x="330" y="72" className="tooltip-text">Incoming</text><text x="418" y="72" textAnchor="end" className="tooltip-text">460</text>
        <circle cx="319" cy="88" r="4" fill="#10b85a" /><text x="330" y="92" className="tooltip-text">Resolved</text><text x="418" y="92" textAnchor="end" className="tooltip-text">310</text>
      </svg>
      <div className="chart-x-labels">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x => <span key={x}>{x}</span>)}</div>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [search, setSearch] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [period, setPeriod] = useState("Last 7 days");
  const [notice, setNotice] = useState(false);

  const filtered = conversations.filter(c => `${c.name} ${c.subject} ${c.channel}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="app-shell">
      <div className="dashboard">
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark"><MessageCircle size={21} fill="white" strokeWidth={2.8} /></div>
            <span className="brand-name">Relay</span>
            <button className="collapse-btn" aria-label="Collapse sidebar"><Menu size={17}/></button>
          </div>
          <button className="workspace-select">Acme Shoes <ChevronDown size={15}/></button>

          <div className="nav-section">
            <div className="nav-label">MAIN</div>
            <SidebarItem icon={LayoutDashboard} label="Overview" active={active === "Overview"} onClick={() => setActive("Overview")} />
            <SidebarItem icon={MessageSquare} label="Inbox" active={active === "Inbox"} onClick={() => setActive("Inbox")} />
            <SidebarItem icon={UserRound} label="Assigned to me" active={active === "Assigned to me"} onClick={() => setActive("Assigned to me")} />
            <SidebarItem icon={Users} label="Customers" active={active === "Customers"} onClick={() => setActive("Customers")} />
          </div>
          <div className="nav-section">
            <div className="nav-label">WORKSPACE</div>
            <SidebarItem icon={BarChart3} label="Analytics" active={active === "Analytics"} onClick={() => setActive("Analytics")} />
            <SidebarItem icon={Workflow} label="Automations" active={active === "Automations"} onClick={() => setActive("Automations")} />
            <SidebarItem icon={Link2} label="Integrations" active={active === "Integrations"} onClick={() => setActive("Integrations")} />
          </div>
          <div className="nav-section">
            <div className="nav-label">CHANNELS</div>
            <SidebarItem icon={MessageCircle} label="Website Chat" active={active === "Website Chat"} onClick={() => setActive("Website Chat")} />
            <SidebarItem icon={Mail} label="Email" active={active === "Email"} onClick={() => setActive("Email")} />
            <SidebarItem icon={Phone} label="WhatsApp" active={active === "WhatsApp"} onClick={() => setActive("WhatsApp")} />
          </div>
          <div className="sidebar-bottom">
            <SidebarItem icon={Settings} label="Settings" active={active === "Settings"} onClick={() => setActive("Settings")} />
            <SidebarItem icon={CircleHelp} label="Help & Support" active={active === "Help & Support"} onClick={() => setActive("Help & Support")} />
            <button className="user-card">
              <img src="https://i.pravatar.cc/80?img=47" alt="Theresa Webb" />
              <span><b>Theresa Webb</b><small>Agent</small></span>
              <ChevronDown size={16}/>
            </button>
          </div>
        </aside>

        <section className="main-content">
          <header className="topbar">
            <div>
              <h1>Good morning, Theresa Webb</h1>
              <p>Here’s what’s happening with your support team today.</p>
            </div>
            <div className="top-actions">
              <label className="search-box">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." />
                <Search size={20}/>
              </label>
              <button className="icon-button notification" onClick={() => setNotice(!notice)} aria-label="Notifications"><Bell size={19}/><i/></button>
              <img className="top-avatar" src="https://i.pravatar.cc/80?img=47" alt="Theresa Webb"/>
              {notice && <div className="notification-pop">You're all caught up! <CheckCircle2 size={16}/></div>}
            </div>
          </header>

          <div className="stats-grid">
            <StatCard title="Open conversations" value="128" change="+12%" positive icon={MessageCircle}/>
            <StatCard title="Waiting for reply" value="24" change="-8%" positive={false} icon={Clock3}/>
            <StatCard title="Resolved today" value="342" change="+18%" positive icon={CheckCircle2}/>
            <StatCard title="Avg. response time" value="4m 12s" change="-8%" positive icon={Activity}/>
          </div>

          <div className="content-grid">
            <div className="left-column">
              <section className="panel conversation-panel">
                <div className="panel-heading">
                  <div><h2>Conversation Volume</h2><p>Incoming vs resolved conversations over the last 7 days.</p></div>
                  <label className="period-select"><CalendarDays size={16}/><select value={period} onChange={e => setPeriod(e.target.value)}><option>Last 7 days</option><option>Last 30 days</option><option>This year</option></select><ChevronDown size={14}/></label>
                </div>
                <ConversationChart />
              </section>

              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div><h2>Recent Conversations</h2><p>Latest customer conversations</p></div>
                  <button className="view-all" onClick={() => setActive("Inbox")}>View all <ChevronRight size={15}/></button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Customer</th><th>Subject</th><th>Channel</th><th>Status</th><th>Time</th></tr></thead>
                    <tbody>
                      {filtered.map((c) => <tr key={c.name}>
                        <td><span className={`mini-avatar ${c.color}`}>{c.initials}</span>{c.name}</td>
                        <td>{c.subject}</td><td>{c.channel}</td>
                        <td><span className={`status ${c.status.toLowerCase()}`}>{c.status}</span></td><td>{c.time}</td>
                      </tr>)}
                      {filtered.length === 0 && <tr><td colSpan={5} className="empty-row">No conversations match your search.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="right-column">
              <section className="activity-card">
                <div className="activity-title"><Sparkles size={20} fill="white"/> <span>AI Activity</span><button onClick={() => setActive("Analytics")}>View all <ChevronRight size={14}/></button></div>
                <div className="activity-event"><span className="sparkle-circle"><Sparkles size={21}/></span><div><b>Assigned Bessie Cooper to Theresa Webb</b><small>2m ago</small></div></div>
                <div className="activity-dots"><i/><i/><i/><i/></div>
              </section>

              <section className="panel category-panel">
                <div className="panel-heading simple"><div><h2>Tickets by category</h2><p>Distribution of support tickets</p></div></div>
                <div className="category-list">{categories.map(c => <div className="category-row" key={c.name}><span>{c.name}</span><div className="bar-track"><i style={{width:c.width, background:c.color}}/></div><b>{c.value}</b></div>)}</div>
              </section>

              <section className="panel satisfaction-panel">
                <div className="panel-heading simple"><div><h2>Customer Satisfaction</h2><p>How customers rated support this week</p></div></div>
                <div className="satisfaction-content">
                  <div className="donut"><div><strong>94%</strong></div></div>
                  <div className="satisfaction-divider"/>
                  <div className="mood-list">
                    <div><span>🙂</span>Happy <b>218</b></div>
                    <div><span>😐</span>Neutral <b>12</b></div>
                    <div><span>🙁</span>Unhappy <b>8</b></div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      <button className="ask-ai" onClick={() => setShowChat(!showChat)}><Sparkles size={18}/>{showChat ? "Close Relay AI" : "Ask Relay AI"}</button>
      {showChat && <div className="chat-popover">
        <div className="chat-head"><span><span className="chat-logo"><Bot size={18}/></span><b>Relay AI Assistant</b></span><button onClick={() => setShowChat(false)}><X size={18}/></button></div>
        <div className="chat-body"><div className="ai-message">Hi Theresa! I can help summarize customer history, find recurring issues, and suggest next steps. What would you like to know?</div><div className="suggestion">Summarize today's open tickets</div><div className="suggestion">Show customers waiting for a reply</div></div>
        <form className="chat-input" onSubmit={e => {e.preventDefault(); setMessage("");}}><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask anything..."/><button type="submit"><Send size={16}/></button></form>
      </div>}
    </main>
  );
}
