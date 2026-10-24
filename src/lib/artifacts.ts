import path from "node:path";

/** 產物種類。加種類時 plugin/skills/rpai-platform-runner/SKILL.md 的對應表要一起改。 */
export const ARTIFACT_KINDS = ["outline", "slides", "handbook"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  outline: "課程大綱",
  slides: "簡報",
  handbook: "學員手冊",
};

/**
 * 各產物種類上傳的主檔副檔名（ADR 0005）。手冊是 HTML 單檔（一天一份，只給含動手環節的天）。
 * 內部講師準備單留在本機，不上傳。
 */
const ARTIFACT_EXTENSIONS: Record<ArtifactKind, string> = {
  outline: ".docx",
  slides: ".pptx",
  handbook: ".html",
};

export function artifactExtension(kind: ArtifactKind): string {
  return ARTIFACT_EXTENSIONS[kind];
}

const CONTENT_TYPES: Record<string, string> = {
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
  ".html": "text/html",
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

/**
 * Storage 物件路徑：workspace / course / artifact / 檔名，前三層都是 uuid，靠它們隔離（#78）。
 * 0005 之前上傳的舊列以 owner id 開頭，保留原本的 storage_path，不搬檔。
 */
export function buildStoragePath(parts: {
  workspaceId: string;
  courseId: string;
  artifactId: string;
  filename: string;
}): string {
  return [parts.workspaceId, parts.courseId, parts.artifactId, sanitizeFilename(parts.filename)].join("/");
}

/**
 * 產物下載用的 signed URL 選項，傳給 storage `createSignedUrl(path, expiresIn, options)`。
 * 帶 `download` 檔名會讓回應是 `Content-Disposition: attachment`，上傳的 HTML 不會在平台網域內渲染（ADR 0005）。
 */
export function artifactDownloadOptions(storagePath: string): { download: string } {
  return { download: sanitizeFilename(storagePath) };
}
