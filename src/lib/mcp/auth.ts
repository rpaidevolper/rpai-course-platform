import type { AuthInfo } from "@modelcontextprotocol/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, looksLikeToken } from "./tokens";

/** 一個 MCP 請求是誰發的：權杖對到的講師，以及他所屬的工作區（所有工具都以它過濾）。 */
export interface Instructor {
  userId: string;
  workspaceId: string;
}

/**
 * mcp-handler 的 verifyToken：把 Bearer 權杖對到講師與工作區。
 * 回 undefined 代表拒絕（mcp-handler 會回 401）。
 */
export async function verifyApiToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!looksLikeToken(bearerToken)) return undefined;

  const supabase = createAdminClient();
  const { data: token } = await supabase
    .from("api_tokens")
    .select("id, owner_id")
    .eq("token_hash", hashToken(bearerToken))
    .is("revoked_at", null)
    .maybeSingle();
  if (!token) return undefined;

  // 權杖有效還不夠：被移出工作區的人，權杖要立刻失效。
  // 全團隊只有一個工作區（ADR 0004）；屬於多個工作區時 maybeSingle 會回錯誤，一樣拒絕。
  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", token.owner_id)
    .maybeSingle();
  if (!member) return undefined;

  await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", token.id);

  return {
    token: bearerToken,
    clientId: token.owner_id,
    scopes: ["lecturer"],
    extra: { userId: token.owner_id, workspaceId: member.workspace_id, tokenId: token.id },
  };
}

/** 從工具呼叫的 authInfo 取講師與工作區；沒有就是程式錯誤（route 沒掛 withMcpAuth）。 */
export function instructorFrom(authInfo: AuthInfo | undefined): Instructor {
  const userId = authInfo?.extra?.userId;
  const workspaceId = authInfo?.extra?.workspaceId;
  if (typeof userId !== "string" || !userId || typeof workspaceId !== "string" || !workspaceId) {
    throw new Error("未驗證的 MCP 請求：缺少 userId 或 workspaceId");
  }
  return { userId, workspaceId };
}
