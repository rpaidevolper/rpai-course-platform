/** 講師 session 用的連線資訊（anon key，RLS 會生效）。service role 只在 admin.ts。 */
export function supabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY（本機先跑 pnpm db:start）");
  }
  return { url, anonKey };
}
