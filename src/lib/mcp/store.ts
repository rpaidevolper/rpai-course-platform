import { createAdminClient } from "@/lib/supabase/admin";
import { buildStoragePath, type ArtifactKind } from "@/lib/artifacts";
import type { Blueprint } from "@/lib/blueprint/schema";

export const ARTIFACT_BUCKET = "artifacts";

export interface CourseSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface BlueprintRecord {
  id: string;
  version: number;
  content: Blueprint;
  change_note: string | null;
  created_at: string;
}

export interface JobSummary {
  id: string;
  kind: ArtifactKind;
  version: number;
  created_at: string;
  course: { id: string; title: string };
  blueprint_version: number;
  instructions: string | null;
}

export interface ClaimedJob extends JobSummary {
  blueprint: Blueprint;
}

/**
 * MCP 工具要用的資料存取。用 service role client，所以每個方法都自己用 workspaceId 過濾——
 * 這裡沒有 RLS 幫忙擋。同一個工作區的課程與工作，每位成員都看得到（ADR 0004）。
 */
export interface JobStore {
  listCourses(workspaceId: string): Promise<CourseSummary[]>;
  getBlueprint(workspaceId: string, courseId: string, version?: number): Promise<BlueprintRecord | null>;
  listPendingJobs(workspaceId: string): Promise<JobSummary[]>;
  /** 原子地把 pending 改成 generating；已被認領或不存在回 null。 */
  claimJob(workspaceId: string, jobId: string, claimedBy: string): Promise<ClaimedJob | null>;
  createUploadUrl(
    workspaceId: string,
    jobId: string,
    filename: string,
  ): Promise<{ uploadUrl: string; storagePath: string } | null>;
  completeJob(workspaceId: string, jobId: string, storagePath: string): Promise<"ok" | "not_found" | "missing_file">;
  failJob(workspaceId: string, jobId: string, error: string): Promise<boolean>;
}

/** artifacts 連 courses（工作區檢查）與 blueprints 的查詢結果。 */
interface ArtifactRow {
  id: string;
  kind: ArtifactKind;
  version: number;
  status: string;
  created_at: string;
  meta: { instructions?: string } | null;
  course: { id: string; title: string; workspace_id: string };
  blueprint: { version: number; content: Blueprint };
}

const ARTIFACT_SELECT =
  "id, kind, version, status, created_at, meta, course:courses!inner(id, title, workspace_id), blueprint:blueprints!inner(version, content)";

function toSummary(row: ArtifactRow): JobSummary {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    created_at: row.created_at,
    course: { id: row.course.id, title: row.course.title },
    blueprint_version: row.blueprint.version,
    instructions: row.meta?.instructions ?? null,
  };
}

export function createSupabaseJobStore(): JobStore {
  const supabase = createAdminClient();

  async function getWorkspaceJob(workspaceId: string, jobId: string): Promise<ArtifactRow | null> {
    const { data } = await supabase
      .from("artifacts")
      .select(ARTIFACT_SELECT)
      .eq("id", jobId)
      .eq("course.workspace_id", workspaceId)
      .maybeSingle();
    return (data as unknown as ArtifactRow | null) ?? null;
  }

  return {
    async listCourses(workspaceId) {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, updated_at")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as CourseSummary[];
    },

    async getBlueprint(workspaceId, courseId, version) {
      const { data: course } = await supabase
        .from("courses")
        .select("id")
        .eq("id", courseId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!course) return null;

      let query = supabase
        .from("blueprints")
        .select("id, version, content, change_note, created_at")
        .eq("course_id", courseId);
      query = version === undefined ? query.order("version", { ascending: false }).limit(1) : query.eq("version", version);
      const { data } = await query.maybeSingle();
      return (data as BlueprintRecord | null) ?? null;
    },

    async listPendingJobs(workspaceId) {
      const { data, error } = await supabase
        .from("artifacts")
        .select(ARTIFACT_SELECT)
        .eq("status", "pending")
        .eq("runner", "claude_code")
        .eq("course.workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as ArtifactRow[]).map(toSummary);
    },

    async claimJob(workspaceId, jobId, claimedBy) {
      const row = await getWorkspaceJob(workspaceId, jobId);
      if (!row) return null;

      // 條件式 update：兩台機器同時認領，只有一台會改到列
      const { data: updated } = await supabase
        .from("artifacts")
        .update({ status: "generating", claimed_at: new Date().toISOString(), claimed_by: claimedBy })
        .eq("id", jobId)
        .eq("status", "pending")
        .select("id");
      if (!updated || updated.length === 0) return null;

      return { ...toSummary(row), blueprint: row.blueprint.content };
    },

    async createUploadUrl(workspaceId, jobId, filename) {
      const row = await getWorkspaceJob(workspaceId, jobId);
      if (!row || row.status !== "generating") return null;

      const storagePath = buildStoragePath({
        workspaceId,
        courseId: row.course.id,
        artifactId: row.id,
        filename,
      });
      const { data, error } = await supabase.storage
        .from(ARTIFACT_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });
      if (error) throw error;

      await supabase.from("artifacts").update({ filename: storagePath.split("/").pop() }).eq("id", jobId);
      return { uploadUrl: data.signedUrl, storagePath: data.path };
    },

    async completeJob(workspaceId, jobId, storagePath) {
      const row = await getWorkspaceJob(workspaceId, jobId);
      if (!row) return "not_found";

      // 確認檔案真的到了，才標 ready
      const dir = storagePath.split("/").slice(0, -1).join("/");
      const name = storagePath.split("/").pop() ?? "";
      const { data: objects } = await supabase.storage.from(ARTIFACT_BUCKET).list(dir, { search: name });
      if (!objects?.some((o) => o.name === name)) return "missing_file";

      await supabase
        .from("artifacts")
        .update({ status: "ready", storage_path: storagePath, error: null })
        .eq("id", jobId);
      return "ok";
    },

    async failJob(workspaceId, jobId, error) {
      const row = await getWorkspaceJob(workspaceId, jobId);
      if (!row) return false;
      await supabase.from("artifacts").update({ status: "failed", error }).eq("id", jobId);
      return true;
    },
  };
}
