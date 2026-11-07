
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims ?? null;
  const pathname = request.nextUrl.pathname;
  const isAuthPage =
    pathname === "/login" || pathname === "/signup";
  const isCallback = pathname.startsWith("/auth/callback");
  const isSetupPage = pathname === "/portal-setup";
  const isPublicPage = pathname === "/" || isAuthPage || isCallback || isSetupPage;

  if (!claims && !isPublicPage) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!claims) return response;
  if (pathname === "/") return response;

  const userId = typeof claims.sub === "string" ? claims.sub : null;
  if (!userId) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/portal-setup";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (isSetupPage) return response;
  if (profileError || !profile) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/portal-setup";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const homeByRole = {
    admin: "/admin",
    salesperson: "/sales",
    customer: "/customer-portal",
  } as const;
  const role = profile.role as keyof typeof homeByRole;
  const home = homeByRole[role] ?? "/portal-setup";

  if (isAuthPage || pathname === "/portal") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = home;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (
    (pathname.startsWith("/admin") && role !== "admin") ||
    (pathname.startsWith("/sales") && role !== "salesperson") ||
    (pathname.startsWith("/customer-portal") && role !== "customer") ||
    (role === "customer" &&
      !pathname.startsWith("/customer-portal") &&
      pathname !== "/profile")
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = home;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};