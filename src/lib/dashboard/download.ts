import type { ArtifactStore } from "@/lib/mcp/artifact-store";
import type { DashboardStore } from "./store";

/** 讀產物、簽下載網址的兩個函式。route 傳進真正的 store；測試傳進假的。 */
export interface DownloadDeps {
  getArtifact: DashboardStore["getArtifact"];
  createDownloadUrl: ArtifactStore["createDownloadUrl"];
}

/**
 * 下載要導去的網址（10 分鐘、帶 download 選項，回應是 attachment）。
 * 找不到回 null，route 會回 404：產物不存在、還沒上傳完成（不是 ready），或沒有 storage_path。
 */
export async function downloadTarget(artifactId: string, deps: DownloadDeps): Promise<string | null> {
  const artifact = await deps.getArtifact(artifactId);
  if (artifact === null || artifact.status !== "ready" || artifact.storage_path === null) return null;
  return deps.createDownloadUrl(artifact.storage_path);
}
