import "server-only";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profileError) throw profileError;

    if (profile.role === "admin") {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if (countError) throw countError;
      if (count === null) {
        throw new Error("Could not verify whether another admin account exists.");
      }
      if (count <= 1) {
        return NextResponse.json(
          { error: "The final admin account cannot be deleted. Promote another trusted owner first." },
          { status: 409 }
        );
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.");
    }

    const adminClient = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not delete your account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
