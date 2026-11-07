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
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");
      setUserId(user.id);

      const [customerResult, purchaseResult, conversationResult] = await Promise.all([
        supabase.from("customers")
          .select("id,name,email,phone,company,assigned_to,auth_user_id")
          .order("name"),
        supabase.from("purchases")
          .select("id,customer_id,order_reference,product_name,quantity,amount,currency,status,purchased_at")
          .order("purchased_at", { ascending: false }),
        supabase.from("conversations")
          .select("id,customer_id,subject,status,channel,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (customerResult.error) throw customerResult.error;
      if (purchaseResult.error) throw purchaseResult.error;
      if (conversationResult.error) throw conversationResult.error;

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

  async function assignCustomer(customerId: string, salespersonId: string) {
    setSavingId(customerId);
    setNotice("");
    setError("");
    try {
      const { error: rpcError } = await createClient().rpc("assign_resolveiq_salesperson", {
        target_customer_id: customerId,
        target_salesperson_id: salespersonId || null,
      });
      if (rpcError) throw rpcError;
      setNotice("Customer assignment updated.");
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSavingId("");
    }
  }

  async function updateRole(profile: Profile) {
    const nextRole = profile.role === "salesperson" ? "customer" : "salesperson";
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

    {role === "admin" && <section className="portal-card">
      <div className="portal-card-heading"><div><h2>Team accounts</h2><p>Anyone can choose a portal role when creating an account.</p></div></div>
      {loading ? <p>Loading accounts…</p> : profiles.length === 0 ? <p>No accounts are available.</p> : <div className="portal-table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Portal role</th><th>Action</th></tr></thead><tbody>
        {profiles.map((profile) => <tr key={profile.user_id}><td>{profile.full_name || "—"}</td><td>{profile.email}</td><td><span className={`portal-role role-${profile.role}`}>{profile.role}</span></td><td>{profile.role === "admin" ? "Admin" : <button className="outline-btn" disabled={savingId === profile.user_id} onClick={() => void updateRole(profile)}>{savingId === profile.user_id ? "Saving…" : profile.role === "salesperson" ? "Set as customer" : "Make salesperson"}</button>}</td></tr>)}
      </tbody></table></div>}
    </section>}

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
    {purchaseFormOpen && <PurchaseDialog customers={customers} onClose={() => setPurchaseFormOpen(false)} onSaved={async () => { setPurchaseFormOpen(false); await load(); }} />}
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
  const [selectedConversation, setSelectedConversation] = useState("");
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
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
      const [purchaseResult, conversationResult] = await Promise.all([
        supabase.from("purchases")
          .select("id,customer_id,order_reference,product_name,quantity,amount,currency,status,purchased_at")
          .eq("customer_id", customerRow.id)
          .order("purchased_at", { ascending: false }),
        supabase.from("conversations")
          .select("id,customer_id,subject,status,channel,created_at")
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false }),
      ]);
      if (purchaseResult.error) throw purchaseResult.error;
      if (conversationResult.error) throw conversationResult.error;
      setCustomer(customerRow as Customer);
      setSalesperson(salespersonProfile);
      setPurchases((purchaseResult.data ?? []) as Purchase[]);
      setConversations((conversationResult.data ?? []) as Conversation[]);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
