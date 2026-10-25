import { createAdminClient } from "@/lib/supabase/admin";
import type { Blueprint } from "@/lib/blueprint/schema";

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

/**
 * 課程與藍圖的資料存取。用 service role client，所以每個方法都自己用 ownerId 過濾——
 * 這裡沒有 RLS 幫忙擋。
 */
export interface CourseStore {
  listCourses(ownerId: string): Promise<CourseSummary[]>;
  getBlueprint(ownerId: string, courseId: string, version?: number): Promise<BlueprintRecord | null>;
}

export function createSupabaseCourseStore(): CourseStore {
  const supabase = createAdminClient();

  return {
    async listCourses(ownerId) {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, updated_at")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as CourseSummary[];
    },

    async getBlueprint(ownerId, courseId, version) {
      const { data: course } = await supabase
        .from("courses")
        .select("id")
        .eq("id", courseId)
        .eq("owner_id", ownerId)
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
  };
}
