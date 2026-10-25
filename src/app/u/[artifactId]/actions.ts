"use server";

import * as upload from "@/lib/dashboard/upload";
import { createSupabaseDashboardStore } from "@/lib/dashboard/store";
import { createSupabaseArtifactStore } from "@/lib/mcp/artifact-store";

/** 上傳頁的 server action 只負責接線；驗權杖與寫入都在 lib/dashboard/upload.ts。 */
function deps(): upload.UploadDeps {
  return {
    store: createSupabaseDashboardStore(),
    artifacts: createSupabaseArtifactStore(),
    now: () => new Date(),
  };
}

/** 第一步：驗權杖，回 Storage 的上傳網址與 content type。 */
export async function startUpload(artifactId: string, token: string): Promise<upload.StartUploadResult> {
  return upload.startUpload(deps(), artifactId, token);
}

/** 第二步：瀏覽器 PUT 完才呼叫。Storage 裡有檔案才標 ready。 */
export async function finishUpload(artifactId: string, token: string): Promise<upload.FinishUploadResult> {
  return upload.finishUpload(deps(), artifactId, token);
}
