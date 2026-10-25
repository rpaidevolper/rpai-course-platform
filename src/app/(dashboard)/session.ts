import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_COOKIE, verifyDashboardSession } from "@/lib/dashboard-auth";

/** 現在是不是登入狀態：讀 cookie，用目前的密碼重新驗一次。 */
export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return verifyDashboardSession(store.get(DASHBOARD_COOKIE)?.value, process.env.DASHBOARD_PASSWORD, new Date());
}

/** 沒登入就導去登入頁，登入後回到 nextPath。受保護的頁面在開頭呼叫。 */
export async function requireSignedIn(nextPath: string): Promise<void> {
  if (!(await isSignedIn())) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
}

/** 登出：刪掉 cookie，導去登入頁。頁首的表單直接把它當 server action 用。 */
export async function signOut() {
  "use server";
  const store = await cookies();
  store.delete(DASHBOARD_COOKIE);
  redirect("/login");
}
