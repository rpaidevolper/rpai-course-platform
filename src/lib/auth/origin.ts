import { headers } from "next/headers";

/**
 * 依請求標頭組出講師實際打開的網址（production 是 Vercel 的網域，本機是 127.0.0.1 或 localhost）。
 * 不用 request.nextUrl.origin：開發模式下它固定是 localhost，從 127.0.0.1 登入會導到別的網域、cookie 就掉了。
 */
export function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Server Action 與 Server Component 用：表單送出時有 Origin 標頭就用它。 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? originFromHeaders(h);
}
