import { redirect } from "next/navigation";
import { cache } from "react";
import { createSessionClient } from "@/lib/supabase/server";

export interface Member {
  userId: string;
  email: string | null;
  workspaceId: string;
  workspaceName: string;
  displayName: string;
}

/**
 * 目前登入的人；沒登入回 null。只驗證 JWT（getClaims），不保證是工作區成員。
 * 同一個請求裡重複呼叫只會查一次。
 */
export const getSignedInUser = cache(async () => {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, userId: data.claims.sub, email };
});

/** 這個人所屬的工作區；不是成員回 null。用他自己的 session 查，RLS 只回他看得到的。 */
export const getMembership = cache(async (): Promise<Member | null> => {
  const user = await getSignedInUser();
  if (!user) return null;
  const { data, error } = await user.supabase
    .from("workspace_members")
    .select("workspace_id, display_name, workspace:workspaces(name)")
    .eq("user_id", user.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const workspace = data.workspace as unknown as { name: string } | null;
  return {
    userId: user.userId,
    email: user.email,
    workspaceId: data.workspace_id,
    workspaceName: workspace?.name ?? "",
    displayName: data.display_name,
  };
});

/**
 * 講師頁面與 Server Action 的入口：沒登入導去登入頁，已登入但不是工作區成員導去「尚未加入工作區」。
 * 回傳的 client 帶講師 session，查詢受 RLS 限制。
 */
export async function requireMember() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const member = await getMembership();
  if (!member) redirect("/no-workspace");
  return { supabase: user.supabase, member };
}
