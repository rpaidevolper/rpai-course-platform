import type { ArtifactRecord } from "@/lib/artifact-rules";
import { ARTIFACT_COLUMNS, toArtifactRecord, type ArtifactRow } from "@/lib/mcp/artifact-store";
import type { BlueprintRecord, BlueprintVersion } from "@/lib/mcp/course-store";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 網頁用的課程、藍圖與產物讀取。
 *
 * 不以 owner 過濾：網頁是團隊共用一個密碼登入，看得到全部課程（ADR 0004 的全團隊共用）。
 * 所以這裡的查詢只能在通過登入檢查的頁面與 route handler 裡用：(dashboard) 底下的頁面用 requireSignedIn，
 * route handler 用 isSignedIn。上傳頁（src/app/u/）是唯一的例外，它靠一次性權杖授權，見 ./upload.ts。
 * 用 service role client，RLS 不會替這裡擋。
 */

export interface DashboardCourse {
  id: string;
  title: string;
  /** 最新藍圖版本；還沒有藍圖是 null。 */
  latest_version: number | null;
  updated_at: string;
}

export interface DashboardCourseDetail {
  course: { id: string; title: string; updated_at: string };
  /** 最新一版藍圖的完整紀錄；還沒有藍圖是 null */
  latest: BlueprintRecord | null;
  /** 所有版本，新到舊 */
  versions: BlueprintVersion[];
  artifacts: ArtifactRecord[];
}

export interface DashboardStore {
  /** 全部課程，最近更新的在前 */
  listCourses(): Promise<DashboardCourse[]>;
  /** 找不到回 null */
  getCourse(courseId: string): Promise<DashboardCourseDetail | null>;
  /** 一份產物與它所屬課程的標題；找不到回 null */
  getArtifact(artifactId: string): Promise<(ArtifactRecord & { course_title: string }) | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 不是 uuid 就不送進資料庫（Postgres 對不合法的 uuid 會報錯），直接當作找不到。 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** listCourses 的一列：每門課只嵌入最新一版的版本號。 */
interface CourseRow {
  id: string;
  title: string;
  updated_at: string;
  blueprints: { version: number }[];
}

export function createSupabaseDashboardStore(): DashboardStore {
  const supabase = createAdminClient();

  /** 課程的所有版本，新到舊。 */
  async function listVersions(courseId: string): Promise<BlueprintVersion[]> {
    const { data, error } = await supabase
      .from("blueprints")
      .select("version, created_at, change_note")
      .eq("course_id", courseId)
      .order("version", { ascending: false });
    if (error) throw error;
    return (data ?? []) as BlueprintVersion[];
  }

  /** 一版藍圖的完整紀錄。 */
  async function loadBlueprint(courseId: string, version: number): Promise<BlueprintRecord | null> {
    const { data, error } = await supabase
      .from("blueprints")
      .select("id, version, content, change_note, created_at")
      .eq("course_id", courseId)
      .eq("version", version)
      .maybeSingle();
    if (error) throw error;
    return (data as BlueprintRecord | null) ?? null;
  }

  return {
    async listCourses() {
      // 與 course-store 的 listCourses 同一套寫法（每門課嵌入最新一版），只是沒有 owner 條件
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, updated_at, blueprints(version)")
        .order("updated_at", { ascending: false })
        .order("version", { referencedTable: "blueprints", ascending: false })
        .limit(1, { referencedTable: "blueprints" });
      if (error) throw error;

      return ((data ?? []) as CourseRow[]).map((c) => ({
        id: c.id,
        title: c.title,
        latest_version: c.blueprints[0]?.version ?? null,
        updated_at: c.updated_at,
      }));
    },

    async getCourse(courseId) {
      if (!isUuid(courseId)) return null;

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title, updated_at")
        .eq("id", courseId)
        .maybeSingle();
      if (courseError) throw courseError;
      if (!course) return null;

      const versions = await listVersions(courseId);
      // 最新一版取的是上面那份版本清單的第一筆，兩者對得上
      const latest = versions.length === 0 ? null : await loadBlueprint(courseId, versions[0].version);

      const { data: artifacts, error: artifactsError } = await supabase
        .from("artifacts")
        .select(ARTIFACT_COLUMNS)
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });
      if (artifactsError) throw artifactsError;

      return {
        course: { id: course.id, title: course.title, updated_at: course.updated_at },
        latest,
        versions,
        artifacts: ((artifacts ?? []) as unknown as ArtifactRow[]).map(toArtifactRecord),
      };
    },

    async getArtifact(artifactId) {
      if (!isUuid(artifactId)) return null;

      const { data, error } = await supabase
        .from("artifacts")
        .select(`${ARTIFACT_COLUMNS}, course:courses!inner(title)`)
        .eq("id", artifactId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const row = data as unknown as ArtifactRow & { course: { title: string } };
      return { ...toArtifactRecord(row), course_title: row.course.title };
    },
  };
}
