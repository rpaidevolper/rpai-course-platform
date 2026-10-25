import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/dashboard-auth";
import { ThemeToggle } from "../_components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "登入 · RPAI 課程平台",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const configured = Boolean(process.env.DASHBOARD_PASSWORD);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-12">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <section className="mt-4 rounded-lg bg-card p-6 shadow-[0_3px_16px_rgba(1,20,85,0.06)]">
        <p className="text-xs font-bold text-body-muted">RPAI 數位優化器</p>
        <h1 className="mt-1 text-xl font-bold text-ink">RPAI 課程平台</h1>
        <p className="mt-2 text-sm text-body">請輸入團隊共用的密碼。</p>
        {!configured && (
          <p role="alert" className="mt-4 rounded-md bg-danger-tint px-3 py-2 text-sm font-bold text-danger">
            尚未設定密碼：請 owner 在 Vercel 設定 DASHBOARD_PASSWORD。
          </p>
        )}
        <LoginForm next={safeNextPath(typeof next === "string" ? next : undefined)} configured={configured} />
      </section>
      <Link href="/demo" className="mt-6 text-center text-sm font-bold text-accent underline underline-offset-2">
        看設計稿
      </Link>
    </main>
  );
}
