// Shared CORS helper with origin allowlist.
// Browser-callable functions should use buildCorsHeaders(req) to echo the
// request origin only when it matches the allowlist. Server-to-server callers
// (webhooks, crons) are unaffected because they don't enforce CORS.

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.dev$/,
  /^https:\/\/([a-z0-9-]+\.)*zeusrentalcar\.com$/,
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowOrigin = isAllowedOrigin(origin) ? (origin as string) : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
