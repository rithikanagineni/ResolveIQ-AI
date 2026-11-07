
"use client";

import { useEffect, useState } from "react";
import { Search, Filter, RefreshCw, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Conversation = {
  id: string;
  customer_id: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  assigned_to: string | null;
  last_message_at: string | null;
  created_at: string | null;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
};

type Message = {
  conversation_id: string;
  body: string;
  created_at: string | null;
  is_internal_note: boolean | null;
};

type InboxItem = Conversation & {
  customerName: string;
  customerEmail: string;
  latestMessage: string;
};

export function InboxList({
  assigned = false,
  channel = "",
}: {
  assigned?: boolean;
  channel?: string;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All status");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadConversations() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Get the current logged-in user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Please log in again to view conversations.");
      setLoading(false);
      return;
    }

    const conversationColumns =
      "id,customer_id,subject,status,priority,channel,assigned_to,last_message_at,created_at";
    let conversations: Conversation[] = [];
    if (assigned) {
      const { data: assignedCustomers, error: customerAssignmentError } =
        await supabase
          .from("customers")
          .select("id")
          .eq("assigned_to", user.id);

      if (customerAssignmentError) {
        setError(customerAssignmentError.message);
        setItems([]);
        setLoading(false);
        return;
      }

      const assignedCustomerIds = (assignedCustomers ?? []).map((customer) => customer.id);
      let byAgentQuery = supabase
        .from("conversations")
        .select(conversationColumns)
        .eq("assigned_to", user.id)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (channel) byAgentQuery = byAgentQuery.eq("channel", channel);

      const { data: byAgent, error: byAgentError } = await byAgentQuery;
      if (byAgentError) {
        setError(byAgentError.message);
        setItems([]);
        setLoading(false);
        return;
      }

      let byCustomer: Conversation[] = [];
      if (assignedCustomerIds.length > 0) {
        let byCustomerQuery = supabase
          .from("conversations")
          .select(conversationColumns)
          .in("customer_id", assignedCustomerIds)
          .order("last_message_at", { ascending: false })
          .limit(100);
        if (channel) byCustomerQuery = byCustomerQuery.eq("channel", channel);
        const { data, error: byCustomerError } = await byCustomerQuery;
        if (byCustomerError) {
          setError(byCustomerError.message);
          setItems([]);
          setLoading(false);
          return;
        }
        byCustomer = (data ?? []) as Conversation[];
      }

      conversations = [...new Map(
        [...((byAgent ?? []) as Conversation[]), ...byCustomer]
          .map((conversation) => [conversation.id, conversation])
      ).values()]
        .sort((a, b) => Date.parse(b.last_message_at ?? b.created_at ?? "") - Date.parse(a.last_message_at ?? a.created_at ?? ""))
        .slice(0, 100);
    } else {
      let conversationQuery = supabase
        .from("conversations")
        .select(conversationColumns)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (channel) conversationQuery = conversationQuery.eq("channel", channel);

      const { data, error: conversationError } = await conversationQuery;
      if (conversationError) {
        setError(conversationError.message);
        setItems([]);
        setLoading(false);
        return;
      }
      conversations = (data ?? []) as Conversation[];
    }

    if (!conversations || conversations.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const customerIds = [
      ...new Set(conversations.map((item) => item.customer_id)),
    ];

    const conversationIds = conversations.map((item) => item.id);

    // Fetch the related customer profiles.
    const { data: customers, error: customerError } = await supabase
      .from("customers")
      .select("id,name,email")
      .in("id", customerIds);

    if (customerError) {
      setError(customerError.message);
      setLoading(false);
      return;
    }

    // Fetch recent messages for these conversations.
    const { data: messages, error: messageError } = await supabase
      .from("messages")
      .select("conversation_id,body,created_at,is_internal_note")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(500);

    if (messageError) {
      setError(messageError.message);
      setLoading(false);
      return;
    }

    const customerMap = new Map(
      ((customers ?? []) as Customer[]).map((customer) => [
        customer.id,
        customer,
      ])
    );

    const messageMap = new Map<string, string>();

    for (const message of (messages ?? []) as Message[]) {
      if (
        !message.is_internal_note &&
        !messageMap.has(message.conversation_id)
      ) {
        messageMap.set(message.conversation_id, message.body);
      }
    }

    const combined: InboxItem[] = conversations.map((conversation) => {
      const customer = customerMap.get(conversation.customer_id);

      return {
        ...conversation,
        customerName: customer?.name ?? "Unknown customer",
        customerEmail: customer?.email ?? "",
        latestMessage:
          messageMap.get(conversation.id) ?? "No messages yet",
      };
    });

    setItems(combined);
    setLoading(false);
  }

  useEffect(() => {
    void loadConversations();
    const handleConversationChange = () => void loadConversations();
    window.addEventListener("resolveiq:conversations-changed", handleConversationChange);

    return () => {
      window.removeEventListener(
        "resolveiq:conversations-changed",
        handleConversationChange
      );
    };
  }, [assigned, channel]);

  const filteredItems = items.filter((item) => {
    const matchesSearch = [
      item.customerName,
      item.customerEmail,
      item.subject,
      item.latestMessage,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      status === "All status" ||
      item.status.toLowerCase() === status.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  function formatTime(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <section className="panel content-panel">
      <div className="panel-title">
        <div>
          <h2>Conversations</h2>
          <p>{filteredItems.length} conversations found</p>
        </div>

        <button
          className="outline-btn"
          onClick={() => void loadConversations()}
          disabled={loading}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: 12,
            margin: "12px 0",
            color: "#b42318",
            background: "#fef3f2",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div className="table-tools">
        <label className="table-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
          />
        </label>

        <label className="filter-select">
          <Filter size={14} />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>All status</option>
            <option>Open</option>
            <option>Pending</option>
            <option>Resolved</option>
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Subject</th>
              <th>Channel</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Last activity</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Loading conversations...</td>
              </tr>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.customerName}</b>
                    <br />
                    <small>{item.customerEmail}</small>
                  </td>
                  <td>
  <Link
    href={`/inbox/${item.id}`}
    style={{
      color: "inherit",
      textDecoration: "none",
      fontWeight: 600,
    }}
  >
    {item.subject}
  </Link>
  <br />
  <small>{item.latestMessage}</small>
</td>
                  <td>{item.channel}</td>
                  <td>{item.priority}</td>
                  <td>
                    <span
                      className={`status ${item.status.toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {formatTime(
                      item.last_message_at ?? item.created_at
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <MessageCircle size={24} />
                    <p>
                      {search
                        ? "No conversations match your search."
                        : "No conversations found. Add a conversation to get started."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
