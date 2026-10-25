import type { ArtifactStatus } from "@/lib/artifact-rules";

const DATE_TIME = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" });

/** 時間一律用台北時間顯示，講師在台灣，不用自己換算。 */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** 產物狀態的中文。ready 寫「已上傳」：平台記下的是講師上傳的檔案。 */
export const ARTIFACT_STATUS_LABELS: Record<ArtifactStatus, string> = {
  pending: "排隊中",
  generating: "等待上傳",
  ready: "已上傳",
  failed: "失敗",
};
