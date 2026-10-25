import { notFound, redirect } from "next/navigation";
import { downloadTarget } from "@/lib/dashboard/download";
import { createSupabaseDashboardStore } from "@/lib/dashboard/store";
import { createSupabaseArtifactStore } from "@/lib/mcp/artifact-store";
import { isSignedIn } from "../../../session";

/**
 * 網頁下載：登入後導去 10 分鐘的 signed URL（帶 download 選項，回應是 attachment，檔名是上傳時的名稱）。
 * 沒登入導去登入頁，登入後會回到這裡。產物不存在或還沒上傳完成回 404。
 */
export async function GET(_request: Request, { params }: RouteContext<"/artifacts/[id]/download">) {
  const { id } = await params;
  if (!(await isSignedIn())) {
    redirect(`/login?next=${encodeURIComponent(`/artifacts/${id}/download`)}`);
  }

  const store = createSupabaseDashboardStore();
  const artifacts = createSupabaseArtifactStore();
  const url = await downloadTarget(id, {
    getArtifact: (artifactId) => store.getArtifact(artifactId),
    createDownloadUrl: (storagePath) => artifacts.createDownloadUrl(storagePath),
  });
  if (url === null) notFound();

  redirect(url);
}
