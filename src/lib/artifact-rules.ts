import path from "node:path";
import type { Blueprint } from "@/lib/blueprint/schema";
import { ARTIFACT_KINDS, ARTIFACT_KIND_LABELS, artifactExtension, type ArtifactKind } from "@/lib/artifacts";

/** 產物的狀態；只有 ready 才算完成，下游與過期判斷都只看 ready。 */
export type ArtifactStatus = "pending" | "generating" | "ready" | "failed";

/** 一筆產物（artifacts 表的一列；欄位名沿用資料庫）。 */
export interface ArtifactRecord {
  id: string;
  course_id: string;
  kind: ArtifactKind;
  /** 第幾天，從 1 起算；課程大綱是 null。 */
  day: number | null;
  version: number;
  /** 這份產物照第幾版藍圖做的。 */
  blueprint_version: number;
  status: ArtifactStatus;
  filename: string | null;
  storage_path: string | null;
  upstream_id: string | null;
  edited_from_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

/** 過期原因：藍圖升版了，或學員手冊的上游簡報有新版、或上游本身過期。 */
export const STALE_REASONS = ["blueprint_outdated", "upstream_outdated"] as const;
export type StaleReason = (typeof STALE_REASONS)[number];

export const STALE_REASON_LABELS: Record<StaleReason, string> = {
  blueprint_outdated: "藍圖過期",
  upstream_outdated: "上游過期",
};

/** 藍圖裡有動手環節的天（從 1 起算）。只有這些天才產學員手冊。 */
export function handsOnDays(bp: Blueprint): number[] {
  return bp.days.flatMap((day, index) => {
    const hasActivity = day.slots.some((slot) => slot.units.some((unit) => unit.activity !== null));
    return hasActivity ? [index + 1] : [];
  });
}

/**
 * 檢查一份產物的種類、天、檔名是否符合規則。回傳錯誤句子，空陣列代表通過。
 * 每個句子都直接告訴講師要怎麼改。
 */
export function checkArtifactRequest(
  req: { kind: ArtifactKind; day: number | null; filename: string },
  bp: Blueprint,
): string[] {
  const errors: string[] = [];
  const extensionOk = path.extname(req.filename).toLowerCase() === artifactExtension(req.kind);

  if (req.kind === "outline") {
    if (req.day !== null) errors.push("課程大綱是整門課一份，不要給 day。");
    if (!extensionOk) errors.push("課程大綱要上傳 .docx 檔。");
    return errors;
  }

  const days = bp.days.length;
  const label = req.kind === "slides" ? "簡報一天一份" : "學員手冊一天一份";
  if (req.day === null) {
    errors.push(`${label}，要給 day（1 到 ${days}）。`);
  } else if (!Number.isInteger(req.day) || req.day < 1 || req.day > days) {
    errors.push(`藍圖只有 ${days} 天，沒有第 ${req.day} 天。`);
  } else if (req.kind === "handbook" && !handsOnDays(bp).includes(req.day)) {
    errors.push(`第 ${req.day} 天沒有動手環節，不產學員手冊。`);
  }

  if (!extensionOk) {
    errors.push(req.kind === "slides" ? "簡報要上傳 .pptx 檔。" : "學員手冊要上傳 .html 檔。");
  }
  return errors;
}

/** 同一種類、同一天（day 都是 null 也算同一天）的最大版本加 1；沒有就是 1。 */
export function nextArtifactVersion(existing: ArtifactRecord[], kind: ArtifactKind, day: number | null): number {
  const versions = existing.filter((a) => a.kind === kind && a.day === day).map((a) => a.version);
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

/** 那一天狀態是 ready 的簡報裡，版本最大的那份。 */
export function latestReadySlides(artifacts: ArtifactRecord[], day: number): ArtifactRecord | null {
  return artifacts
    .filter((a) => a.kind === "slides" && a.day === day && a.status === "ready")
    .reduce<ArtifactRecord | null>((best, a) => (best === null || a.version > best.version ? a : best), null);
}

/**
 * 決定學員手冊的上游。只有學員手冊有上游，上游就是那一天的簡報。
 * 講師沒指定就自動取那天最新的 ready 簡報；那天還沒有簡報時照樣收下，只給 warning。
 */
export function resolveUpstream(input: {
  kind: ArtifactKind;
  day: number | null;
  upstreamArtifactId: string | null;
  artifacts: ArtifactRecord[];
}): { upstreamId: string | null; errors: string[]; warnings: string[] } {
  const { kind, day, upstreamArtifactId, artifacts } = input;

  if (kind !== "handbook") {
    if (upstreamArtifactId === null) return { upstreamId: null, errors: [], warnings: [] };
    return { upstreamId: null, errors: ["只有學員手冊有上游（那一天的簡報）。"], warnings: [] };
  }

  // 沒有天就沒有上游；day 的檢查在 checkArtifactRequest。
  if (day === null) return { upstreamId: null, errors: [], warnings: [] };

  if (upstreamArtifactId !== null) {
    const upstream = artifacts.find((a) => a.id === upstreamArtifactId);
    if (upstream !== undefined && upstream.kind === "slides" && upstream.day === day && upstream.status === "ready") {
      return { upstreamId: upstream.id, errors: [], warnings: [] };
    }
    return {
      upstreamId: null,
      errors: [`上游要是這門課第 ${day} 天、已經上傳完成的簡報。`],
      warnings: [],
    };
  }

  const latest = latestReadySlides(artifacts, day);
  if (latest !== null) return { upstreamId: latest.id, errors: [], warnings: [] };
  return {
    upstreamId: null,
    errors: [],
    warnings: [`第 ${day} 天還沒有簡報；學員手冊照樣收下，之後做了簡報記得再對一次。`],
  };
}

/** 改自哪一份：要是這門課、同種類、同一天的產物。沒給就通過。 */
export function checkEditedFrom(
  editedFromId: string | null,
  target: { kind: ArtifactKind; day: number | null },
  artifacts: ArtifactRecord[],
): string[] {
  if (editedFromId === null) return [];
  const original = artifacts.find((a) => a.id === editedFromId);
  if (original !== undefined && original.kind === target.kind && original.day === target.day) return [];
  return ["edited_from_id 要是這門課同種類、同一天的產物。"];
}

/**
 * 過期原因，在讀取時算、不存進資料庫。依 STALE_REASONS 的順序回傳。
 * - blueprint_outdated：產物照的藍圖版本比最新版舊。
 * - upstream_outdated：學員手冊的上游簡報找得到，而且那天有更新的 ready 簡報，或上游自己照舊版藍圖做的。
 */
export function staleReasons(
  artifact: ArtifactRecord,
  artifacts: ArtifactRecord[],
  latestBlueprintVersion: number | null,
): StaleReason[] {
  const found = new Set<StaleReason>();

  if (latestBlueprintVersion !== null && artifact.blueprint_version < latestBlueprintVersion) {
    found.add("blueprint_outdated");
  }

  const upstream =
    artifact.kind === "handbook" && artifact.upstream_id !== null
      ? artifacts.find((a) => a.id === artifact.upstream_id && a.kind === "slides")
      : undefined;
  if (upstream !== undefined) {
    const newerReady = artifacts.some(
      (a) => a.kind === "slides" && a.day === upstream.day && a.status === "ready" && a.version > upstream.version,
    );
    const upstreamBlueprintOutdated =
      latestBlueprintVersion !== null && upstream.blueprint_version < latestBlueprintVersion;
    if (newerReady || upstreamBlueprintOutdated) found.add("upstream_outdated");
  }

  return STALE_REASONS.filter((reason) => found.has(reason));
}

/** 產物清單的一列。網頁與 MCP 的 rpai_platform_list_artifacts 都用這個形狀。 */
export interface ArtifactSummary {
  id: string;
  kind: ArtifactKind;
  kind_label: string;
  day: number | null;
  version: number;
  blueprint_version: number;
  status: ArtifactStatus;
  filename: string | null;
  stale_reasons: StaleReason[];
  created_at: string;
}

/**
 * 產物清單：依種類（課程大綱、簡報、學員手冊）、天由小到大、版本由大到小排序，並附過期原因。MCP 的 list_artifacts 與網頁都用它。
 * 不改傳進來的陣列。
 */
export function summarizeArtifacts(artifacts: ArtifactRecord[], latestBlueprintVersion: number | null): ArtifactSummary[] {
  return [...artifacts].sort(byKindDayVersion).map((a) => ({
    id: a.id,
    kind: a.kind,
    kind_label: ARTIFACT_KIND_LABELS[a.kind],
    day: a.day,
    version: a.version,
    blueprint_version: a.blueprint_version,
    status: a.status,
    filename: a.filename,
    stale_reasons: staleReasons(a, artifacts, latestBlueprintVersion),
    created_at: a.created_at,
  }));
}

function byKindDayVersion(a: ArtifactRecord, b: ArtifactRecord): number {
  return (
    ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind) ||
    (a.day ?? 0) - (b.day ?? 0) ||
    b.version - a.version
  );
}
