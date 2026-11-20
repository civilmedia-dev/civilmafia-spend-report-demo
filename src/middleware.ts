import { NextResponse, type NextRequest } from "next/server";

/**
 * HTTP Basic Auth opcional: se activa solo si BASIC_AUTH_USER y BASIC_AUTH_PASSWORD existen.
 * En Vercel también puedes (o en su lugar) usar Deployment Protection.
 */
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(":");
      if (u === user && rest.join(":") === pass) return NextResponse.next();
    } catch {
      /* cabecera mal formada */
    }
  }
  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Spend CivilMafia", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
