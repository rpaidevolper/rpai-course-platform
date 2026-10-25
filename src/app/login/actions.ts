"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkPassword,
  DASHBOARD_COOKIE,
  DASHBOARD_SESSION_DAYS,
  safeNextPath,
  signDashboardSession,
} from "@/lib/dashboard-auth";

export type LoginState = { error?: string };

/** 登入：密碼對了才設 cookie，然後導去 next（只接受站內路徑）。 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return { error: "尚未設定密碼：請 owner 在 Vercel 設定 DASHBOARD_PASSWORD。" };

  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password, expected)) {
    return { error: "密碼不對。" };
  }

  const store = await cookies();
  store.set({
    name: DASHBOARD_COOKIE,
    value: signDashboardSession(expected, new Date()),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DASHBOARD_SESSION_DAYS * 24 * 60 * 60,
  });

  const next = formData.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : null));
}
