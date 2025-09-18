+2
-10

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/platform"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token");

  const isProtectedRoute = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  // The middleware only checks for the presence of the HttpOnly cookie. The
  // landing page is now accessible even for authenticated users so the check is
  // limited to protected areas of the app.

  if (!token && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/platform/:path*"],
};