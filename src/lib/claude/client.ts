import Anthropic from "@anthropic-ai/sdk";

/** 全專案唯一的模型設定；要換模型改這裡，不要在呼叫端寫死字串。 */
export const MODEL = "claude-opus-5";

let client: Anthropic | undefined;

/**
 * 延遲建立的 Anthropic client（讀 ANTHROPIC_API_KEY）。
 * 只能在 server 端用；延遲建立是為了讓沒有金鑰的環境（測試、build）也能 import 這個模組。
 */
export function getAnthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
