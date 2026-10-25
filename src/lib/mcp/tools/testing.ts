import type { McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";

/** 工具回傳的形狀（見 ./result.ts）。 */
export interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface RegisteredTool {
  config: { inputSchema?: z.ZodType; description?: string; title?: string };
  handler: (args: unknown, ctx: unknown) => unknown;
}

/**
 * 測試用的 MCP server：記下 registerTool 註冊的工具，讓測試直接呼叫 handler，不經過 HTTP。
 * 行為照 SDK：輸入先用 inputSchema 驗證，不合格回 isError、不進 handler；handler 丟出的錯誤也轉成 isError。
 */
export function createTestServer() {
  const tools = new Map<string, RegisteredTool>();

  const server = {
    registerTool(name: string, config: RegisteredTool["config"], handler: RegisteredTool["handler"]) {
      if (tools.has(name)) throw new Error(`工具重複註冊：${name}`);
      tools.set(name, { config, handler });
      return {};
    },
  } as unknown as McpServer;

  /** 以 ownerId 這位講師的權杖呼叫工具。 */
  async function call(name: string, args: Record<string, unknown>, as: { ownerId: string }): Promise<ToolResult> {
    const tool = tools.get(name);
    if (!tool) throw new Error(`沒有這個工具：${name}`);

    let input: unknown = args;
    if (tool.config.inputSchema) {
      const parsed = await tool.config.inputSchema.safeParseAsync(args);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
        return { content: [{ type: "text", text: `Input validation error: ${issues}` }], isError: true };
      }
      input = parsed.data;
    }

    const ctx = {
      http: {
        authInfo: { token: "rcp_test", clientId: as.ownerId, scopes: ["lecturer"], extra: { ownerId: as.ownerId } },
      },
    };
    try {
      return (await tool.handler(input, ctx)) as ToolResult;
    } catch (error) {
      return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
    }
  }

  return {
    server,
    call,
    /** 已註冊的工具名稱，依註冊順序。 */
    toolNames: () => [...tools.keys()],
    /** 某個工具註冊時的設定（標題、描述、inputSchema）。 */
    config: (name: string) => tools.get(name)?.config,
  };
}
