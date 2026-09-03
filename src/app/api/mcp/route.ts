import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyApiToken } from "@/lib/mcp/auth";
import { createSupabaseJobStore } from "@/lib/mcp/store";
import { registerPlatformTools } from "@/lib/mcp/tools";

/**
 * 講師端 Claude Code plugin 連的 MCP server。
 * 無狀態 Streamable HTTP；每個請求都要帶 Authorization: Bearer rcp_…（見 plugin/.mcp.json）。
 */
const handler = createMcpHandler(
  (server) => registerPlatformTools(server, createSupabaseJobStore()),
  { serverInfo: { name: "rpai-course-platform", version: "0.1.0" } },
);

const authed = withMcpAuth(handler, verifyApiToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
