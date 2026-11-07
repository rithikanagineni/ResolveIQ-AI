"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CompleteAccountForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await createClient().auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("This invitation or reset link is no longer active. Request a new link and try again.");

      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/portal");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <Link className="auth-brand" href="/"><span>R</span> ResolveIQ</Link>
      <div className="auth-intro">
        <p className="landing-eyebrow">ACCOUNT SECURITY</p>
        <h1>Set your password</h1>
        <p>Choose a password to finish setting up your account.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" minLength={6} required /></label>
        <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" minLength={6} required /></label>
        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Saving password…" : "Save password"}</button>
      </form>
      <Link className="auth-home-link" href="/login">Back to sign in</Link>
    </section>
  </main>;
}
