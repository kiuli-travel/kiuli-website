import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // Redirect www to apex domain
  if (hostname === 'www.kiuli.com') {
    url.host = 'kiuli.com'
    return NextResponse.redirect(url, 308)
  }

  // Redirect admin.kiuli.com root to /admin
  if (hostname === 'admin.kiuli.com' && url.pathname === '/') {
    url.pathname = '/admin'
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
