import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  ARTIFACT_KINDS,
  ARTIFACT_KIND_LABELS,
  buildStoragePath,
  contentTypeFor,
  sanitizeFilename,
} from "@/lib/artifacts";
import {
  checkArtifactRequest,
  checkEditedFrom,
  resolveUpstream,
  staleReasons,
  type ArtifactRecord,
} from "@/lib/artifact-rules";
import { createUploadToken, uploadPageUrl } from "@/lib/upload-token";
import { ownerIdFrom } from "../auth";
import type { ArtifactStore } from "../artifact-store";
import { fail, ok } from "./result";

/** Storage 的 signed upload URL 有效秒數（Supabase 固定 2 小時）。 */
const SIGNED_UPLOAD_EXPIRES_SECONDS = 2 * 60 * 60;
/** 下載網址的有效秒數。 */
const DOWNLOAD_EXPIRES_SECONDS = 10 * 60;

const NOT_FOUND_COURSE = "找不到這門課。先用 rpai_platform_list_courses 確認 course_id。";
const NOT_FOUND_ARTIFACT = "找不到這份產物，或不屬於你。先用 rpai_platform_list_artifacts 看這門課的產物 id。";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** 列表排序：種類（課程大綱、簡報、學員手冊）→ 天由小到大 → 版本由大到小。 */
function byKindDayVersion(a: ArtifactRecord, b: ArtifactRecord): number {
  return (
    ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind) ||
    (a.day ?? 0) - (b.day ?? 0) ||
    b.version - a.version
  );
}

/**
 * 產物：講師的 AI 把自己產出的教材存回平台。流程寫在工具描述裡（ADR 0008）。
 * 檔案不走 MCP 傳：request 給 signed URL，AI 用 curl PUT 上傳，再 complete。
 */
