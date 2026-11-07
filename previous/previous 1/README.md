# ResolveIQ

ResolveIQ connects admins, salespeople, and customers in one customer-support workspace. Visitors choose a portal before signing in or creating an account. Signup is open for all three roles, and each signed-in role has a shared profile page.

## Included routes
- `/` Public home page
- `/login` Portal selection and sign-in
- `/signup` Portal selection and signup (all roles)
- `/profile` Shared profile editor and account deletion
- `/inbox`
- `/assigned-to-me`
- `/customers`
- `/analytics`
- `/automations`
- `/integrations`
- `/website-chat`
- `/email`
- `/whatsapp`
- `/settings`
- `/help-support`
- `/admin` Admin portal
- `/sales` Salesperson portal
- `/customer-portal` Customer purchases and support portal

## Run in PowerShell
1. Back up your current folder or create a new folder for this project.
2. Extract this ZIP.
3. In the extracted folder run:
   ```powershell
   npm install
   npm run dev
   ```
4. Open http://localhost:3000

## Three portal setup

1. In Supabase, enable new user signups in Authentication settings and run `supabase/migrations/20261107000100_role_portals.sql` in the SQL Editor. The migration creates profiles, customer-to-salesperson assignments, purchase records, role RPCs, and row-level security policies. Review the migration against any custom schema or policies before applying it.
2. At signup, users choose Admin, Salesperson, or Customer. The selected role is applied automatically; no owner approval or manual role promotion is required. Supabase email verification may still be required depending on your Auth settings.
3. Customers sign in at `/login` and see their purchases and support conversations at `/customer-portal`. Salespeople use `/sales`; admins use `/admin`. The `/profile` page is available to all three roles.

**Important:** Admin signup is public and grants full admin access to the workspace. Anyone can choose Admin at signup. Do not use this configuration if admin access should be restricted.

Account deletion uses the Supabase Auth Admin API. Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable for the Next.js server; never expose it with a `NEXT_PUBLIC_` prefix or in client code. Deleting a login leaves its customer and purchase history intact but unlinks that history from the account. The final admin account cannot be deleted.

The migration replaces existing row-level security policies on `profiles`, `customers`, `conversations`, and `messages` to enforce the three portal boundaries. Review existing custom policies before running it. Back up the database first.

The inbox, customer directory, and portals use Supabase for their data flows. Overview and analytics use accessible conversation/message records instead of fabricated metrics.

The AI assistant provides basic workspace guidance but is not connected to a live AI provider. Integration and channel setup actions explain the backend steps required; they do not establish external provider connections. Do not enter provider credentials into the browser prototype.
