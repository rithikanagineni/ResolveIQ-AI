"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  customer_id: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  created_at: string | null;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_id: string | null;
  body: string;
  is_internal_note: boolean | null;
  created_at: string | null;
};

export function ConversationDetail({ id }: { id: string }) {
  const router = useRouter();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");

  async function loadConversation() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data: conversationData, error: conversationError } =
      await supabase
        .from("conversations")
        .select("id,customer_id,subject,status,priority,channel,created_at")
        .eq("id", id)
        .maybeSingle();

    if (conversationError || !conversationData) {
      setError(conversationError?.message ?? "Conversation not found.");
      setLoading(false);
      return;
    }

    setConversation(conversationData);

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("id,name,email,phone,company,notes")
      .eq("id", conversationData.customer_id)
      .maybeSingle();

    if (customerError) {
      setError(customerError.message);
      setLoading(false);
      return;
    }

    setCustomer(customerData);

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select(
        "id,conversation_id,sender_type,sender_id,body,is_internal_note,created_at"
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (messageError) {
      setError(messageError.message);
      setLoading(false);
      return;
    }

    setMessages(messageData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadConversation();
  }, [id]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const messageBody = reply.trim();

    if (!messageBody || sending) return;

    setSending(true);
    setError("");

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Your session has expired. Please log in again.");
      setSending(false);
      return;
    }

    const now = new Date().toISOString();

    const { data: newMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_type: "agent",
        sender_id: user.id,
        body: messageBody,
        is_internal_note: false,
      })
      .select(
        "id,conversation_id,sender_type,sender_id,body,is_internal_note,created_at"
      )
      .single();

    if (insertError) {
      setError(insertError.message);
      setSending(false);
      return;
    }

    setMessages((previous) => [...previous, newMessage]);
    setReply("");

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", id);

    if (updateError) {
      setError(
        "Your reply was saved, but the conversation activity time could not be updated."
      );
    }

    setSending(false);
    router.refresh();
  }

  async function updateStatus(status: string) {
    if (!conversation || status === conversation.status) return;
    setUpdatingStatus(true);
    setError("");
    const now = new Date().toISOString();
    const { data, error: updateError } = await createClient()
      .from("conversations")
      .update({ status, updated_at: now })
      .eq("id", conversation.id)
      .select("id,customer_id,subject,status,priority,channel,created_at")
      .single();
    if (updateError) {
      setError(updateError.message);
    } else {
      setConversation(data);
    }
    setUpdatingStatus(false);
  }

  function formatTime(value: string | null) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <section className="panel content-panel">
        <p>Loading conversation...</p>
      </section>
    );
  }

  if (!conversation) {
    return (
      <section className="panel content-panel">
        <p>{error || "Conversation not found."}</p>
        <Link href="/inbox">Back to Inbox</Link>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <Link
          href="/inbox"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "inherit",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} />
          Back to Inbox
        </Link>

        <div className="panel content-panel">
          <div className="panel-title">
            <div>
              <h2>{conversation.subject}</h2>
              <p>
                {customer?.name ?? "Unknown customer"} · {conversation.channel}
              </p>
            </div>

            <button
              className="outline-btn"
              onClick={() => void loadConversation()}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 14,
            }}
          >
            <label className="conversation-status-control">Request status
              <select value={conversation.status} disabled={updatingStatus} onChange={(event) => void updateStatus(event.target.value)}>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <span className="status">
              Priority: {conversation.priority}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: 12,
            color: "#b42318",
            background: "#fef3f2",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 280px",
          gap: 20,
          alignItems: "start",
        }}
      >
        <section className="panel content-panel">
          <div className="panel-title">
            <div>
              <h2>Message history</h2>
              <p>{messages.length} messages</p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "20px 0",
              minHeight: 250,
            }}
          >
            {messages.length === 0 ? (
              <p>No messages in this conversation yet.</p>
            ) : (
              messages.map((message) => {
                const isAgent = message.sender_type === "agent";

                return (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: isAgent ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      width: "fit-content",
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: message.is_internal_note
                          ? "#fff7e6"
                          : isAgent
                            ? "#eeeaff"
                            : "#f3f4f6",
                        color: "#242238",
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <strong style={{ display: "block", marginBottom: 5 }}>
                        {message.is_internal_note
                          ? "Internal note"
                          : isAgent
                            ? "Agent"
                            : message.sender_type === "customer"
                              ? "Customer"
                              : message.sender_type}
                      </strong>
                      {message.body}
                    </div>

                    <small
                      style={{
                        display: "block",
                        marginTop: 5,
                        color: "#777",
                        fontSize: 11,
                        textAlign: isAgent ? "right" : "left",
                      }}
                    >
                      {formatTime(message.created_at)}
                    </small>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={sendReply}
            style={{
              borderTop: "1px solid #eee",
              paddingTop: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write your reply..."
              rows={4}
              required
              style={{
                width: "100%",
                padding: 13,
                border: "1px solid #ddd",
                borderRadius: 9,
                resize: "vertical",
                font: "inherit",
                fontSize: 14,
              }}
            />

            <button
              type="submit"
              className="primary-btn"
              disabled={sending || !reply.trim()}
              style={{
                justifySelf: "end",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Send size={15} />
              {sending ? "Sending..." : "Send reply"}
            </button>
          </form>
        </section>

        <aside className="panel content-panel">
          <div className="panel-title">
            <div>
              <h2>Customer details</h2>
              <p>Contact information</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
            <div>
              <small style={{ color: "#777" }}>Name</small>
              <p><strong>{customer?.name ?? "Unknown customer"}</strong></p>
            </div>

            <div>
              <small style={{ color: "#777" }}>Email</small>
              <p>{customer?.email || "Not provided"}</p>
            </div>

            <div>
              <small style={{ color: "#777" }}>Phone</small>
              <p>{customer?.phone || "Not provided"}</p>
            </div>

            <div>
              <small style={{ color: "#777" }}>Company</small>
              <p>{customer?.company || "Not provided"}</p>
            </div>

            <div>
              <small style={{ color: "#777" }}>Customer notes</small>
              <p>{customer?.notes || "No notes available"}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}