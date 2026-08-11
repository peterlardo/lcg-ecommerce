import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
]

function hasSessionCookie(request: NextRequest) {
  return SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value))
}

export function proxy(request: NextRequest) {
  if (hasSessionCookie(request)) {
    return NextResponse.next()
  }

  const loginUrl = new URL("/auth/connexion", request.url)
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*"],
}
