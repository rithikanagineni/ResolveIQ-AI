
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type");
  const flow = searchParams.get("flow");
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=verification_failed`);
    }
  } else if (tokenHash && (otpType === "invite" || otpType === "recovery" || otpType === "signup")) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=verification_failed`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  const destination = flow === "invite" || flow === "recovery"
    ? "/auth/complete-account"
    : "/portal";
  return NextResponse.redirect(`${origin}${destination}`);
}
