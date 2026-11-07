"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  BarChart3, Bell, ChevronDown, CircleHelp, LayoutDashboard, LogOut,
  Link2, Mail, MessageCircle, MessageSquare, Phone, Search, Settings,
  Sparkles, UserRound, Users, Workflow, Menu, X, Send, Bot
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const adminGroups = [
  { label: "ADMIN", items: [
    { label: "Admin portal", href: "/admin", icon: LayoutDashboard },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Inbox", href: "/inbox", icon: MessageSquare },
  ]},
  { label: "MANAGEMENT", items: [
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Automations", href: "/automations", icon: Workflow },
    { label: "Integrations", href: "/integrations", icon: Link2 },
  ]},
];
const salespersonGroups = [
  { label: "SALES", items: [
    { label: "Sales portal", href: "/sales", icon: LayoutDashboard },
    { label: "Assigned to me", href: "/assigned-to-me", icon: UserRound },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Inbox", href: "/inbox", icon: MessageSquare },
  ]},
  { label: "CHANNELS", items: [
    { label: "Website Chat", href: "/website-chat", icon: MessageCircle },
    { label: "Email", href: "/email", icon: Mail },
    { label: "WhatsApp", href: "/whatsapp", icon: Phone },
  ]},
];
type PortalRole = "admin" | "salesperson" | "customer";
type CustomerNotification = {
  id: number;
  conversation_id: string;
  event_type: "reply" | "status";
  message: string;
  created_at: string;
  read_at: string | null;
};

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [chat, setChat] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [customerNotifications, setCustomerNotifications] = useState<CustomerNotification[]>([]);
  const [userMenu, setUserMenu] = useState(false);
  const [topUserMenu, setTopUserMenu] = useState(false);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [role, setRole] = useState<PortalRole | null>(null);
  const [displayName, setDisplayName] = useState("Loading account...");
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (path === "/" || path === "/login" || path === "/signup" || path === "/portal-setup") return;
    let active = true;
    void (async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) return;
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role,full_name,email")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!profile) throw new Error("Your portal profile is missing. Confirm the Supabase portal migration is applied, then sign in again.");
        if (!active) return;
        setRole(profile.role as PortalRole);
        setDisplayName(profile.full_name || profile.email || user.email || "Account");
      } catch (caught) {
        if (active) setProfileError(caught instanceof Error ? caught.message : "Could not load your account.");
      }
    })();
    return () => { active = false; };
  }, [path]);

  useEffect(() => {
    if (role !== "customer") return;
    let active = true;
    const loadNotifications = async () => {
      try {
        const { data, error } = await createClient()
          .from("resolveiq_customer_notifications")
          .select("id,conversation_id,event_type,message,created_at,read_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        if (active) setCustomerNotifications((data ?? []) as CustomerNotification[]);
      } catch (caught) {
        if (active) setProfileError(caught instanceof Error ? caught.message : "Could not load notifications.");
      }
    };
    void loadNotifications();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, 30000);
    window.addEventListener("focus", loadNotifications);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadNotifications);
    };
  }, [role]);

  if (path === "/" || path === "/login" || path === "/signup" || path === "/portal-setup") {
    return <>{children}</>;
  }

  const portalGroups = role === "admin"
    ? adminGroups
    : role === "salesperson"
      ? salespersonGroups
      : role === "customer"
        ? [{ label: "CUSTOMER", items: [{ label: "My portal", href: "/customer-portal", icon: Users }] }]
        : [];
  const pages = [
    ...portalGroups.flatMap((group) => group.items),
    ...(role === "admin" ? [{ label: "Settings", href: "/settings", icon: Settings }] : []),
    ...(role !== "customer" ? [{ label: "Help & Support", href: "/help-support", icon: CircleHelp }] : []),
    { label: "Profile", href: "/profile", icon: UserRound },
  ];
  const matchingPages = query.trim()
    ? pages.filter((page) =>
        page.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  async function signOut() {
    setSignOutError("");
    setSigningOut(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setSignOutError(error.message);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch (caught) {
      setSignOutError(caught instanceof Error ? caught.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  }

  function answerAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = chatQuestion.trim();
    if (!question) return;

    const normalized = question.toLowerCase();
    let response = role === "admin"
      ? "I’m a prototype assistant and a live AI provider isn’t connected yet. Manage the team and workspace in the Admin portal, review support trends in Analytics, or update workspace settings."
      : "I’m a prototype assistant and a live AI provider isn’t connected yet. Review your assigned customers, conversations, and follow-ups in the Sales portal.";
    if (normalized.includes("ticket") || normalized.includes("conversation")) {
      response =
        "Open Inbox to search and filter conversations. Select a subject to view its message history, customer details, and reply to the customer.";
    } else if (normalized.includes("customer")) {
      response =
        "Open Customers to search your directory or add a customer profile with contact information and notes.";
    } else if (normalized.includes("channel") || normalized.includes("connect")) {
      response = role === "admin"
        ? "Open Integrations to review provider setup, or choose Website Chat, Email, or WhatsApp to see channel-specific connection guidance."
        : "Choose Website Chat, Email, or WhatsApp to review channel-specific conversations and connection guidance. Admins manage provider integrations.";
    } else if (normalized.includes("automation")) {
      response = role === "admin"
        ? "Open Automations to manage the available assignment, follow-up, and escalation rules."
        : "Automation rules are managed by an admin. You can review your assigned conversations and follow-ups in the Sales portal.";
    }
    setChatReply(response);
    setChatQuestion("");
  }

  return <div className="app-viewport">
    <div className="dashboard-frame">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><MessageCircle size={20} fill="white" /></div>
          <span className="brand-name">ResolveIQ</span>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setMobile(false)}><X size={18} /></button>
        </div>
        <nav>{portalGroups.map((group) => <div className="nav-section" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = path === item.href;
            return <Link key={item.href} href={item.href} onClick={() => setMobile(false)} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={17} /><span>{item.label}</span>
            </Link>;
          })}
        </div>)}</nav>
        <div className="sidebar-bottom">
          <Link href="/profile" className={`nav-item ${path === "/profile" ? "active" : ""}`}><UserRound size={17} /><span>Profile</span></Link>
          {role === "admin" && <Link href="/settings" className={`nav-item ${path === "/settings" ? "active" : ""}`}><Settings size={17} /><span>Settings</span></Link>}
          {role !== "customer" && <Link href="/help-support" className={`nav-item ${path === "/help-support" ? "active" : ""}`}><CircleHelp size={17} /><span>Help &amp; Support</span></Link>}
          <div className="user-menu-wrap">
            <button className="user-card" aria-expanded={userMenu} onClick={() => setUserMenu(!userMenu)}>
              <img src="https://i.pravatar.cc/80?img=47" alt="" />
              <span><b>{displayName}</b><small>{role || "Account"}</small></span><ChevronDown size={15} />
            </button>
            {userMenu && <div className="shell-popover user-popover">
              <Link href="/profile" onClick={() => setUserMenu(false)}>Profile</Link>
              {role === "admin" && <Link href="/settings" onClick={() => setUserMenu(false)}>Workspace settings</Link>}
              {role !== "customer" && <Link href="/help-support" onClick={() => setUserMenu(false)}>Help &amp; Support</Link>}
              <button onClick={() => void signOut()}>Sign out</button>
              {signOutError && <p role="alert">{signOutError}</p>}
            </div>}
          </div>
          <button className="logout-button" onClick={() => void signOut()} disabled={signingOut}>
            <LogOut size={16}/>{signingOut?"Logging out...":"Log out"}
          </button>
          {signOutError&&<p className="logout-error" role="alert">{signOutError}</p>}
          {profileError&&<p className="logout-error" role="alert">{profileError}</p>}
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={20} /></button>
          <div className="top-spacer" />
          <div className="search-wrap">
            <label className="search-box">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages..." aria-label="Search pages" />
              <Search size={19} />
            </label>
            {matchingPages.length > 0 && <div className="shell-popover search-results">
              {matchingPages.map((page) => <Link key={page.href} href={page.href} onClick={() => setQuery("")}>{page.label}</Link>)}
            </div>}
            {query.trim() && matchingPages.length === 0 && <div className="shell-popover search-results">No matching pages.</div>}
          </div>
          <div className="notification-wrap">
            <button className="icon-button bell" aria-label={`Notifications${role === "customer" && customerNotifications.some((item) => !item.read_at) ? `, ${customerNotifications.filter((item) => !item.read_at).length} unread` : ""}`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19} />{role === "customer" && customerNotifications.some((item) => !item.read_at) && <i />}</button>
            {notificationsOpen && <div className="shell-popover notification-popover">
              <strong>Notifications</strong>
              {role === "customer" ? customerNotifications.length > 0
                ? customerNotifications.map((item) => <Link className="notification-item" key={item.id} href="/customer-portal" onClick={() => setNotificationsOpen(false)}><b>{item.event_type === "reply" ? "New support reply" : "Request status update"}</b><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString()}{!item.read_at ? " · New" : ""}</small></Link>)
                : <p>You’re all caught up. New support replies and request updates will appear here.</p>
                : <p>You’re all caught up. New conversation and assignment alerts will appear here.</p>}
            </div>}
          </div>
          <button className="top-avatar-button" aria-label={`Open ${displayName} account menu`} aria-expanded={topUserMenu} onClick={() => setTopUserMenu(!topUserMenu)}>
            <img className="top-avatar" src="https://i.pravatar.cc/80?img=47" alt="" />
          </button>
        </header>
        {topUserMenu && <div className="top-user-popover shell-popover">
          <b>{displayName}</b>
          <Link href="/profile" onClick={() => setTopUserMenu(false)}>Profile</Link>
          {role === "admin" && <Link href="/settings" onClick={() => setTopUserMenu(false)}>Workspace settings</Link>}
          <button onClick={() => void signOut()}>Sign out</button>
          {signOutError && <p role="alert">{signOutError}</p>}
        </div>}
        <div className="page-body">{children}</div>
      </main>
    </div>
    {role !== "customer" && <button className="ask-ai" onClick={() => setChat(!chat)}><Sparkles size={17} />{chat ? "Close AI" : "Ask ResolveIQ AI"}</button>}
    {role !== "customer" && chat && <div className="chat-popover">
      <div className="chat-head"><span><span className="chat-logo"><Bot size={17} /></span><b>ResolveIQ Assistant</b></span><button aria-label="Close assistant" onClick={() => setChat(false)}><X size={18} /></button></div>
      <div className="chat-body">
        <div className="ai-message">Hi Theresa! I can help you find the right ResolveIQ tools. A live AI provider is not connected in this prototype, but I can answer basic questions about the workspace.</div>
        {chatReply && <div className="ai-message">{chatReply}</div>}
        <button className="suggestion" onClick={() => setChatQuestion("How do I find open tickets?")}>How do I find open tickets?</button>
        <button className="suggestion" onClick={() => setChatQuestion("How do I add a customer?")}>How do I add a customer?</button>
      </div>
      <form className="chat-input" onSubmit={answerAssistant}>
        <input value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} placeholder="Ask about your workspace..." aria-label="Ask the assistant" />
        <button type="submit" aria-label="Send message" disabled={!chatQuestion.trim()}><Send size={15} /></button>
      </form>
    </div>}
  </div>;
}
