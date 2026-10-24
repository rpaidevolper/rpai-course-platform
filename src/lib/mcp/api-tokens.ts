import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateToken } from "./tokens";

/** 設定頁產生權杖時填的標籤（spec.md U6），例如「Eddy 的 MacBook」。 */
export const TokenLabelSchema = z
  .string()
  .trim()
  .min(1, "請填標籤，例如這台電腦的名稱")
  .max(100, "標籤最多 100 個字");

/** 列表看得到的欄位。token_hash 不讀出來。 */
export interface ApiTokenRow {
  id: string;
  label: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const ROW_COLUMNS = "id, label, token_prefix, created_at, last_used_at, revoked_at";

/*
 * 以下都吃「帶講師 session 的 client」：api_tokens 的 RLS 只讓本人讀寫，
 * 所以不會列出、也撤銷不了別人的權杖。
 */

/** 替自己產生一組權杖。明文只在回傳值裡出現這一次，資料庫只存 hash。 */
export async function createApiToken(
  supabase: SupabaseClient,
  userId: string,
  label: string,
): Promise<{ token: string; row: ApiTokenRow }> {
  const { token, hash, prefix } = generateToken();
  const { data, error } = await supabase
    .from("api_tokens")
    .insert({ owner_id: userId, label: TokenLabelSchema.parse(label), token_hash: hash, token_prefix: prefix })
    .select(ROW_COLUMNS)
    .single();
  if (error) throw error;
  return { token, row: data as ApiTokenRow };
}

/** 自己的權杖，新的在前；已撤銷的也列出來，畫面上標示。 */
export async function listApiTokens(supabase: SupabaseClient): Promise<ApiTokenRow[]> {
  const { data, error } = await supabase
    .from("api_tokens")
    .select(ROW_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ApiTokenRow[];
}

/** 撤銷後 MCP 立刻回 401。回 false：找不到、不是自己的，或早就撤銷了。 */
export async function revokeApiToken(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}
