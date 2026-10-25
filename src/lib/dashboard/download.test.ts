import { describe, expect, it, vi } from "vitest";
import type { ArtifactRecord } from "@/lib/artifact-rules";
import { downloadTarget, type DownloadDeps } from "./download";

const ARTIFACT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATH = "owner/course/aaaa/第1天_簡報.pptx";

type Found = ArtifactRecord & { course_title: string };

function found(overrides: Partial<ArtifactRecord> = {}): Found {
  return {
    id: ARTIFACT,
    course_id: "11111111-1111-4111-8111-111111111111",
    kind: "slides",
    day: 1,
    version: 1,
    blueprint_version: 1,
    status: "ready",
    filename: "第1天_簡報.pptx",
    storage_path: PATH,
    upstream_id: null,
    edited_from_id: null,
    created_at: "2026-10-25T02:00:00.000Z",
    meta: {},
    course_title: "週報課",
    ...overrides,
  };
}

/** 假的讀取：getArtifact 回傳 artifact（null 表示找不到）；createDownloadUrl 回一個可辨認的網址。 */
function deps(artifact: Found | null) {
  const createDownloadUrl = vi.fn(async (storagePath: string) => `https://storage.test/download/${storagePath}?t=1`);
  const d: DownloadDeps = { getArtifact: vi.fn(async () => artifact), createDownloadUrl };
  return { d, createDownloadUrl };
}

describe("downloadTarget", () => {
  it("產物不存在時回 null，而且不簽網址", async () => {
    const { d, createDownloadUrl } = deps(null);
    expect(await downloadTarget(ARTIFACT, d)).toBeNull();
    expect(createDownloadUrl).not.toHaveBeenCalled();
  });

  it.each(["pending", "generating", "failed"] as const)("狀態是 %s（還沒 ready）時回 null", async (status) => {
    const { d, createDownloadUrl } = deps(found({ status }));
    expect(await downloadTarget(ARTIFACT, d)).toBeNull();
    expect(createDownloadUrl).not.toHaveBeenCalled();
  });

  it("ready 但沒有 storage_path 時回 null", async () => {
    const { d, createDownloadUrl } = deps(found({ storage_path: null }));
    expect(await downloadTarget(ARTIFACT, d)).toBeNull();
    expect(createDownloadUrl).not.toHaveBeenCalled();
  });

  it("ready 時回下載網址，簽的是產物的 storage_path", async () => {
    const { d, createDownloadUrl } = deps(found());
    expect(await downloadTarget(ARTIFACT, d)).toBe(`https://storage.test/download/${PATH}?t=1`);
    expect(createDownloadUrl).toHaveBeenCalledWith(PATH);
  });
});
