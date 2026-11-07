"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountProfile = {
  full_name: string | null;
  email: string;
  role: "admin" | "salesperson" | "customer";
};

export function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Please sign in again.");
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("full_name,email,role")
          .eq("user_id", user.id)
          .single();
        if (profileError) throw profileError;
        if (active) {
          setProfile(data as AccountProfile);
          setName(data.full_name ?? "");
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load your profile.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const { error: updateError } = await createClient().rpc("update_resolveiq_profile", {
        target_full_name: name.trim(),
      });
      if (updateError) throw updateError;
      setProfile((current) => current ? { ...current, full_name: name.trim() } : current);
      setNotice("Your profile has been updated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") return;
    setError("");
    setNotice("");
    setDeleting(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete your account.");
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete your account.");
    } finally {
      setDeleting(false);
    }
  }

  return <main className="profile-page">
    <header className="portal-heading">
      <div><p className="portal-eyebrow">ACCOUNT</p><h1>Your profile</h1><p>Update your account name or permanently delete your login.</p></div>
    </header>
    {error && <div className="data-error" role="alert">{error}</div>}
    {notice && <div className="portal-success" role="status">{notice}</div>}
    <section className="portal-card profile-card">
      <div className="portal-card-heading"><div><h2>Personal information</h2><p>Your role and sign-in email are managed securely by your account.</p></div></div>
      {loading ? <p>Loading your profile…</p> : profile && <>
        <form className="portal-form profile-form" onSubmit={saveProfile}>
          <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
          <label>Email address<input value={profile.email} readOnly aria-readonly="true" /></label>
          <label>Portal<input value={profile.role === "admin" ? "Admin" : profile.role === "salesperson" ? "Salesperson" : "Customer"} readOnly aria-readonly="true" /></label>
          <button className="primary-btn" type="submit" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save changes"}</button>
        </form>
      </>}
    </section>
    <section className="portal-card profile-delete-card">
      <div className="portal-card-heading"><div><h2>Delete account</h2><p>This permanently removes your sign-in account. Customer purchase and business history is retained without being linked to your login. This action cannot be undone.</p></div></div>
      {profile?.role === "admin" && <p className="profile-warning">The last remaining admin account cannot be deleted.</p>}
      <label className="profile-delete-confirm">Type <strong>DELETE</strong> to confirm<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label>
      <button className="profile-delete-button" type="button" disabled={deleting || deleteConfirmation !== "DELETE"} onClick={() => void deleteAccount()}>{deleting ? "Deleting account…" : "Permanently delete account"}</button>
    </section>
  </main>;
}
