import { NextRequest, NextResponse } from 'next/server';

/**
 * SITE_SCOPE controls which routes this instance serves.
 *
 *   public    — hardwavestudios.com (default, full public site + user dashboard)
 *   erp       — erp.hardwavestudios.com (ERP / internal admin only)
 *   analyser  — analyser.hardwavestudios.com (Analyser VST webview + auth APIs)
 *   wettboi   — wettboi.hardwavestudios.com (WettBoi VST webview + auth APIs)
 */
type Scope = 'public' | 'erp' | 'analyser' | 'wettboi';

const ALWAYS_ALLOW = [
  /^\/_next\//,
  /^\/favicon/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/public\//,
];

const SCOPE_ALLOW: Record<Scope, RegExp[]> = {
  // Full public site — block only internal ERP/admin routes
  public: [
    /^\/$/,
    /^\/(auth)\//,
    /^\/login/,
    /^\/register/,
    /^\/forgot-password/,
    /^\/reset-password/,
    /^\/dashboard/,
    /^\/products/,
    /^\/pricing/,
    /^\/changelog/,
    /^\/roadmap/,
    /^\/privacy/,
    /^\/terms/,
    /^\/downloads/,
    /^\/app\//,
    /^\/vst\//,
    /^\/contracts/,
    /^\/uploads/,
    /^\/design/,
    /^\/api\/auth/,
    /^\/api\/stripe/,
    /^\/api\/subscription/,
    /^\/api\/user/,
    /^\/api\/orders/,
    /^\/api\/downloads/,
    /^\/api\/library/,
    /^\/api\/license/,
    /^\/api\/updates/,
    /^\/api\/account/,
    /^\/api\/invoices/,
    /^\/api\/cron/,
    /^\/api\/download-file/,
  ],

  // ERP only — internal team
  erp: [
    /^\/erp\//,
    /^\/erp$/,
    /^\/admin\//,
    /^\/admin$/,
    /^\/api\/erp\//,
    /^\/api\/admin\//,
    /^\/api\/auth\//,  // needed for ERP login
  ],

  // Analyser VST webview server
  analyser: [
    /^\/vst\/analyser/,
    /^\/vst$/,
    /^\/api\/auth\//,
    /^\/api\/subscription\//,
    /^\/api\/license\//,
    /^\/api\/updates\//,
  ],

  // WettBoi VST webview server
  wettboi: [
    /^\/vst\/wettboi/,
    /^\/vst$/,
    /^\/api\/auth\//,
    /^\/api\/subscription\//,
    /^\/api\/license\//,
    /^\/api\/updates\//,
  ],
};

const SCOPE_REDIRECT: Record<Scope, string> = {
  public:   'https://erp.hardwavestudios.com',
  erp:      'https://hardwavestudios.com',
  analyser: 'https://hardwavestudios.com',
  wettboi:  'https://hardwavestudios.com',
};

export function middleware(request: NextRequest) {
  const scope = (process.env.SITE_SCOPE ?? 'public') as Scope;
  const path = request.nextUrl.pathname;

  // Always allow Next.js internals and static assets
  if (ALWAYS_ALLOW.some((r) => r.test(path))) {
    return NextResponse.next();
  }

  const allowed = SCOPE_ALLOW[scope];
  if (!allowed) return NextResponse.next(); // unknown scope → open

  if (allowed.some((r) => r.test(path))) {
    return NextResponse.next();
  }

  // Not in scope — redirect to the appropriate main domain
  return NextResponse.redirect(new URL(SCOPE_REDIRECT[scope]));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
