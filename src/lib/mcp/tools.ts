import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ARTIFACT_KIND_LABELS, contentTypeFor } from "@/lib/artifacts";
import { ownerIdFrom } from "./auth";
import type { JobStore } from "./store";

function ok(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const JobId = z.string().uuid().describe("工作 id（artifacts.id），從 rpai_platform_list_jobs 取得");

/**
 * 講師的 Claude Code 透過這些工具跟後台互動。
 * 流程：list_jobs → claim_job → （本機產檔）→ request_upload → curl PUT → complete_job。
 * 工具名或參數改了，plugin/skills/rpai-platform-runner/SKILL.md 要同步。
 */
export function registerPlatformTools(server: McpServer, store: JobStore): void {
  server.registerTool(
    "rpai_platform_list_courses",
    {
      title: "列出我的課程",
      description: "列出目前講師在平台上的所有課程（id、標題、最後更新時間）。只讀。",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (_args, ctx) => {
      const courses = await store.listCourses(ownerIdFrom(ctx.http?.authInfo));
      return ok({ count: courses.length, courses });
    },
  );

  server.registerTool(
    "rpai_platform_get_blueprint",
    {
      title: "讀取教學藍圖",
      description:
        "讀取某門課的教學藍圖 JSON。不給 version 就回最新一版。只讀；藍圖要改請講師回後台改，讓它升版。",
      inputSchema: z.object({
        course_id: z.string().uuid().describe("課程 id，從 rpai_platform_list_courses 取得"),
        version: z.number().int().positive().optional().describe("指定版本；省略＝最新"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ course_id, version }, ctx) => {
      const record = await store.getBlueprint(ownerIdFrom(ctx.http?.authInfo), course_id, version);
      if (!record) return fail("找不到這門課或這個版本的藍圖。先用 rpai_platform_list_courses 確認 course_id。");
      return ok({ ...record });
    },
  );

  server.registerTool(
    "rpai_platform_list_jobs",
    {
      title: "列出待生成的教材",
      description:
        "列出後台排下來、還沒有人認領的產檔工作（status=pending）。每筆含 kind（outline=課程大綱、slides=簡報、handbook=學員手冊）、課程、藍圖版本、講師的額外指示。只讀。",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (_args, ctx) => {
      const jobs = await store.listPendingJobs(ownerIdFrom(ctx.http?.authInfo));
      return ok({
        count: jobs.length,
        jobs: jobs.map((job) => ({ ...job, kind_label: ARTIFACT_KIND_LABELS[job.kind] })),
      });
    },
  );

  server.registerTool(
    "rpai_platform_claim_job",
    {
      title: "認領工作",
      description:
        "認領一筆工作（pending → generating），回傳完整的教學藍圖 JSON 與講師指示。認領後才可以 request_upload。已被認領或不存在會回錯誤。",
      inputSchema: z.object({
        job_id: JobId,
        claimed_by: z.string().min(1).max(100).describe("誰在做：機器名稱或使用者名稱，方便後台顯示"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ job_id, claimed_by }, ctx) => {
      const job = await store.claimJob(ownerIdFrom(ctx.http?.authInfo), job_id, claimed_by);
      if (!job) return fail("工作不存在、不屬於你，或已經被認領。重新 rpai_platform_list_jobs 看目前狀態。");
      return ok({ ...job, kind_label: ARTIFACT_KIND_LABELS[job.kind] });
    },
  );

  server.registerTool(
    "rpai_platform_request_upload",
    {
      title: "取得上傳網址",
      description:
        "替已認領的工作取得一次性的 signed upload URL。拿到後用 curl 上傳：curl -sS -f -X PUT -H \"Content-Type: <content_type>\" --data-binary @<檔案> \"<upload_url>\"，再呼叫 rpai_platform_complete_job。只接受 .pptx / .docx / .pdf / .md。",
      inputSchema: z.object({
        job_id: JobId,
        filename: z.string().min(1).max(200).describe("要上傳的檔名（含副檔名），例如 週報課_簡報.pptx"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ job_id, filename }, ctx) => {
      const contentType = contentTypeFor(filename);
      if (!contentType) return fail("只接受 .pptx / .docx / .pdf / .md，請確認檔名副檔名。");
      const result = await store.createUploadUrl(ownerIdFrom(ctx.http?.authInfo), job_id, filename);
      if (!result) return fail("工作不存在、不屬於你，或還沒認領（要先 rpai_platform_claim_job）。");
      return ok({ ...result, content_type: contentType, expires_in_seconds: 7200 });
    },
  );

  server.registerTool(
    "rpai_platform_complete_job",
    {
      title: "完成工作",
      description: "檔案上傳成功後呼叫，把工作標成 ready 並記下檔案位置。伺服器會確認檔案真的存在。",
      inputSchema: z.object({
        job_id: JobId,
        storage_path: z.string().min(1).describe("rpai_platform_request_upload 回傳的 storage_path"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ job_id, storage_path }, ctx) => {
      const result = await store.completeJob(ownerIdFrom(ctx.http?.authInfo), job_id, storage_path);
      if (result === "not_found") return fail("工作不存在或不屬於你。");
      if (result === "missing_file") return fail("Storage 裡找不到這個檔案，請確認 curl 上傳有成功（回應 200）再重試。");
      return ok({ job_id, status: "ready", storage_path });
    },
  );

  server.registerTool(
    "rpai_platform_fail_job",
    {
      title: "回報失敗",
      description: "產檔失敗或使用者取消時呼叫，把工作標成 failed 並記下原因，讓後台不會一直顯示「生成中」。",
      inputSchema: z.object({
        job_id: JobId,
        error: z.string().min(1).max(2000).describe("失敗原因，給講師看的白話說明"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ job_id, error }, ctx) => {
      const done = await store.failJob(ownerIdFrom(ctx.http?.authInfo), job_id, error);
      if (!done) return fail("工作不存在或不屬於你。");
      return ok({ job_id, status: "failed" });
    },
  );
}
