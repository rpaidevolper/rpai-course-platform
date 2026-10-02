import { z } from "zod";

/**
 * 講師可選的模型清單；要增減模型改這裡，不要在呼叫端或 UI 寫死字串。
 * 刻意不依賴 Anthropic SDK，前端下拉選單可以直接 import。
 */
export const MODEL_OPTIONS = [
  { id: "claude-opus-5", label: "Claude Opus 5" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1" },
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]["id"];

const MODEL_IDS = MODEL_OPTIONS.map((m) => m.id) as [ModelId, ...ModelId[]];

/** 模型 id 的唯一驗證；API 輸入與從資料庫讀出的 `conversations.model` 都過這個。 */
export const ModelIdSchema = z.enum(MODEL_IDS);

/** 新對話的預設模型，對應 `conversations.model` 的資料庫預設值。 */
export const DEFAULT_MODEL: ModelId = "claude-opus-5";
