"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/session";
import { createApiToken, revokeApiToken, TokenLabelSchema } from "@/lib/mcp/api-tokens";

export interface CreateTokenState {
  /** 剛產生的明文權杖：只在這一次回應裡出現，伺服器不留。 */
  token?: string;
  label?: string;
  error?: string;
}

export async function createTokenAction(_prev: CreateTokenState, formData: FormData): Promise<CreateTokenState> {
  const { supabase, member } = await requireMember();
  const label = TokenLabelSchema.safeParse(String(formData.get("label") ?? ""));
  if (!label.success) return { error: label.error.issues[0].message };

  const { token, row } = await createApiToken(supabase, member.userId, label.data);
  revalidatePath("/settings");
  return { token, label: row.label };
}

export async function revokeTokenAction(formData: FormData): Promise<void> {
  const { supabase } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await revokeApiToken(supabase, id.data);
  revalidatePath("/settings");
}
