/**
 * Middleware
 *
 * Protects /editor/* and /dashboard routes.
 * Allows /, /login, /signup, /api/auth/* publicly.
 */

import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/signup"];
const publicPrefixes = ["/api/auth", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow public prefixes
  for (const prefix of publicPrefixes) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next();
    }
  }

  // For protected routes, check for session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
