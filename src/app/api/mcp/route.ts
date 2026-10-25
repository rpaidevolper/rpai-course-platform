import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyApiToken } from "@/lib/mcp/auth";
import { createSupabaseCourseStore } from "@/lib/mcp/course-store";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { createSupabaseJobStore } from "@/lib/mcp/job-store";
import { registerPlatformTools } from "@/lib/mcp/tools";

/**
 * 講師的 AI 連的 MCP server（claude.ai／Claude 桌面版的自訂連接器、Claude Code plugin、Codex）。
 * 無狀態 Streamable HTTP；每個請求都要帶 Authorization: Bearer rcp_…。
 */
const handler = createMcpHandler(
  (server) =>
    registerPlatformTools(server, {
      courses: createSupabaseCourseStore(),
      jobs: createSupabaseJobStore(),
    }),
  { serverInfo: { name: "rpai-course-platform", version: "0.1.0" }, instructions: SERVER_INSTRUCTIONS },
);

const authed = withMcpAuth(handler, verifyApiToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
