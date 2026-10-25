import type { McpServer } from "@modelcontextprotocol/server";
import type { CourseStore } from "../course-store";
import type { JobStore } from "../job-store";
import { registerCourseTools } from "./courses";
import { registerJobTools } from "./jobs";

/** 工具要用的資料存取，一組工具一個 store。 */
export interface PlatformStores {
  courses: CourseStore;
  jobs: JobStore;
}

/**
 * 講師的 AI 透過這些工具讀寫平台；怎麼串成備課流程寫在 ../instructions.ts。
 * 工具名或參數改了，instructions 與 plugin/skills/rpai-platform-runner/SKILL.md 要同步。
 */
export function registerPlatformTools(server: McpServer, stores: PlatformStores): void {
  registerCourseTools(server, stores.courses);
  registerJobTools(server, stores.jobs);
}
