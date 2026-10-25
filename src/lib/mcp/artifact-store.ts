import { createAdminClient } from "@/lib/supabase/admin";
import { ARTIFACT_BUCKET, artifactDownloadOptions, type ArtifactKind } from "@/lib/artifacts";
import { nextArtifactVersion, type ArtifactRecord, type ArtifactStatus } from "@/lib/artifact-rules";
import type { Blueprint } from "@/lib/blueprint/schema";

export interface CourseContext {
  id: string;
  title: string;
  latestBlueprintVersion: number | null;
}

export interface NewArtifact {
  /** 先在程式裡用 crypto.randomUUID() 產生，因為 storage 路徑要用到 */
  id: string;
  courseId: string;
  kind: ArtifactKind;
  day: number | null;
  blueprintId: string;
  filename: string;
  storagePath: string;
  upstreamId: string | null;
  editedFromId: string | null;
  meta: Record<string, unknown>;
}

/**
 * 產物的資料存取。用 service role client，所以每個需要講師身分的方法都自己用 ownerId 過濾——
 * 這裡沒有 RLS 幫忙擋。規則（版本、上游、過期）都放在 ../artifact-rules.ts，這裡只負責讀寫。
 */
export interface ArtifactStore {
  /** 課程屬於 ownerId 才回傳。 */
  getCourse(ownerId: string, courseId: string): Promise<CourseContext | null>;
  /** 課程的某一版藍圖；呼叫前要先用 getCourse 確認課程屬於講師。 */
  getBlueprint(courseId: string, version: number): Promise<{ id: string; version: number; content: Blueprint } | null>;
  /** 課程的所有產物，blueprint_version 是它出自的那一版藍圖的版本號。 */
  listArtifacts(courseId: string): Promise<ArtifactRecord[]>;
  /** 產物所屬的課程屬於 ownerId 才回傳。 */
  getArtifact(ownerId: string, artifactId: string): Promise<ArtifactRecord | null>;
  /** 新增一筆 status 是 generating 的產物；version 用 nextArtifactVersion 在（課程, 種類, 天）裡取號。 */
  createArtifact(input: NewArtifact): Promise<ArtifactRecord>;
  /** Storage 的 signed upload URL（Supabase 固定 2 小時有效）。 */
  createUploadUrl(storagePath: string): Promise<string>;
  fileExists(storagePath: string): Promise<boolean>;
  /** status 改成 ready，error 清空，並從 meta 拿掉 upload_token_hash 與 upload_expires_at（上傳頁連結從此失效）。 */
  markReady(artifactId: string): Promise<void>;
  /** 10 分鐘的下載網址，帶 artifactDownloadOptions 的 download 選項。 */
  createDownloadUrl(storagePath: string): Promise<string>;
}

/** artifacts 連 blueprints（取出藍圖版本）的欄位。 */
export const ARTIFACT_COLUMNS =
  "id, course_id, kind, day, version, status, filename, storage_path, upstream_id, edited_from_id, created_at, meta, blueprint:blueprints!inner(version)";

export interface ArtifactRow {
  id: string;
  course_id: string;
  kind: ArtifactKind;
  day: number | null;
  version: number;
  status: ArtifactStatus;
  filename: string | null;
  storage_path: string | null;
  upstream_id: string | null;
  edited_from_id: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
  blueprint: { version: number };
}

/** 資料庫的一列轉成 ArtifactRecord。網頁的讀取（lib/dashboard/store.ts）共用這個。 */
export function toArtifactRecord(row: ArtifactRow): ArtifactRecord {
  return {
    id: row.id,
    course_id: row.course_id,
    kind: row.kind,
    day: row.day,
    version: row.version,
    blueprint_version: row.blueprint.version,
    status: row.status,
    filename: row.filename,
    storage_path: row.storage_path,
    upstream_id: row.upstream_id,
    edited_from_id: row.edited_from_id,
    created_at: row.created_at,
    meta: row.meta ?? {},
  };
}

/** unique 衝突的 Postgres 錯誤代碼：有人同時寫入同一個（課程, 種類, 天, 版本）。 */
const UNIQUE_VIOLATION = "23505";

