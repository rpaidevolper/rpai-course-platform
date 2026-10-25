import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { createSupabaseKnowledgeStore } from "@/lib/knowledge/store";
import { verifyApiToken } from "@/lib/mcp/auth";
import { createSupabaseArtifactStore } from "@/lib/mcp/artifact-store";
import { createSupabaseCourseStore } from "@/lib/mcp/course-store";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerPlatformTools } from "@/lib/mcp/tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformBaseUrl } from "@/lib/upload-token";

/**
 * 講師的 AI 連的 MCP server（claude.ai／Claude 桌面版的自訂連接器、Claude Code plugin、Codex）。
 * 無狀態 Streamable HTTP；每個請求都要帶 Authorization: Bearer rcp_…。
 */
const handler = createMcpHandler(
  (server) =>
    registerPlatformTools(
      server,
      {
        courses: createSupabaseCourseStore(),
        knowledge: createSupabaseKnowledgeStore(createAdminClient()),
        artifacts: createSupabaseArtifactStore(),
      },
      { baseUrl: platformBaseUrl(process.env) },
    ),
  { serverInfo: { name: "rpai-course-platform", version: "0.1.0" }, instructions: SERVER_INSTRUCTIONS },
);

const authed = withMcpAuth(handler, verifyApiToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
