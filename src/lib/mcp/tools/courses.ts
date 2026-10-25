import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ownerIdFrom } from "../auth";
import type { CourseStore } from "../course-store";
import { fail, ok } from "./result";

/** 課程與藍圖：找課、讀藍圖。 */
export function registerCourseTools(server: McpServer, store: CourseStore): void {
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
}