export function registerArtifactTools(
  server: McpServer,
  store: ArtifactStore,
  options: { baseUrl: string; now?: () => Date },
): void {
  const now = options.now ?? (() => new Date());

  server.registerTool(
    "rpai_platform_request_artifact_upload",
    {
      title: "取得產物上傳網址",
      description:
        "替講師這次要存回平台的產物，取得一次性的上傳網址。先依種類看規則：outline＝課程大綱，.docx，整門課一份，不給 day；slides＝簡報，.pptx，一天一份，要給 day（1 到藍圖天數）；handbook＝學員手冊，.html，一天一份，只限藍圖裡有動手環節的天。學員手冊的上游是那一天的簡報，不給 upstream_artifact_id 就自動接那天最新的 ready 簡報。blueprint_version 填這份產物照的那一版藍圖。講師自己改過檔案再存回時，填 edited_from_id（原本那一份的 id），會存成它的新版本。不合規則會回白話錯誤，不會留下任何產物。上傳：curl -sS -f -X PUT -H \"Content-Type: <content_type>\" --data-binary @<檔案> \"<upload_url>\"，回應 200 後呼叫 rpai_platform_complete_artifact_upload。網路連不出去或上傳失敗時，把 upload_page_url 給講師，請他在瀏覽器打開上傳（2 小時內有效，只能用一次）。warnings 不擋上傳，但要照實告訴講師。",
      inputSchema: z.object({
        course_id: z.string().uuid().describe("課程 id，從 rpai_platform_list_courses 取得"),
        kind: z
          .enum(ARTIFACT_KINDS)
          .describe("outline＝課程大綱（.docx，整門課一份）；slides＝簡報（.pptx，一天一份）；handbook＝學員手冊（.html，一天一份，只限有動手環節的天）"),
        day: z.number().int().positive().optional().describe("第幾天，從 1 起算；課程大綱不給，簡報與學員手冊必給"),
        blueprint_version: z
          .number()
          .int()
          .positive()
          .describe("這份產物照第幾版藍圖做的；藍圖版本從 rpai_platform_get_blueprint 看"),
        filename: z.string().min(1).max(200).describe("要上傳的檔名（含副檔名），例如 週報課_第1天_簡報.pptx"),
        upstream_artifact_id: z
          .string()
          .uuid()
          .optional()
          .describe("學員手冊的上游簡報 id（那一天的簡報）；省略就自動取那天最新的 ready 簡報"),
        edited_from_id: z
          .string()
          .uuid()
          .optional()
          .describe("講師自己改過檔案再存回時，填原本那一份產物的 id；會存成它的新版本"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ course_id, kind, day, blueprint_version, filename, upstream_artifact_id, edited_from_id }, ctx) => {
      const ownerId = ownerIdFrom(ctx.http?.authInfo);
      const course = await store.getCourse(ownerId, course_id);
      if (!course) return fail(NOT_FOUND_COURSE);

      const blueprint = await store.getBlueprint(course_id, blueprint_version);
      if (!blueprint) {
        return fail(`這門課沒有第 ${blueprint_version} 版藍圖。先用 rpai_platform_get_blueprint 看有哪些版本。`);
      }

      const dayOrNull = day ?? null;
      const artifacts = await store.listArtifacts(course_id);
      const upstream = resolveUpstream({
        kind,
        day: dayOrNull,
        upstreamArtifactId: upstream_artifact_id ?? null,
        artifacts,
      });
      const errors = [
        ...checkArtifactRequest({ kind, day: dayOrNull, filename }, blueprint.content),
        ...upstream.errors,
        ...checkEditedFrom(edited_from_id ?? null, { kind, day: dayOrNull }, artifacts),
      ];
      if (errors.length > 0) return fail(errors.join(" "));

      const warnings: string[] = [];
      const latest = course.latestBlueprintVersion;
      if (latest !== null && blueprint_version < latest) {
        warnings.push(
          `第 ${blueprint_version} 版不是最新的藍圖（最新是第 ${latest} 版），這份產物存進來就會標成藍圖過期。`,
        );
      }
      warnings.push(...upstream.warnings);

      const artifactId = randomUUID();
      const storagePath = buildStoragePath({ ownerId, courseId: course_id, artifactId, filename });
      const { token, meta } = createUploadToken(now());
      const record = await store.createArtifact({
        id: artifactId,
        courseId: course_id,
        kind,
        day: dayOrNull,
        blueprintId: blueprint.id,
        filename: sanitizeFilename(filename),
        storagePath,
        upstreamId: upstream.upstreamId,
        editedFromId: edited_from_id ?? null,
        meta,
      });
      const uploadUrl = await store.createUploadUrl(storagePath);

      return ok({
        artifact_id: record.id,
        version: record.version,
        upload_url: uploadUrl,
        content_type: contentTypeFor(filename),
        expires_in_seconds: SIGNED_UPLOAD_EXPIRES_SECONDS,
        upload_page_url: uploadPageUrl(options.baseUrl, record.id, token),
        warnings,
      });
    },
  );

  server.registerTool(
    "rpai_platform_complete_artifact_upload",
    {
      title: "完成產物上傳",
      description:
        "檔案用 curl PUT 上傳成功後呼叫。平台會先確認 Storage 裡真的有這個檔案，才把產物標成 ready；已經是 ready 再呼叫也不會出錯。Storage 裡找不到檔案會回錯誤，先確認 PUT 回應是 200 再重試。",
      inputSchema: z.object({
        artifact_id: z
          .string()
          .uuid()
          .describe("產物 id（artifacts.id），從 rpai_platform_request_artifact_upload 取得"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ artifact_id }, ctx) => {
      const artifact = await store.getArtifact(ownerIdFrom(ctx.http?.authInfo), artifact_id);
      if (!artifact) return fail(NOT_FOUND_ARTIFACT);
      if (artifact.status === "ready") return ok({ artifact_id, status: "ready" });

      const uploaded = artifact.storage_path !== null && (await store.fileExists(artifact.storage_path));
      if (!uploaded) {
        return fail(
          "Storage 裡還沒有這個檔案。確認 PUT 回應是 200 再重試；傳不上去就請講師打開 upload_page_url 上傳。",
        );
      }

      await store.markReady(artifact_id);
      return ok({ artifact_id, status: "ready" });
    },
  );

  server.registerTool(
    "rpai_platform_list_artifacts",
    {
      title: "列出課程的產物",
      description:
        "列出一門課的所有產物，依種類（課程大綱、簡報、學員手冊）、天、版本排序。每筆的 stale_reasons 是過期原因：blueprint_outdated＝照舊版藍圖做的，最新版藍圖已經升版；upstream_outdated＝學員手冊的上游簡報有新版，或上游簡報是照舊版藍圖做的。平台不會自動重做，要不要重做由講師決定。只讀。",
      inputSchema: z.object({
        course_id: z.string().uuid().describe("課程 id，從 rpai_platform_list_courses 取得"),
      }),
      annotations: READ_ONLY,
    },
    async ({ course_id }, ctx) => {
      const course = await store.getCourse(ownerIdFrom(ctx.http?.authInfo), course_id);
      if (!course) return fail(NOT_FOUND_COURSE);

      const artifacts = await store.listArtifacts(course_id);
      const latest = course.latestBlueprintVersion;
      return ok({
        latest_blueprint_version: latest,
        artifacts: [...artifacts].sort(byKindDayVersion).map((a) => ({
          id: a.id,
          kind: a.kind,
          kind_label: ARTIFACT_KIND_LABELS[a.kind],
          day: a.day,
          version: a.version,
          blueprint_version: a.blueprint_version,
          status: a.status,
          filename: a.filename,
          stale_reasons: staleReasons(a, artifacts, latest),
          created_at: a.created_at,
        })),
      });
    },
  );

  server.registerTool(
    "rpai_platform_get_artifact_download",
    {
      title: "取得產物下載網址",
      description:
        "取得一份已上傳完成（ready）的產物的下載網址，10 分鐘內有效。還沒 ready 的產物拿不到，會回錯誤。只讀。",
      inputSchema: z.object({
        artifact_id: z
          .string()
          .uuid()
          .describe("產物 id（artifacts.id），從 rpai_platform_list_artifacts 取得"),
      }),
      annotations: READ_ONLY,
    },
    async ({ artifact_id }, ctx) => {
      const artifact = await store.getArtifact(ownerIdFrom(ctx.http?.authInfo), artifact_id);
      if (!artifact) return fail(NOT_FOUND_ARTIFACT);
      if (artifact.status !== "ready" || artifact.storage_path === null) return fail("這份產物還沒上傳完成。");

      const downloadUrl = await store.createDownloadUrl(artifact.storage_path);
      return ok({ download_url: downloadUrl, filename: artifact.filename, expires_in_seconds: DOWNLOAD_EXPIRES_SECONDS });
    },
  );
}
