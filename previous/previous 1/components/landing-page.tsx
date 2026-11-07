import Link from "next/link";
import {
  ArrowRight, BarChart3, CheckCircle2, MessageSquare, ShieldCheck,
  ShoppingBag, Users, Zap,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "One team, one customer view",
    description: "Admins assign customers to salespeople, and everyone sees the work relevant to their role.",
  },
  {
    icon: MessageSquare,
    title: "Conversations that stay connected",
    description: "Salespeople and customers can follow support requests and keep the conversation in one place.",
  },
  {
    icon: ShoppingBag,
    title: "Purchases customers can see",
    description: "Keep order and purchase details alongside customer profiles for a clearer service experience.",
  },
  {
    icon: BarChart3,
    title: "A clearer view for owners",
    description: "Review customers, assignments, purchases, and conversations from the admin workspace.",
  },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label="ResolveIQ home">
          <span className="landing-mark"><MessageSquare size={19} /></span>
          <span>ResolveIQ</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#portals">Portals</a>
          <Link className="landing-signin" href="/login">Sign in <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><Zap size={14} /> CUSTOMER &amp; SALES WORKSPACE</p>
          <h1>Better customer relationships, from first sale to ongoing support.</h1>
          <p className="landing-intro">
            ResolveIQ brings your owner, sales team, and customers together to
            manage assignments, purchases, and support conversations.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/login">Sign in to your portal <ArrowRight size={17} /></Link>
            <a className="landing-secondary" href="#portals">Explore the portals</a>
          </div>
          <div className="landing-assurance"><ShieldCheck size={16} /> Private portals with role-based access</div>
        </div>
        <div className="landing-preview" aria-label="ResolveIQ portal overview illustration">
          <div className="preview-top"><span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" /><b>Team overview</b></div>
          <div className="preview-welcome"><small>YOUR CUSTOMER WORKSPACE</small><strong>Good relationships take teamwork.</strong></div>
          <div className="preview-cards">
            <div><Users size={17} /><span>Customers</span><strong>One shared view</strong></div>
            <div><ShoppingBag size={17} /><span>Purchases</span><strong>Orders in context</strong></div>
          </div>
          <div className="preview-assignment"><span><span className="preview-avatar">S</span><span><b>Customer assigned</b><small>Owner → Salesperson</small></span></span><CheckCircle2 size={18} /></div>
          <div className="preview-thread"><span className="preview-avatar customer-avatar">C</span><p><b>Customer support</b><small>Purchases and messages, together.</small></p><MessageSquare size={17} /></div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-heading"><p className="landing-eyebrow">MADE FOR THE WHOLE TEAM</p><h2>Everything in its right place</h2><p>Give each person the tools and information they need—without mixing up access.</p></div>
        <div className="landing-feature-grid">
          {features.map(({ icon: Icon, title, description }) => <article className="landing-feature" key={title}>
            <span><Icon size={20} /></span><h3>{title}</h3><p>{description}</p>
          </article>)}
        </div>
      </section>

      <section className="landing-portals" id="portals">
        <div><p className="landing-eyebrow">THREE PURPOSE-BUILT PORTALS</p><h2>A better experience for every role.</h2><p>Admins manage the business, salespeople look after their assigned customers, and customers can check purchases and get help.</p></div>
        <div className="landing-portal-list">
          <article><span>01</span><div><h3>Admin</h3><p>Manage the team, assign customers, and see the full workspace.</p></div></article>
          <article><span>02</span><div><h3>Salesperson</h3><p>Work with assigned customers, track purchases, and follow conversations.</p></div></article>
          <article><span>03</span><div><h3>Customer</h3><p>See your purchases, contact your salesperson, and get support.</p></div></article>
        </div>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/"><span className="landing-mark"><MessageSquare size={17} /></span><span>ResolveIQ</span></Link>
        <span>One connected workspace for your business and customers.</span>
        <Link href="/login">Sign in <ArrowRight size={14} /></Link>
      </footer>
    </main>
  );
}
