import type { AuthInfo } from "@modelcontextprotocol/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, looksLikeToken } from "./tokens";

/**
 * mcp-handler 的 verifyToken：把 Bearer 權杖對到講師。
 * 回 undefined 代表拒絕（mcp-handler 會回 401）。
 */
export async function verifyApiToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!looksLikeToken(bearerToken)) return undefined;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("api_tokens")
    .select("id, owner_id")
    .eq("token_hash", hashToken(bearerToken))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return undefined;

  await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    token: bearerToken,
    clientId: data.owner_id,
    scopes: ["lecturer"],
    extra: { ownerId: data.owner_id, tokenId: data.id },
  };
}

/** 從工具呼叫的 authInfo 取講師 id；沒有就是程式錯誤（route 沒掛 withMcpAuth）。 */
export function ownerIdFrom(authInfo: AuthInfo | undefined): string {
  const ownerId = authInfo?.extra?.ownerId;
  if (typeof ownerId !== "string" || !ownerId) {
    throw new Error("未驗證的 MCP 請求：缺少 ownerId");
  }
  return ownerId;
}
