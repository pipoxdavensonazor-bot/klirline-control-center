export function routeAccess(pathname, method = "GET") {
  if (pathname === "/api/health") return "public";
  if (method === "GET" && pathname === "/api/sites") return "public";
  if (pathname.startsWith("/api/playbooks/")) return "public";
  if (pathname.startsWith("/api/")) return "session";
  return "asset";
}
