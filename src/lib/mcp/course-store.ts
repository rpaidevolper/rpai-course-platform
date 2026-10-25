import { createAdminClient } from "@/lib/supabase/admin";
import { BlueprintSchema, type Blueprint } from "@/lib/blueprint/schema";

export interface CourseSummary {
  id: string;
  title: string;
  /** 最新藍圖版本；還沒有藍圖是 null。 */
  latest_version: number | null;
  updated_at: string;
}

export interface BlueprintVersion {
  version: number;
  created_at: string;
  change_note: string | null;
}

export interface BlueprintRecord {
  id: string;
  version: number;
  content: Blueprint;
  change_note: string | null;
  created_at: string;
}

export interface CourseBlueprint {
  course: { id: string; title: string };
  blueprint: BlueprintRecord;
  /** 這門課所有版本，新到舊 */
  versions: BlueprintVersion[];
}

export interface SavedBlueprint {
  courseId: string;
  courseTitle: string;
  version: number;
  createdCourse: boolean;
}

/**
 * 課程與藍圖的資料存取。用 service role client，所以每個方法都自己用 ownerId 過濾——
 * 這裡沒有 RLS 幫忙擋。
 */
export interface CourseStore {
  /** ownerId 的所有課程，最近更新的在前；latest_version 是最新藍圖版本，還沒有藍圖是 null。 */
  listCourses(ownerId: string): Promise<CourseSummary[]>;
  /** 課程不屬於 ownerId、或沒有這一版，回 null。version 省略＝最新一版。 */
  getBlueprint(ownerId: string, courseId: string, version?: number): Promise<CourseBlueprint | null>;
  /**
   * 存一版藍圖。沒給 courseId：建立課程（標題＝content.title），存成 v1。
   * 有給 courseId：課程不屬於 ownerId 就回 null、什麼都不寫；屬於就存成目前最大版本加 1，並把課程標題改成 content.title。
   */
  saveBlueprint(
    ownerId: string,
    input: { courseId?: string; content: Blueprint; changeNote: string | null },
  ): Promise<SavedBlueprint | null>;
}

export function createSupabaseCourseStore(): CourseStore {
  const supabase = createAdminClient();

  /** 這門課目前最大的版本號；還沒有藍圖回 0。 */
  async function latestVersionNumber(courseId: string): Promise<number> {
    const { data, error } = await supabase
      .from("blueprints")
      .select("version")
      .eq("course_id", courseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.version ?? 0;
  }

  /**
   * 寫入下一版，回傳版本號。兩個請求同時存同一門課會撞到 unique (course_id, version)，
   * 撞到就重新取最大版本再試一次；還是失敗就 throw。
   */
  async function insertNextVersion(courseId: string, content: Blueprint, changeNote: string | null): Promise<number> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const version = (await latestVersionNumber(courseId)) + 1;
      const { error } = await supabase
        .from("blueprints")
        .insert({ course_id: courseId, version, content, change_note: changeNote });
      if (!error) return version;
      if (error.code !== "23505") throw error;
      lastError = error;
    }
    throw lastError;
  }

  return {
    async listCourses(ownerId) {
      const { data: courses, error } = await supabase
        .from("courses")
        .select("id, title, updated_at")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if (!courses || courses.length === 0) return [];

      const { data: versions, error: versionsError } = await supabase
        .from("blueprints")
        .select("course_id, version")
        .in("course_id", courses.map((c) => c.id));
      if (versionsError) throw versionsError;

      const latest = new Map<string, number>();
      for (const row of versions ?? []) {
        latest.set(row.course_id, Math.max(latest.get(row.course_id) ?? 0, row.version));
      }
      return courses.map((c) => ({
        id: c.id,
        title: c.title,
        latest_version: latest.get(c.id) ?? null,
        updated_at: c.updated_at,
      }));
    },

    async getBlueprint(ownerId, courseId, version) {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", courseId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (courseError) throw courseError;
      if (!course) return null;

      const { data: versions, error: versionsError } = await supabase
        .from("blueprints")
        .select("version, created_at, change_note")
        .eq("course_id", courseId)
        .order("version", { ascending: false });
      if (versionsError) throw versionsError;

      const list = (versions ?? []) as BlueprintVersion[];
      const target = version === undefined ? list[0] : list.find((v) => v.version === version);
      if (!target) return null;

      const { data: record, error: recordError } = await supabase
        .from("blueprints")
        .select("id, version, content, change_note, created_at")
        .eq("course_id", courseId)
        .eq("version", target.version)
        .maybeSingle();
      if (recordError) throw recordError;
      if (!record) return null;

      return {
        course: { id: course.id, title: course.title },
        blueprint: record as BlueprintRecord,
        versions: list,
      };
    },

    async saveBlueprint(ownerId, input) {
      // 寫入前一定要過 schema，不合格什麼都不寫
      const content = BlueprintSchema.parse(input.content);

      if (input.courseId === undefined) {
        const { data: created, error } = await supabase
          .from("courses")
          .insert({ owner_id: ownerId, title: content.title })
          .select("id")
          .single();
        if (error) throw error;

        const courseId: string = created.id;
        try {
          const version = await insertNextVersion(courseId, content, input.changeNote);
          return { courseId, courseTitle: content.title, version, createdCourse: true };
        } catch (writeError) {
          // 盡量把剛建的空課程刪掉，不要留下沒有藍圖的課；刪不掉就算了，還是要 throw 原本的錯誤
          try {
            await supabase.from("courses").delete().eq("id", courseId).eq("owner_id", ownerId);
          } catch {
            // 忽略，見上方註解
          }
          throw writeError;
        }
      }

      const courseId = input.courseId;
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", courseId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (courseError) throw courseError;
      if (!course) return null;

      const version = await insertNextVersion(courseId, content, input.changeNote);

      // 課程標題跟著最新一版走；updated_at 由資料庫 trigger 更新
      const { error: titleError } = await supabase
        .from("courses")
        .update({ title: content.title })
        .eq("id", courseId)
        .eq("owner_id", ownerId);
      if (titleError) throw titleError;

      return { courseId, courseTitle: content.title, version, createdCourse: false };
    },
  };
}
