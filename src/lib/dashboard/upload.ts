import { contentTypeFor } from "@/lib/artifacts";
import type { ArtifactRecord } from "@/lib/artifact-rules";
import type { ArtifactStore } from "@/lib/mcp/artifact-store";
import { verifyUploadToken } from "@/lib/upload-token";
import type { DashboardStore } from "./store";

/**
 * 上傳頁的兩步：startUpload 給 Storage 的上傳網址，瀏覽器 PUT 過去，finishUpload 確認檔案到了才標 ready。
 * 上傳頁靠一次性權杖授權，不靠登入。所有失敗都回同一句話，不透露是哪一種原因。
 */

export const INVALID_LINK_MESSAGE = "這個上傳連結無效或已過期。請回到 AI 對話，請它重新產生上傳連結。";
export const NOT_RECEIVED_MESSAGE = "平台還沒收到檔案，請再試一次。";

/** 權杖對、產物還沒 ready 才能上傳。ready 時權杖已被清掉，這裡再擋一次。 */
export function canUpload(artifact: ArtifactRecord, token: string | null | undefined, now: Date): boolean {
  return artifact.status !== "ready" && verifyUploadToken(token, artifact.meta, now);
}

export interface UploadDeps {
  store: Pick<DashboardStore, "getArtifact">;
  artifacts: Pick<ArtifactStore, "createUploadUrl" | "fileExists" | "markReady">;
  now: () => Date;
}

export type StartUploadResult = { ok: true; uploadUrl: string; contentType: string } | { ok: false; error: string };
export type FinishUploadResult = { ok: true } | { ok: false; error: string };

/** 驗權杖通過才給上傳網址與 content type；不通過什麼都不做。 */
export async function startUpload(deps: UploadDeps, artifactId: string, token: string): Promise<StartUploadResult> {
  const artifact = await uploadableArtifact(deps, artifactId, token);
  if (artifact === null || artifact.storage_path === null || artifact.filename === null) {
    return { ok: false, error: INVALID_LINK_MESSAGE };
  }
  const contentType = contentTypeFor(artifact.filename);
  if (contentType === null) return { ok: false, error: INVALID_LINK_MESSAGE };

  const uploadUrl = await deps.artifacts.createUploadUrl(artifact.storage_path);
  return { ok: true, uploadUrl, contentType };
}

/** 驗權杖通過、Storage 裡真的有檔案，才標成 ready（標 ready 時權杖會從 meta 拿掉）。 */
export async function finishUpload(deps: UploadDeps, artifactId: string, token: string): Promise<FinishUploadResult> {
  const artifact = await uploadableArtifact(deps, artifactId, token);
  if (artifact === null || artifact.storage_path === null) return { ok: false, error: INVALID_LINK_MESSAGE };

  if (!(await deps.artifacts.fileExists(artifact.storage_path))) return { ok: false, error: NOT_RECEIVED_MESSAGE };
  await deps.artifacts.markReady(artifactId);
  return { ok: true };
}

/** 產物存在、權杖對、還沒 ready 才回傳，否則 null。 */
async function uploadableArtifact(deps: UploadDeps, artifactId: string, token: string): Promise<ArtifactRecord | null> {
  const artifact = await deps.store.getArtifact(artifactId);
  if (artifact === null || !canUpload(artifact, token, deps.now())) return null;
  return artifact;
}