export function createSupabaseArtifactStore(): ArtifactStore {
  const supabase = createAdminClient();

  async function listRecords(courseId: string): Promise<ArtifactRecord[]> {
    const { data, error } = await supabase
      .from("artifacts")
      .select(ARTIFACT_COLUMNS)
      .eq("course_id", courseId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as unknown as ArtifactRow[]).map(toArtifactRecord);
  }

  /** 同一個（課程, 種類, 天）裡已有的產物，用來取版本號。day 是 null 時要用 is null 查。 */
  async function listSlot(courseId: string, kind: ArtifactKind, day: number | null): Promise<ArtifactRecord[]> {
    let query = supabase
      .from("artifacts")
      .select(ARTIFACT_COLUMNS)
      .eq("course_id", courseId)
      .eq("kind", kind);
    query = day === null ? query.is("day", null) : query.eq("day", day);
    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as ArtifactRow[]).map(toArtifactRecord);
  }

  return {
    async getCourse(ownerId, courseId) {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", courseId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (courseError) throw courseError;
      if (!course) return null;

      const { data: latest, error: latestError } = await supabase
        .from("blueprints")
        .select("version")
        .eq("course_id", courseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      return { id: course.id, title: course.title, latestBlueprintVersion: latest?.version ?? null };
    },

    async getBlueprint(courseId, version) {
      const { data, error } = await supabase
        .from("blueprints")
        .select("id, version, content")
        .eq("course_id", courseId)
        .eq("version", version)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, version: data.version, content: data.content as Blueprint };
    },

    listArtifacts: listRecords,

    async getArtifact(ownerId, artifactId) {
      const { data, error } = await supabase
        .from("artifacts")
        .select(`${ARTIFACT_COLUMNS}, course:courses!inner(owner_id)`)
        .eq("id", artifactId)
        .eq("course.owner_id", ownerId)
        .maybeSingle();
      if (error) throw error;
      return data ? toArtifactRecord(data as unknown as ArtifactRow) : null;
    },

    async createArtifact(input) {
      // 版本取號：同（課程, 種類, 天）取最大版本加 1。兩人同時寫入時 unique 會擋下，重算一次再試。
      let lastError: { message: string } | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const version = nextArtifactVersion(await listSlot(input.courseId, input.kind, input.day), input.kind, input.day);
        const { data, error } = await supabase
          .from("artifacts")
          .insert({
            id: input.id,
            course_id: input.courseId,
            blueprint_id: input.blueprintId,
            kind: input.kind,
            day: input.day,
            version,
            status: "generating",
            filename: input.filename,
            storage_path: input.storagePath,
            upstream_id: input.upstreamId,
            edited_from_id: input.editedFromId,
            meta: input.meta,
          })
          .select(ARTIFACT_COLUMNS)
          .single();
        if (!error) return toArtifactRecord(data as unknown as ArtifactRow);
        if (error.code !== UNIQUE_VIOLATION) throw new Error(`產物寫入失敗：${error.message}`);
        lastError = error;
      }
      throw new Error(`產物版本取號衝突，請再試一次：${lastError?.message ?? ""}`);
    },

    async createUploadUrl(storagePath) {
      const { data, error } = await supabase.storage
        .from(ARTIFACT_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });
      if (error) throw error;
      return data.signedUrl;
    },

    async fileExists(storagePath) {
      // 確認檔案真的到了，才標 ready。
      const dir = storagePath.split("/").slice(0, -1).join("/");
      const name = storagePath.split("/").pop() ?? "";
      const { data: objects, error } = await supabase.storage.from(ARTIFACT_BUCKET).list(dir, { search: name });
      if (error) throw error;
      return objects?.some((object) => object.name === name) ?? false;
    },

    async markReady(artifactId) {
      const { data: row, error: readError } = await supabase
        .from("artifacts")
        .select("meta")
        .eq("id", artifactId)
        .single();
      if (readError) throw readError;

      // 上傳權杖用完即丟：從 meta 拿掉，上傳頁連結從此失效。
      const meta: Record<string, unknown> = { ...((row.meta as Record<string, unknown> | null) ?? {}) };
      delete meta.upload_token_hash;
      delete meta.upload_expires_at;

      const { error } = await supabase
        .from("artifacts")
        .update({ status: "ready", error: null, meta })
        .eq("id", artifactId);
      if (error) throw error;
    },

    async createDownloadUrl(storagePath) {
      const { data, error } = await supabase.storage
        .from(ARTIFACT_BUCKET)
        .createSignedUrl(storagePath, 600, artifactDownloadOptions(storagePath));
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
