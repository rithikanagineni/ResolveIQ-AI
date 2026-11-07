# ResolveIQ

ResolveIQ is a customer-support workspace for admins, salespeople, and customers. It brings customer records, purchases, conversations, follow-ups, and support updates together in role-specific portals.

> **Project status:** ResolveIQ is an active application prototype. Supabase provides authentication and data storage. The AI assistant and external channel/integration setup screens are guidance-only and are not connected to live providers.

## Features

### Admin portal

- Invite salespeople and manage user roles and salesperson profiles.
- Review all customers, purchases, conversations, and workspace activity.
- Assign customers to salespeople and create follow-up tasks for the team.
- Review salesperson workload and conversation outcomes.
- Manage workspace settings, analytics, integrations, and automations.

### Salesperson portal

- Work with assigned customers, purchases, and conversation history.
- Reply to customer conversations and update their status.
- Create and track customer tasks and follow-ups.
- Use the prototype assistant for workspace guidance.

### Customer portal

- View purchases and the salesperson assigned to their account.
- Start support conversations, send replies, and track request status.
- Receive in-app updates when support replies or changes a request's status.

### Shared account features

- Portal-specific signup and sign-in.
- Profile editing, password recovery, and account deletion.
- Role-aware navigation and protected portal routes.

## Technology

- [Next.js](https://nextjs.org/) 15 with the App Router
- React 19 and TypeScript
- [Supabase](https://supabase.com/) Auth, Postgres, and row-level security
- `@supabase/ssr` for browser and server authentication
- Lucide icons

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project

## Getting started

1. Clone or download this repository, then open a terminal in the project directory.
2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the project root and set the following values from your Supabase project:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is required for server-side salesperson invitations and account deletion. Keep it secret: do not add a `NEXT_PUBLIC_` prefix, expose it in browser code, or commit `.env.local`.

4. Configure Supabase Auth:
   - Enable email signups.
   - Add your local application URL (for example, `http://localhost:3000`) and deployed application URL to the Auth redirect URL allowlist.
   - Configure email verification and SMTP according to your environment. Invitation, verification, and password-reset links depend on Supabase Auth email delivery.

5. Apply the database migrations in order (see [Database setup](#database-setup)).
6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## Database setup

Run the SQL files in `supabase/migrations` in filename order using the Supabase SQL Editor or your normal migration workflow:

1. `20261107000100_role_portals.sql` — roles and profiles, customer assignment, purchases, portal data access policies, and role-specific functions.
2. `20261107000200_customer_assignment_permissions.sql` — permissions required for administrators to assign customers.
3. `20261107000300_portal_operations.sql` — tasks and follow-ups, activity history, customer notifications, workspace settings, and associated policies and triggers.

These migrations modify row-level security policies on application tables. Back up your database and review existing custom policies before applying them to a database with existing data or customizations.

## Portals and routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Public project landing page | Public |
| `/login` | Choose a portal and sign in | Public |
| `/signup` | Choose a portal and create an account | Public |
| `/admin` | Team, customer assignment, performance, and operations | Admin |
| `/sales` | Salesperson customer and follow-up workspace | Salesperson |
| `/customer-portal` | Customer purchases and support | Customer |
| `/inbox` | Conversation list | Admin and salesperson |
| `/inbox/[id]` | Conversation details and replies | Admin and salesperson |
| `/assigned-to-me` | Assigned conversation queue | Salesperson |
| `/customers` | Customer directory | Admin and salesperson |
| `/analytics` | Support metrics from available records | Admin |
| `/automations` | Automation setup guidance | Admin |
| `/integrations` | Integration setup guidance | Admin |
| `/settings` | Workspace settings | Admin |
| `/profile` | Edit or delete the signed-in account | All signed-in roles |

Additional channel guidance pages are available at `/website-chat`, `/email`, and `/whatsapp`. `/help-support` is available to staff roles.

## Access and account behavior

- Portal access is selected at signup. The application uses role-aware navigation and middleware route checks, with Supabase row-level security protecting database records.
- Admin signup is currently public and grants administrator access. **Anyone who can create an account can select Admin.** Restrict or disable public admin registration before using the application with real customer or business data.
- An invited salesperson must open the invitation email and set a password before signing in. If the invitation has already been used or expired, use the password-reset option on the sign-in page.
- Customer portal data is associated with the signed-in customer account. Make sure customer records are correctly linked to customer accounts in Supabase.
- Account deletion uses the Supabase Auth Admin API. The final admin account cannot be deleted. Customer and purchase history may be retained without its account link.

## Available commands

```bash
npm run dev    # Start the local development server
npm run build  # Create a production build and check TypeScript
npm run start  # Serve the production build
```

## Current limitations

- The assistant is a prototype and does not call a live AI model.
- Integration and channel pages provide setup guidance only. They do not connect Gmail, WhatsApp, a website widget, or other external providers.
- Customer notifications are in-app updates, not email or push notifications.
- Analytics are calculated from the conversation and message records available to the signed-in user. The project does not currently store customer satisfaction ratings.
- There is no automated test script configured in `package.json`; use `npm run build` to validate production compilation and types.

## Security notes

- Never commit `.env.local` or share its contents.
- Never expose the Supabase service-role key to client-side code. It bypasses row-level security and must only be used by trusted server routes.
- Review and test role assignments, RLS policies, Auth redirect allowlists, and email delivery settings before production deployment.
- Public Admin signup is not appropriate for a production workspace unless access is intentionally open.
