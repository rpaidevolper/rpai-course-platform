import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

/**
 * 延遲建立的 Anthropic client（讀 ANTHROPIC_API_KEY）。
 * 只能在 server 端用；延遲建立是為了讓沒有金鑰的環境（測試、build）也能 import 這個模組。
 */
export function getAnthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
