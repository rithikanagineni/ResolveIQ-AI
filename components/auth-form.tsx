"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";
type Portal = "admin" | "salesperson" | "customer";

const portalContent: Record<Portal, { title: string; description: string; icon: typeof Users }> = {
  admin: {
    title: "Admin",
    description: "Access and manage the full workspace.",
    icon: ShieldCheck,
  },
  salesperson: {
    title: "Salesperson",
    description: "Sign in or create a salesperson account.",
    icon: BriefcaseBusiness,
  },
  customer: {
    title: "Customer",
    description: "Sign in or create a customer account.",
    icon: ShoppingBag,
  },
};

export function AuthForm({ mode: initialMode }: { mode: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "verification_failed") {
      setError("Email verification could not be completed. Please sign in or request a new verification email.");
    }
    const requestedPortal = params.get("portal");
    const requestedMode = params.get("mode");
    if (requestedPortal === "admin" || requestedPortal === "salesperson" || requestedPortal === "customer") {
      setPortal(requestedPortal);
    }
    if (requestedMode === "signup" || requestedMode === "login") {
      setMode(requestedMode);
    }
  }, []);

  function choosePortal(nextPortal: Portal, nextMode: AuthMode) {
    setPortal(nextPortal);
    setMode(nextMode);
    setError("");
    setNotice("");
    router.replace(`/login?portal=${nextPortal}&mode=${nextMode}`, { scroll: false });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portal) return;
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              requested_role: portal,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signupError) throw signupError;
        if (data.session) {
          router.replace("/portal");
          router.refresh();
        } else {
          setNotice(`Check your email to verify your ${portalContent[portal].title.toLowerCase()} account.`);
        }
      } else {
        const { error: signinError } = await supabase.auth.signInWithPassword({ email, password });
        if (signinError) throw signinError;
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Could not verify the signed-in user.");
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) {
          router.replace("/portal-setup");
          router.refresh();
          return;
        }
        if (profile.role !== portal) {
          await supabase.auth.signOut();
          throw new Error(`This account is registered as ${profile.role}. Choose the matching portal and sign in again.`);
        }
        router.replace("/portal");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    if (!email.trim()) {
      setError("Enter your email address first so we can send you a password reset link.");
      return;
    }
    setError("");
    setNotice("");
    setResettingPassword(true);
    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?flow=recovery`,
      });
      if (resetError) throw resetError;
      setNotice("If an account exists for this email, a password reset link has been sent. Open it to set a new password.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send a password reset link.");
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/"><span>R</span> ResolveIQ</Link>
        {!portal ? <>
          <div className="auth-intro">
            <p className="landing-eyebrow">WELCOME TO RESOLVEIQ</p>
            <h1>Choose your portal</h1>
            <p>Choose your portal to sign in or create an account. Signup is open for every portal.</p>
          </div>
          <div className="auth-portal-list">{(Object.keys(portalContent) as Portal[]).map((key) => {
            const item = portalContent[key];
            const Icon = item.icon;
            return <article className="auth-portal-option" key={key}>
              <span className="auth-portal-icon"><Icon size={20} /></span>
              <div><h2>{item.title}</h2><p>{item.description}</p></div>
              <div className="auth-portal-actions">
                <button onClick={() => choosePortal(key, "login")}>Sign in</button>
                <button className="auth-signup-link" onClick={() => choosePortal(key, "signup")}>Sign up</button>
              </div>
            </article>;
          })}</div>
        </> : <>
          <button className="auth-back" onClick={() => { setPortal(null); setError(""); setNotice(""); router.replace("/login", { scroll: false }); }}><ArrowLeft size={15} /> All portals</button>
          <div className="auth-intro">
            <p className="landing-eyebrow">{portalContent[portal].title.toUpperCase()} PORTAL</p>
            <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
            <p>{mode === "signup" ? "Enter your details to get started." : `Sign in to your ${portalContent[portal].title.toLowerCase()} account.`}</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && <label>Full name<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" required /></label>}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" minLength={6} required /></label>
            {error && <p className="auth-message auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={16} /></button>
          </form>
          {mode === "login" && <button className="auth-mode-switch" type="button" onClick={() => void sendPasswordReset()} disabled={resettingPassword}>
            {resettingPassword ? "Sending reset link…" : "Forgot your password? Send a reset link"}
          </button>}
          <button className="auth-mode-switch" onClick={() => { const next = mode === "login" ? "signup" : "login"; choosePortal(portal, next); }}>
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </>}
        <Link className="auth-home-link" href="/">Back to ResolveIQ home</Link>
      </section>
    </main>
  );
}
