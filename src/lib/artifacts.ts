import path from "node:path";

/** 產物種類。加種類時 plugin/skills/rpai-platform-runner/SKILL.md 的對應表要一起改。 */
export const ARTIFACT_KINDS = ["outline", "slides", "handbook"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  outline: "課程大綱",
  slides: "簡報",
  handbook: "學員手冊",
};

const CONTENT_TYPES: Record<string, string> = {
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
};

/** 允許上傳的副檔名對應 content type；不在清單裡回 null，讓呼叫端拒絕。 */
export function contentTypeFor(filename: string): string | null {
  return CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? null;
}

/** 去掉路徑、控制字元與 storage 不接受的字元；保留中文檔名。 */
export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename.replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[\x00-\x1f\x7f"'<>|:*?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "artifact";
}

/** Storage 物件路徑：owner / course / artifact / 檔名，前三層都是 uuid，靠它們隔離。 */
export function buildStoragePath(parts: {
  ownerId: string;
  courseId: string;
  artifactId: string;
  filename: string;
}): string {
  return [parts.ownerId, parts.courseId, parts.artifactId, sanitizeFilename(parts.filename)].join("/");
}
