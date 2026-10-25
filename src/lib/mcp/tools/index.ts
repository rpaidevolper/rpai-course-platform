import type { McpServer } from "@modelcontextprotocol/server";
import type { KnowledgeStore } from "@/lib/knowledge/store";
import type { ArtifactStore } from "../artifact-store";
import type { CourseStore } from "../course-store";
import { registerArtifactTools } from "./artifacts";
import { registerCourseTools } from "./courses";
import { registerKnowledgeTools } from "./knowledge";

/** 工具要用的資料存取，一組工具一個 store。 */
export interface PlatformStores {
  courses: CourseStore;
  knowledge: KnowledgeStore;
  artifacts: ArtifactStore;
}

export interface PlatformToolOptions {
  /** 平台網址，用來產生上傳頁連結（見 platformBaseUrl）。 */
  baseUrl: string;
}

/**
 * 講師的 AI 透過這些工具讀寫平台；怎麼串成備課流程寫在 ../instructions.ts。
 * 工具名或參數改了，instructions 與 plugin/skills/rpai-platform-runner/SKILL.md 要同步。
 */
export function registerPlatformTools(server: McpServer, stores: PlatformStores, options: PlatformToolOptions): void {
  registerCourseTools(server, stores.courses);
  registerKnowledgeTools(server, stores.knowledge);
  registerArtifactTools(server, stores.artifacts, { baseUrl: options.baseUrl });
}
