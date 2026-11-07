"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  assigned_to: string | null;
  auth_user_id: string | null;
};

type Profile = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "salesperson" | "customer";
};

type Purchase = {
  id: string;
  customer_id: string;
  order_reference: string | null;
  product_name: string;
  quantity: number;
  amount: number;
  currency: string;
  status: string;
  purchased_at: string;
};

type Conversation = {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  subject: string;
  status: string;
  channel: string;
  created_at: string | null;
};

type PortalMessage = {
  id: string;
  sender_type: string;
  body: string;
  created_at: string | null;
  is_internal_note: boolean | null;
};

type PortalTask = {
  id: string;
  customer_id: string;
  assigned_to: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  created_at: string;
};

type Activity = {
  id: number;
  customer_id: string | null;
  actor_id: string | null;
  event_type: string;
  summary: string;
  created_at: string;
};

type CustomerNotification = {
  id: number;
  conversation_id: string;
  event_type: "reply" | "status";
  message: string;
  created_at: string;
  read_at: string | null;
};

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const code = "code" in error && typeof error.code === "string" ? ` (${error.code})` : "";
    const details = "details" in error && typeof error.details === "string" ? ` ${error.details}` : "";
    return `${String(error.message)}${code}${details}`;
  }
  return "Something went wrong. Please try again.";
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function AdminAndSalesPortal({ role }: { role: "admin" | "salesperson" }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tasks, setTasks] = useState<PortalTask[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");
      setUserId(user.id);

      const [customerResult, purchaseResult, conversationResult, taskResult, activityResult] = await Promise.all([
        supabase.from("customers")
          .select("id,name,email,phone,company,assigned_to,auth_user_id")
          .order("name"),
        supabase.from("purchases")
          .select("id,customer_id,order_reference,product_name,quantity,amount,currency,status,purchased_at")
          .order("purchased_at", { ascending: false }),
        supabase.from("conversations")
          .select("id,customer_id,subject,status,channel,created_at,assigned_to")
          .order("created_at", { ascending: false }),
        supabase.from("resolveiq_tasks")
          .select("id,customer_id,assigned_to,title,description,due_at,status,created_at")
          .order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("resolveiq_activity")
          .select("id,customer_id,actor_id,event_type,summary,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (customerResult.error) throw customerResult.error;
      if (purchaseResult.error) throw purchaseResult.error;
      if (conversationResult.error) throw conversationResult.error;
      if (taskResult.error) throw taskResult.error;
      if (activityResult.error) throw activityResult.error;

      let profileRows: Profile[] = [];
      if (role === "admin") {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("user_id,email,full_name,role")
          .order("created_at", { ascending: false });
        if (profileError) throw profileError;
        profileRows = (data ?? []) as Profile[];
      }

      setCustomers((customerResult.data ?? []) as Customer[]);
      setPurchases((purchaseResult.data ?? []) as Purchase[]);
      setConversations((conversationResult.data ?? []) as Conversation[]);
      setTasks((taskResult.data ?? []) as PortalTask[]);
      setActivities((activityResult.data ?? []) as Activity[]);
      setProfiles(profileRows);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { void load(); }, [load]);

  const salespersonNames = new Map(
    profiles.filter((profile) => profile.role === "salesperson")
      .map((profile) => [profile.user_id, profile.full_name || profile.email])
  );
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const purchaseTotals = purchases.reduce((totals, purchase) => {
    totals.set(purchase.currency, (totals.get(purchase.currency) ?? 0) + Number(purchase.amount));
    return totals;
  }, new Map<string, number>());
  const purchaseValue = [...purchaseTotals.entries()]
    .map(([currency, total]) => money(total, currency))
    .join(" · ") || money(0, "USD");
  const performance = profiles.filter((profile) => profile.role === "salesperson").map((profile) => {
    const assignedCustomerIds = new Set(customers.filter((customer) => customer.assigned_to === profile.user_id).map((customer) => customer.id));
    const salespersonConversations = conversations.filter((conversation) =>
      conversation.assigned_to === profile.user_id || assignedCustomerIds.has(conversation.customer_id)
    );
    const salespersonTasks = tasks.filter((task) => task.assigned_to === profile.user_id);
    return {
      profile,
      customers: assignedCustomerIds.size,
      conversations: salespersonConversations.length,
      resolved: salespersonConversations.filter((conversation) => conversation.status.toLowerCase() === "resolved").length,
      openTasks: salespersonTasks.filter((task) => task.status === "open" || task.status === "in_progress").length,
    };
  });
  const recentActivities = activities;

  async function assignCustomer(customerId: string, salespersonId: string) {
    setSavingId(customerId);
    setNotice("");
    setError("");
    try {
      const { data: updatedCustomer, error: updateError } = await createClient()
        .from("customers")
        .update({ assigned_to: salespersonId || null })
        .eq("id", customerId)
        .select("id")
        .single();
      if (updateError) throw updateError;
      if (!updatedCustomer) throw new Error("The customer was not updated. Check that you are signed in with an admin account.");
      setNotice("Customer assignment updated.");
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSavingId("");
    }
  }

  async function updateRole(profile: Profile, nextRole: Profile["role"]) {
    setSavingId(profile.user_id);
    setNotice("");
    setError("");
    try {
      const { error: rpcError } = await createClient().rpc("set_resolveiq_user_role", {
        target_user_id: profile.user_id,
        target_role: nextRole,
      });
      if (rpcError) throw rpcError;
      setNotice(`${profile.full_name || profile.email} is now a ${nextRole}.`);
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSavingId("");
    }
  }

  async function inviteSalesperson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/salespeople", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), fullName: inviteName.trim() }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not invite salesperson.");
      setInviteName("");
      setInviteEmail("");
      setNotice("Salesperson invitation sent. They must open the invitation email and set a password before signing in.");
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setInviting(false);
    }
  }

  async function saveTeamProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProfile) return;
    setSavingId(editingProfile.user_id);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc("update_resolveiq_team_profile", {
        target_user_id: editingProfile.user_id,
        target_full_name: editingName.trim(),
      });
      if (rpcError) throw rpcError;
      setNotice("Salesperson profile updated.");
      setEditingProfile(null);
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSavingId("");
    }
  }

  async function updateTaskStatus(task: PortalTask, status: PortalTask["status"]) {
    setSavingId(task.id);
    setError("");
    setNotice("");
    try {
      const { data: updatedTask, error: updateError } = await createClient()
        .from("resolveiq_tasks")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", task.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      if (!updatedTask) throw new Error("The task was not updated.");
      setNotice("Task status updated.");
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSavingId("");
    }
  }

  return <main className="portal-page">
    <header className="portal-heading">
      <div><p className="portal-eyebrow">{role === "admin" ? "ADMIN WORKSPACE" : "SALES WORKSPACE"}</p>
        <h1>{role === "admin" ? "Admin portal" : "Sales portal"}</h1>
        <p>{role === "admin"
          ? "Manage the team, assign customers, and review business activity."
          : "Manage your assigned customers, purchases, and conversations."}</p>
      </div>
      <button className="primary-btn" onClick={() => setPurchaseFormOpen(true)}>Record purchase</button>
    </header>
    {error && <div className="data-error" role="alert">{error}</div>}
    {notice && <div className="portal-success" role="status">{notice}</div>}
    <section className="portal-stats">
      <article><span>{role === "admin" ? "Customers" : "Assigned customers"}</span><strong>{loading ? "…" : customers.length}</strong></article>
      <article><span>Purchases</span><strong>{loading ? "…" : purchases.length}</strong></article>
      <article><span>Purchase value by currency</span><strong>{loading ? "…" : purchaseValue}</strong></article>
      <article><span>Conversations</span><strong>{loading ? "…" : conversations.length}</strong></article>
    </section>

    {role === "admin" && <>
      <section className="portal-card">
        <div className="portal-card-heading"><div><h2>Add a salesperson</h2><p>Send an invitation email to join your sales team.</p></div></div>
        <form className="portal-form portal-invite-form" onSubmit={inviteSalesperson}>
          <label>Full name<input value={inviteName} onChange={(event) => setInviteName(event.target.value)} maxLength={120} required /></label>
          <label>Email address<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></label>
          <button className="primary-btn" type="submit" disabled={inviting}>{inviting ? "Sending invitation…" : "Invite salesperson"}</button>
        </form>
      </section>
      <section className="portal-card">
        <div className="portal-card-heading"><div><h2>Team accounts</h2><p>Edit salesperson profiles and manage portal access.</p></div></div>
        {loading ? <p>Loading accounts…</p> : profiles.length === 0 ? <p>No accounts are available.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Portal role</th><th>Manage access</th><th>Profile</th></tr></thead><tbody>
          {profiles.map((profile) => <tr key={profile.user_id}><td>{profile.full_name || "—"}</td><td>{profile.email}</td><td><span className={`portal-role role-${profile.role}`}>{profile.role}</span></td><td><select aria-label={`Set ${profile.email} role`} value={profile.role} disabled={profile.user_id === userId || savingId === profile.user_id} onChange={(event) => void updateRole(profile, event.target.value as Profile["role"])}><option value="admin">Admin</option><option value="salesperson">Salesperson</option><option value="customer">Customer</option></select></td><td>{profile.role === "salesperson" ? <button className="outline-btn" onClick={() => { setEditingProfile(profile); setEditingName(profile.full_name || ""); }}>Edit name</button> : "—"}</td></tr>)}
        </tbody></table></div>}
      </section>
      <section className="portal-card">
        <div className="portal-card-heading"><div><h2>Salesperson performance</h2><p>Current assigned workload and conversation outcomes.</p></div></div>
        {loading ? <p>Loading performance…</p> : performance.length === 0 ? <p>No salesperson accounts yet.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Salesperson</th><th>Assigned customers</th><th>Conversations</th><th>Resolved</th><th>Open tasks</th></tr></thead><tbody>
          {performance.map((row) => <tr key={row.profile.user_id}><td>{row.profile.full_name || row.profile.email}</td><td>{row.customers}</td><td>{row.conversations}</td><td>{row.resolved}</td><td>{row.openTasks}</td></tr>)}
        </tbody></table></div>}
      </section>
    </>}

    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>{role === "admin" ? "Tasks and follow-ups" : "My tasks and follow-ups"}</h2><p>{role === "admin" ? "Create and review tasks assigned to salespeople." : "Track follow-ups for your assigned customers."}</p></div><button className="outline-btn" onClick={() => setTaskFormOpen(true)}>Add task</button></div>
      {loading ? <p>Loading tasks…</p> : tasks.length === 0 ? <p>No tasks or follow-ups have been created.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Task</th><th>Customer</th><th>Due</th><th>Assigned to</th><th>Status</th></tr></thead><tbody>
        {tasks.map((task) => <tr key={task.id}><td><strong>{task.title}</strong>{task.description && <small className="task-description">{task.description}</small>}</td><td>{customerNames.get(task.customer_id) || "Customer"}</td><td>{task.due_at ? new Date(task.due_at).toLocaleString() : "No due date"}</td><td>{role === "admin" ? profiles.find((profile) => profile.user_id === task.assigned_to)?.full_name || profiles.find((profile) => profile.user_id === task.assigned_to)?.email || "Salesperson" : "You"}</td><td><select aria-label={`Update task ${task.title}`} value={task.status} disabled={savingId === task.id} onChange={(event) => void updateTaskStatus(task, event.target.value as PortalTask["status"])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td></tr>)}
      </tbody></table></div>}
    </section>

    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>{role === "admin" ? "All customers" : "My assigned customers"}</h2><p>{role === "admin" ? "Assign each customer to a salesperson." : "These customers are assigned to your account."}</p></div></div>
      {loading ? <p>Loading customers…</p> : customers.length === 0 ? <p>No customers have been assigned yet.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Salesperson</th></tr></thead><tbody>
        {customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.email || "—"}</td><td>{customer.phone || "—"}</td><td>{role === "admin" ? <select aria-label={`Assign ${customer.name}`} value={customer.assigned_to || ""} disabled={savingId === customer.id} onChange={(event) => void assignCustomer(customer.id, event.target.value)}><option value="">Unassigned</option>{profiles.filter((profile) => profile.role === "salesperson").map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.full_name || profile.email}</option>)}</select> : salespersonNames.get(customer.assigned_to || "") || "You"}</td></tr>)}
      </tbody></table></div>}
    </section>

    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>Purchases</h2><p>{role === "admin" ? "All recorded customer purchases." : "Purchases for your assigned customers."}</p></div></div>
      {loading ? <p>Loading purchases…</p> : purchases.length === 0 ? <p>No purchases have been recorded yet.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>
        {purchases.map((purchase) => <tr key={purchase.id}><td>{purchase.order_reference || "—"}</td><td>{customerNames.get(purchase.customer_id) || "Customer"}</td><td>{purchase.product_name}</td><td>{purchase.quantity}</td><td>{money(Number(purchase.amount), purchase.currency)}</td><td>{purchase.status}</td><td>{new Date(purchase.purchased_at).toLocaleDateString()}</td></tr>)}
      </tbody></table></div>}
    </section>

    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>Conversations</h2><p>{role === "admin" ? "All customer support conversations." : "Conversations for your assigned customers."}</p></div></div>
      {loading ? <p>Loading conversations…</p> : conversations.length === 0 ? <p>No conversations have been started yet.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Customer</th><th>Subject</th><th>Channel</th><th>Status</th></tr></thead><tbody>{conversations.map((conversation) => <tr key={conversation.id}><td>{customerNames.get(conversation.customer_id) || "Customer"}</td><td><Link href={`/inbox/${conversation.id}`}>{conversation.subject}</Link></td><td>{conversation.channel}</td><td>{conversation.status}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>Recent activity</h2><p>{role === "admin" ? "Team activity across customers, conversations, and follow-ups." : "Recent activity for your assigned customers."}</p></div></div>
      {loading ? <p>Loading activity…</p> : recentActivities.length === 0 ? <p>No activity has been recorded yet.</p> : <div className="portal-activity-list">{recentActivities.slice(0, 20).map((activity) => <article key={activity.id}><span>{activity.event_type.replaceAll("_", " ")}</span><p>{activity.summary}</p><small>{customerNames.get(activity.customer_id || "") || "Workspace"} · {new Date(activity.created_at).toLocaleString()}</small></article>)}</div>}
    </section>
    {purchaseFormOpen && <PurchaseDialog customers={customers} onClose={() => setPurchaseFormOpen(false)} onSaved={async () => { setPurchaseFormOpen(false); await load(); }} />}
    {taskFormOpen && <TaskDialog customers={customers} salespeople={profiles.filter((profile) => profile.role === "salesperson")} role={role} userId={userId} onClose={() => setTaskFormOpen(false)} onSaved={async () => { setTaskFormOpen(false); await load(); }} />}
    {editingProfile && <div className="portal-modal-backdrop"><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="team-profile-title"><div className="portal-card-heading"><div><h2 id="team-profile-title">Edit salesperson profile</h2><p>{editingProfile.email}</p></div><button className="outline-btn" onClick={() => setEditingProfile(null)}>Close</button></div><form className="portal-form" onSubmit={saveTeamProfile}><label>Full name<input value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={120} required /></label><button className="primary-btn" type="submit" disabled={savingId === editingProfile.user_id}>{savingId === editingProfile.user_id ? "Saving…" : "Save profile"}</button></form></section></div>}
  </main>;
}

function PurchaseDialog({ customers, onClose, onSaved }: { customers: Customer[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [productName, setProductName] = useState("");
  const [reference, setReference] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState("paid");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");
      const { error: insertError } = await supabase.from("purchases").insert({
        customer_id: customerId,
        order_reference: reference.trim() || null,
        product_name: productName.trim(),
        quantity: Number(quantity),
        amount: Number(amount),
        currency,
        status,
        created_by: user.id,
      });
      if (insertError) throw insertError;
      await onSaved();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }

  return <div className="portal-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-dialog-title">
      <div className="portal-card-heading"><div><h2 id="purchase-dialog-title">Record a purchase</h2><p>Only add a purchase after confirming the order details.</p></div><button className="outline-btn" onClick={onClose}>Close</button></div>
      {customers.length === 0 ? <p>Add or assign a customer before recording a purchase.</p> : <form className="portal-form" onSubmit={submit}>
        <label>Customer<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label>Product or item<input required value={productName} onChange={(event) => setProductName(event.target.value)} /></label>
        <div className="portal-form-row"><label>Order reference<input value={reference} onChange={(event) => setReference(event.target.value)} /></label><label>Quantity<input type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label></div>
        <div className="portal-form-row"><label>Amount<input type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>INR</option><option>EUR</option><option>GBP</option><option>AUD</option><option>CAD</option></select></label></div>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option><option value="paid">Paid</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option><option value="refunded">Refunded</option></select></label>
        {error && <p className="data-error" role="alert">{error}</p>}
        <button className="primary-btn" type="submit" disabled={saving || !customerId}>{saving ? "Saving…" : "Save purchase"}</button>
      </form>}
    </section>
  </div>;
}

function TaskDialog({
  customers,
  salespeople,
  role,
  userId,
  onClose,
  onSaved,
}: {
  customers: Customer[];
  salespeople: Profile[];
  role: "admin" | "salesperson";
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [assignedTo, setAssignedTo] = useState(role === "salesperson" ? userId : salespeople[0]?.user_id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data: { user }, error: authError } = await createClient().auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");
      const { error: insertError } = await createClient().from("resolveiq_tasks").insert({
        customer_id: customerId,
        assigned_to: role === "salesperson" ? user.id : assignedTo,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      if (insertError) throw insertError;
      await onSaved();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }

  return <div className="portal-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
      <div className="portal-card-heading"><div><h2 id="task-dialog-title">Create task or follow-up</h2><p>Keep customer work and due dates visible.</p></div><button className="outline-btn" type="button" onClick={onClose}>Close</button></div>
      {customers.length === 0 ? <p>Add or assign a customer before creating a task.</p> : role === "admin" && salespeople.length === 0 ? <p>Invite a salesperson before assigning a task.</p> : <form className="portal-form" onSubmit={submit}>
        <label>Customer<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        {role === "admin" && <label>Assign to<select required value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>{salespeople.map((person) => <option key={person.user_id} value={person.user_id}>{person.full_name || person.email}</option>)}</select></label>}
        <label>Task title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Follow up about the order" /></label>
        <label>Details<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Due date<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <button className="primary-btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Create task"}</button>
      </form>}
    </section>
  </div>;
}

export function AdminPortal() {
  return <AdminAndSalesPortal role="admin" />;
}

export function SalesPortal() {
  return <AdminAndSalesPortal role="salesperson" />;
}

export function CustomerPortal() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salesperson, setSalesperson] = useState<Pick<Profile, "full_name" | "email"> | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [updates, setUpdates] = useState<CustomerNotification[]>([]);
  const [selectedConversation, setSelectedConversation] = useState("");
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");
      const { data: customerRow, error: customerError } = await supabase
        .from("customers")
        .select("id,name,email,phone,company,assigned_to,auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customerRow) throw new Error("Your customer record has not been linked. Please contact the company.");
      let salespersonProfile: Pick<Profile, "full_name" | "email"> | null = null;
      if (customerRow.assigned_to) {
        const { data: assignedProfile, error: assignedProfileError } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("user_id", customerRow.assigned_to)
          .maybeSingle();
        if (assignedProfileError) throw assignedProfileError;
        salespersonProfile = assignedProfile;
      }
      const [purchaseResult, conversationResult, updateResult] = await Promise.all([
        supabase.from("purchases")
          .select("id,customer_id,order_reference,product_name,quantity,amount,currency,status,purchased_at")
          .eq("customer_id", customerRow.id)
          .order("purchased_at", { ascending: false }),
        supabase.from("conversations")
          .select("id,customer_id,subject,status,channel,created_at")
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false }),
        supabase.from("resolveiq_customer_notifications")
          .select("id,conversation_id,event_type,message,created_at,read_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (purchaseResult.error) throw purchaseResult.error;
      if (conversationResult.error) throw conversationResult.error;
      if (updateResult.error) throw updateResult.error;
      setCustomer(customerRow as Customer);
      setSalesperson(salespersonProfile);
      setPurchases((purchaseResult.data ?? []) as Purchase[]);
      setConversations((conversationResult.data ?? []) as Conversation[]);
      setUpdates((updateResult.data ?? []) as CustomerNotification[]);
    } catch (caught) {
      if (!silent) setError(errorText(caught));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer || !subject.trim() || !initialMessage.trim()) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const { error: insertError } = await createClient().rpc("create_resolveiq_customer_conversation", {
        target_subject: subject.trim(),
        target_body: initialMessage.trim(),
      });
      if (insertError) throw insertError;
      setSubject("");
      setInitialMessage("");
      setNotice("Your message was sent to the support team.");
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSending(false);
    }
  }

  async function openConversation(conversationId: string) {
    setSelectedConversation(conversationId);
    setError("");
    try {
      const { data, error: messageError } = await createClient()
        .from("messages")
        .select("id,sender_type,body,created_at,is_internal_note")
        .eq("conversation_id", conversationId)
        .eq("is_internal_note", false)
        .order("created_at");
      if (messageError) throw messageError;
      setMessages((data ?? []) as PortalMessage[]);
      const { error: readError } = await createClient()
        .from("resolveiq_customer_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .is("read_at", null);
      if (readError) throw readError;
      setUpdates((current) => current.map((update) =>
        update.conversation_id === conversationId && !update.read_at
          ? { ...update, read_at: new Date().toISOString() }
          : update
      ));
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim() || !selectedConversation) return;
    setSending(true);
    setError("");
    try {
      const { error: insertError } = await createClient().rpc("reply_resolveiq_customer_conversation", {
        target_conversation_id: selectedConversation,
        target_body: reply.trim(),
      });
      if (insertError) throw insertError;
      setReply("");
      await openConversation(selectedConversation);
      setNotice("Reply sent.");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSending(false);
    }
  }

  return <main className="portal-page">
    <header className="portal-heading"><div><p className="portal-eyebrow">CUSTOMER ACCOUNT</p><h1>{customer ? `Welcome, ${customer.name}` : "My customer portal"}</h1><p>View your recorded purchases and contact your salesperson or support team.</p></div></header>
    {error && <div className="data-error" role="alert">{error}</div>}
    {notice && <div className="portal-success" role="status">{notice}</div>}
    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>Updates</h2><p>Replies and request status changes from your support team. This list refreshes automatically while the page is open.</p></div><button className="outline-btn" onClick={() => void load(true)}>Refresh updates</button></div>
      {updates.length === 0 ? <p>You are up to date. New support replies and request changes will appear here.</p> : <div className="portal-activity-list">{updates.map((update) => <article className={update.read_at ? "" : "portal-update-unread"} key={update.id}><span>{update.event_type === "reply" ? "New reply" : "Request update"}{!update.read_at ? " · New" : ""}</span><p>{update.message}</p><small>{new Date(update.created_at).toLocaleString()}</small><button className="outline-btn" onClick={() => void openConversation(update.conversation_id)}>View conversation</button></article>)}</div>}
    </section>
    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>My purchases</h2><p>Orders and purchase details recorded by the company.</p></div></div>
      {loading ? <p>Loading purchases…</p> : purchases.length === 0 ? <p>No purchases have been added to your account yet.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Order</th><th>Product</th><th>Quantity</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td>{purchase.order_reference || "—"}</td><td>{purchase.product_name}</td><td>{purchase.quantity}</td><td>{money(Number(purchase.amount), purchase.currency)}</td><td>{purchase.status}</td><td>{new Date(purchase.purchased_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>Your salesperson</h2><p>Your assigned contact at the company.</p></div></div>
      {salesperson ? <p><strong>{salesperson.full_name || "Salesperson"}</strong>{salesperson.email ? <> · <a href={`mailto:${salesperson.email}`}>{salesperson.email}</a></> : null}</p> : <p>No salesperson has been assigned to your account yet.</p>}
    </section>
    <section className="portal-card">
      <div className="portal-card-heading"><div><h2>Contact support</h2><p>Create a request or reply to an existing conversation.</p></div></div>
      <form className="portal-form" onSubmit={startConversation}><label>Subject<input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Briefly describe your question" /></label><label>Your message<textarea required rows={3} value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} placeholder="Add details to help us assist you" /></label><button className="primary-btn" type="submit" disabled={sending || !customer || !subject.trim() || !initialMessage.trim()}>{sending ? "Sending…" : "Start a conversation"}</button></form>
      {loading ? <p>Loading conversations…</p> : conversations.length === 0 ? <p>You do not have any support conversations yet.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Subject</th><th>Status</th><th>Started</th><th>Messages</th></tr></thead><tbody>{conversations.map((conversation) => <tr key={conversation.id}><td>{conversation.subject}</td><td>{conversation.status}</td><td>{conversation.created_at ? new Date(conversation.created_at).toLocaleDateString() : "—"}</td><td><button className="outline-btn" onClick={() => void openConversation(conversation.id)}>{selectedConversation === conversation.id ? "Selected" : "View / reply"}</button></td></tr>)}</tbody></table></div>}
    </section>
    {selectedConversation && <section className="portal-card">
      <div className="portal-card-heading"><div><h2>{conversations.find((conversation) => conversation.id === selectedConversation)?.subject || "Conversation"}</h2><p>Messages from you and the support team.</p></div><button className="outline-btn" onClick={() => setSelectedConversation("")}>Close</button></div>
      <div className="portal-messages">{messages.filter((message) => !message.is_internal_note).map((message) => <article key={message.id}><b>{message.sender_type === "customer" ? "You" : "Support"}</b><p>{message.body}</p><small>{message.created_at ? new Date(message.created_at).toLocaleString() : ""}</small></article>)}{messages.length === 0 && <p>No public messages yet.</p>}</div>
      <form className="portal-form" onSubmit={sendReply}><label>Your reply<textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} required /></label><button className="primary-btn" disabled={sending || !reply.trim()}>{sending ? "Sending…" : "Send reply"}</button></form>
    </section>}
  </main>;
}
