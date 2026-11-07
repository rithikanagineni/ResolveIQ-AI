import Link from "next/link";

export default function PortalSetupPage() {
  return (
    <main className="portal-setup-page">
      <section className="portal-card">
        <p className="portal-eyebrow">ACCOUNT SETUP</p>
        <h1>Your portal is not ready yet</h1>
        <p>
          The ResolveIQ Supabase migration may not have been applied yet, or
          your account profile could not be created. Contact your app
          administrator to check the database setup, then sign in again.
        </p>
        <Link className="outline-btn" href="/login">Return to sign in</Link>
      </section>
    </main>
  );
}
