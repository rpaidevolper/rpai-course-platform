import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ARTIFACT_KIND_LABELS, artifactExtension } from "@/lib/artifacts";
import { createSupabaseDashboardStore } from "@/lib/dashboard/store";
import { canUpload, INVALID_LINK_MESSAGE } from "@/lib/dashboard/upload";
import { ThemeToggle } from "../../_components/theme-toggle";
import { Card, Facts } from "../../_components/ui";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "上傳產物 · RPAI 課程平台",
  robots: { index: false, follow: false },
};

/**
 * 上傳頁：連結本身就是授權（網址上的一次性權杖，2 小時內有效，上傳完就失效），所以不需要登入。
 * 連結無效、過期、已經上傳過，一律顯示同一句話，不說明是哪一種原因。
 */
export default async function UploadPage({ params, searchParams }: PageProps<"/u/[artifactId]">) {
  const { artifactId } = await params;
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : undefined;

  const artifact = await createSupabaseDashboardStore().getArtifact(artifactId);
  if (artifact === null || token === undefined || !canUpload(artifact, token, new Date())) {
    return (
      <Frame>
        <Card>
          <p role="alert" className="text-sm font-bold text-danger">
            {INVALID_LINK_MESSAGE}
          </p>
        </Card>
      </Frame>
    );
  }

  return (
    <Frame>
      <Card>
        <h1 className="text-lg font-bold text-ink">上傳這份產物</h1>
        <div className="mt-4">
          <Facts
            items={[
              ["課程", artifact.course_title],
              ["產物", ARTIFACT_KIND_LABELS[artifact.kind]],
              ["第幾天", artifact.day === null ? "—" : `第 ${artifact.day} 天`],
              ["版本", `v${artifact.version}`],
              ["檔名", artifact.filename ?? "—"],
              ["副檔名", artifactExtension(artifact.kind)],
            ]}
          />
        </div>
      </Card>
      <UploadForm artifactId={artifact.id} token={token} extension={artifactExtension(artifact.kind)} />
    </Frame>
  );
}

/** 上傳頁的外框：沒有平台的頁首與導覽，只有品牌字樣與深淺色切換。 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-body-muted">RPAI 課程平台</p>
        <ThemeToggle />
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </main>
  );
}
