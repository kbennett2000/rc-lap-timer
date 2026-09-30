// Which other sites may call the timer's sync routes (/api/sync): the phone app, served from GitHub Pages. A fork that
// publishes its own phone app sets SYNC_ALLOWED_ORIGINS (comma-separated origins) in /etc/rc-lap-timer.env.
const DEFAULT_ORIGINS = ["https://kbennett2000.github.io"];

export function allowedOrigins(setting = process.env.SYNC_ALLOWED_ORIGINS): string[] {
  const origins = setting
    ?.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return origins && origins.length > 0 ? origins : DEFAULT_ORIGINS;
}

function sameOrigin(request: Request, origin: string): boolean {
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

// The CORS headers for a response to an allowed site (none for anyone else, so their browser won't show it).
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return origin && allowedOrigins().includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

export function withCors<T extends Response>(request: Request, response: T): T {
  for (const [name, value] of Object.entries(corsHeaders(request))) response.headers.set(name, value);
  response.headers.set("Vary", "Origin");
  return response;
}

// The answer to a browser asking whether another site may send a request (a CORS preflight). Chrome's older private
// network check asks with Access-Control-Request-Private-Network; the answer is the same.
export function preflight(request: Request): Response {
  const headers = corsHeaders(request);
  if (!headers["Access-Control-Allow-Origin"]) return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      ...(request.headers.get("access-control-request-private-network") === "true" && {
        "Access-Control-Allow-Private-Network": "true",
      }),
    },
  });
}

// A write from another site that isn't allowed. A browser sends some cross-site requests without asking first, so
// the route itself has to refuse them. Requests without an Origin don't come from another site's page.
export function refusedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && !sameOrigin(request, origin) && !allowedOrigins().includes(origin);
}

export function forbiddenOrigin() {
  return Response.json({ error: "This site may not change the timer's data" }, { status: 403 });
}
