import "server-only";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError) throw authError;
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { data: profile, error: profileError } = await sessionClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profileError) throw profileError;
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can invite salespeople." }, { status: 403 });
    }

    const body = await request.json() as { email?: unknown; fullName?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 120) {
      return NextResponse.json({ error: "Enter a valid email address and a name up to 120 characters." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Salesperson invitations are not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.");
    }

    const adminClient = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, requested_role: "salesperson" },
      redirectTo: new URL("/auth/callback?flow=invite", request.url).toString(),
    });
    if (inviteError) {
      if (/already registered|already been registered|user exists/i.test(inviteError.message)) {
        return NextResponse.json({
          error: "This email already has an account. Ask the salesperson to open their invitation email to set a password, or use 'Forgot your password?' on the sign-in page.",
        }, { status: 409 });
      }
      throw inviteError;
    }

    return NextResponse.json({ userId: data.user.id, email: data.user.email });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not invite salesperson.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
