
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Search, Plus, X, Users, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  created_at: string | null;
};

export function CustomersDirectory() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");

  const supabase = useMemo(() => createClient(), []);

  async function loadCustomers() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("customers")
      .select("id,name,email,phone,company,notes,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setCustomers([]);
    } else {
      setCustomers((data ?? []) as Customer[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  const filteredCustomers = customers.filter((customer) =>
    [
      customer.name,
      customer.email ?? "",
      customer.phone ?? "",
      customer.company ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Your session could not be verified. Please log in again.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("customers")
      .insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        notes: notes.trim() || null,
        created_by: user.id,
        assigned_to: profile.role === "salesperson" ? user.id : null,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setNotes("");
    setShowForm(false);
    setSaving(false);

    await loadCustomers();
  }

  return (
    <section className="panel content-panel">
      <div className="panel-title">
        <div>
          <h2>Customer directory</h2>
          <p>
            {customers.length} customers · Customer profiles and contact details
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={() => {
            setError("");
            setShowForm(!showForm);
          }}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Close" : "Add customer"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={addCustomer}
          style={{
            padding: 20,
            margin: "16px 0",
            background: "#f8f7ff",
            border: "1px solid #e7e3ff",
            borderRadius: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          <label>
            Customer name *
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter customer name"
              style={inputStyle}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              style={inputStyle}
            />
          </label>

          <label>
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              style={inputStyle}
            />
          </label>

          <label>
            Company
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
              style={inputStyle}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional customer information"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <div style={{ gridColumn: "1 / -1" }}>
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save customer"}
            </button>
          </div>
        </form>
      )}

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
          />
        </label>

        <button
          className="outline-btn"
          onClick={() => void loadCustomers()}
          disabled={loading}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Company</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Loading customers...</td>
              </tr>
            ) : filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td><b>{customer.name}</b></td>
                  <td>{customer.email || "—"}</td>
                  <td>{customer.phone || "—"}</td>
                  <td>{customer.company || "—"}</td>
                  <td>
                    {customer.created_at
                      ? new Date(customer.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <Users size={24} />
                    <p>
                      {search
                        ? "No customers match your search."
                        : "No customers yet. Add your first customer."}
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

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 7,
  padding: "11px 12px",
  border: "1px solid #dedbea",
  borderRadius: 8,
  background: "#ffffff",
  color: "#25223a",
  font: "inherit",
  boxSizing: "border-box" as const,
};
