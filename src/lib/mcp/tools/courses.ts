import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { blueprintToMarkdown } from "@/lib/blueprint/markdown";
import { blueprintReport } from "@/lib/blueprint/report";
import { BlueprintSchema } from "@/lib/blueprint/schema";
import { ownerIdFrom } from "../auth";
import type { CourseStore } from "../course-store";
import { fail, ok } from "./result";

/** 課程與藍圖：找課、讀藍圖、存藍圖。 */
export function registerCourseTools(server: McpServer, store: CourseStore): void {
  server.registerTool(
    "rpai_platform_list_courses",
    {
      title: "列出我的課程",
      description:
        "列出講師在平台上的課程（id、標題、最新藍圖版本、最後更新時間），最近更新的在前。講師提到某門課時，先用這個工具找到 course_id。可以用 query 篩標題，不分大小寫。只讀。",
      inputSchema: z.object({
        query: z.string().trim().max(100).optional().describe("標題關鍵字，不分大小寫；省略＝全部"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query }, ctx) => {
      const keyword = (query ?? "").toLowerCase();
      const all = await store.listCourses(ownerIdFrom(ctx.http?.authInfo));
      const courses = all.filter((course) => course.title.toLowerCase().includes(keyword));
      return ok({ count: courses.length, courses });
    },
  );

  server.registerTool(
    "rpai_platform_get_blueprint",
    {
      title: "讀取教學藍圖",
      description:
        "讀取某門課的教學藍圖。不給 version 就回最新一版，並附上所有版本（新到舊）。回傳 content 是藍圖 JSON，markdown 是同一份藍圖給人讀的版本，report 是完整性檢查。只讀。要改藍圖就用 rpai_platform_save_blueprint 存成新版。藍圖是這門課唯一的前提來源，裡面有的不要再問講師。",
      inputSchema: z.object({
        course_id: z.string().uuid().describe("課程 id，從 rpai_platform_list_courses 取得"),
        version: z.number().int().positive().optional().describe("指定版本；省略＝最新"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ course_id, version }, ctx) => {
      const found = await store.getBlueprint(ownerIdFrom(ctx.http?.authInfo), course_id, version);
      if (!found) return fail("找不到這門課或這個版本的藍圖。先用 rpai_platform_list_courses 確認 course_id。");

      const { blueprint } = found;
      return ok({
        course: found.course,
        version: blueprint.version,
        content: blueprint.content,
        markdown: blueprintToMarkdown(blueprint.content),
        report: blueprintReport(blueprint.content),
        change_note: blueprint.change_note,
        created_at: blueprint.created_at,
        versions: found.versions,
      });
    },
  );

  server.registerTool(
    "rpai_platform_save_blueprint",
    {
      title: "儲存教學藍圖",
      description:
        "存一版教學藍圖。藍圖不可變：每存一次就多一版，舊版都留著，要改就存新版。講師認可這一版之後才存，不要替講師決定內容。第一次存、還沒有課程時不給 course_id，平台會建立課程（標題用藍圖的 title）；要改既有課程就給 course_id。格式不合會回錯誤並指出欄位，改好再存。存完要把回傳 report 的 issues 與 open_items 告訴講師。",
      inputSchema: z.object({
        course_id: z
          .string()
          .uuid()
          .optional()
          .describe("既有課程的 id；第一次存、還沒有課程時省略，平台會建立課程"),
        blueprint: BlueprintSchema.describe("完整的教學藍圖 JSON，各欄位的說明見欄位描述"),
        change_note: z.string().trim().max(500).optional().describe("這一版改了什麼，一句話"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ course_id, blueprint, change_note }, ctx) => {
      const saved = await store.saveBlueprint(ownerIdFrom(ctx.http?.authInfo), {
        courseId: course_id,
        content: blueprint,
        changeNote: change_note ?? null,
      });
      if (!saved) {
        return fail("找不到這門課。先用 rpai_platform_list_courses 確認 course_id；要開新課就不要給 course_id。");
      }
      return ok({
        course_id: saved.courseId,
        course_title: saved.courseTitle,
        version: saved.version,
        created_course: saved.createdCourse,
        report: blueprintReport(blueprint),
      });
    },
  );
}
