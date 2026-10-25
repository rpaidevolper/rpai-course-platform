/**
 * MCP 工具的回傳格式。成功回 JSON，同時放在 text 與 structuredContent，不認得 structuredContent 的 AI 也讀得到；
 * 失敗用 isError 回白話說明，並指出下一步。
 */
export function ok(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}
