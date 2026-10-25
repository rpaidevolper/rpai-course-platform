import { describe, expect, it, vi } from "vitest";
import type { ArtifactRecord } from "@/lib/artifact-rules";
import { createUploadToken, UPLOAD_TOKEN_TTL_SECONDS } from "@/lib/upload-token";
import { finishUpload, INVALID_LINK_MESSAGE, NOT_RECEIVED_MESSAGE, startUpload, type UploadDeps } from "./upload";

const NOW = new Date("2026-10-25T03:00:00.000Z");
const COURSE = "11111111-1111-4111-8111-111111111111";
const ARTIFACT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATH = `owner/${COURSE}/${ARTIFACT}/第1天_簡報.pptx`;
const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** 一份等著上傳的簡報（權杖在 NOW 產生）。回傳權杖明文與產物。 */
function waiting(overrides: Partial<ArtifactRecord> = {}): { token: string; artifact: ArtifactRecord } {
  const { token, meta } = createUploadToken(NOW);
  return {
    token,
    artifact: {
      id: ARTIFACT,
      course_id: COURSE,
      kind: "slides",
      day: 1,
      version: 1,
      blueprint_version: 1,
      status: "generating",
      filename: "第1天_簡報.pptx",
      storage_path: PATH,
      upstream_id: null,
      edited_from_id: null,
      created_at: "2026-10-25T02:00:00.000Z",
      meta: { ...meta },
      ...overrides,
    },
  };
}

/**
 * 記憶體版的讀取與 Storage。files 是 Storage 裡已經有的檔案路徑。
 * markReady 跟真正的 store 一樣：列改成 ready，並從 meta 拿掉權杖。
 */
function memory(artifact: ArtifactRecord | null, files: string[], now: Date = NOW) {
  const rows = new Map<string, ArtifactRecord>(artifact ? [[artifact.id, { ...artifact, meta: { ...artifact.meta } }]] : []);
  const stored = new Set(files);
  const createUploadUrl = vi.fn(async (storagePath: string) => `https://storage.test/upload/${storagePath}`);
  const fileExists = vi.fn(async (storagePath: string) => stored.has(storagePath));
  const markReady = vi.fn(async (artifactId: string) => {
    const row = rows.get(artifactId);
    if (!row) throw new Error("測試資料錯誤：找不到產物");
    row.status = "ready";
    delete row.meta.upload_token_hash;
    delete row.meta.upload_expires_at;
  });

  const deps: UploadDeps = {
    store: {
      async getArtifact(artifactId) {
        const row = rows.get(artifactId);
        return row ? { ...row, meta: { ...row.meta }, course_title: "週報課" } : null;
      },
    },
    artifacts: { createUploadUrl, fileExists, markReady },
    now: () => now,
  };
  return { deps, rows, createUploadUrl, fileExists, markReady };
}

const LATER = new Date(NOW.getTime() + (UPLOAD_TOKEN_TTL_SECONDS + 1) * 1000);

describe("startUpload", () => {
  it("權杖對時回上傳網址與 content type（依檔名的副檔名）", async () => {
    const { token, artifact } = waiting();
    const m = memory(artifact, []);

    expect(await startUpload(m.deps, ARTIFACT, token)).toEqual({
      ok: true,
      uploadUrl: `https://storage.test/upload/${PATH}`,
      contentType: PPTX_TYPE,
    });
    expect(m.createUploadUrl).toHaveBeenCalledWith(PATH);
  });

  it("權杖錯時拒絕，不給上傳網址", async () => {
    const { artifact } = waiting();
    const m = memory(artifact, []);

    expect(await startUpload(m.deps, ARTIFACT, "not-the-token")).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });
    expect(m.createUploadUrl).not.toHaveBeenCalled();
  });

  it("權杖過期（超過 2 小時）時拒絕", async () => {
    const { token, artifact } = waiting();
    const m = memory(artifact, [], LATER);

    expect(await startUpload(m.deps, ARTIFACT, token)).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });
    expect(m.createUploadUrl).not.toHaveBeenCalled();
  });

  it("產物不存在時拒絕", async () => {
    const { token } = waiting();
    const m = memory(null, []);

    expect(await startUpload(m.deps, ARTIFACT, token)).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });
    expect(m.createUploadUrl).not.toHaveBeenCalled();
  });

  it("產物已經 ready 時拒絕，即使權杖還在", async () => {
    const { token, artifact } = waiting({ status: "ready" });
    const m = memory(artifact, []);

    expect(await startUpload(m.deps, ARTIFACT, token)).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });
    expect(m.createUploadUrl).not.toHaveBeenCalled();
  });
});

describe("finishUpload", () => {
  it("Storage 裡還沒有檔案時不標 ready，回「還沒收到檔案」", async () => {
    const { token, artifact } = waiting();
    const m = memory(artifact, []);

    expect(await finishUpload(m.deps, ARTIFACT, token)).toEqual({ ok: false, error: NOT_RECEIVED_MESSAGE });
    expect(m.markReady).not.toHaveBeenCalled();
    expect(m.rows.get(ARTIFACT)?.status).toBe("generating");
  });

  it("檔案到了才標 ready，權杖從 meta 拿掉；標完之後同一個權杖就不能再用", async () => {
    const { token, artifact } = waiting();
    const m = memory(artifact, [PATH]);

    expect(await finishUpload(m.deps, ARTIFACT, token)).toEqual({ ok: true });
    expect(m.markReady).toHaveBeenCalledWith(ARTIFACT);
    expect(m.rows.get(ARTIFACT)?.status).toBe("ready");
    expect(m.rows.get(ARTIFACT)?.meta).toEqual({});

    expect(await startUpload(m.deps, ARTIFACT, token)).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });
  });

  it("權杖錯時拒絕，即使 Storage 裡已經有檔案，也不標 ready", async () => {
    const { artifact } = waiting();
    const m = memory(artifact, [PATH]);

    expect(await finishUpload(m.deps, ARTIFACT, "not-the-token")).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });
    expect(m.markReady).not.toHaveBeenCalled();
    expect(m.rows.get(ARTIFACT)?.status).toBe("generating");
  });

  it("權杖過期、產物不存在、已經 ready 時都拒絕，而且不標 ready", async () => {
    const expired = waiting();
    const expiredMemory = memory(expired.artifact, [PATH], LATER);
    expect(await finishUpload(expiredMemory.deps, ARTIFACT, expired.token)).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });

    const missing = memory(null, [PATH]);
    expect(await finishUpload(missing.deps, ARTIFACT, expired.token)).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });

    const done = waiting({ status: "ready" });
    const doneMemory = memory(done.artifact, [PATH]);
    expect(await finishUpload(doneMemory.deps, ARTIFACT, done.token)).toEqual({ ok: false, error: INVALID_LINK_MESSAGE });

    for (const m of [expiredMemory, missing, doneMemory]) {
      expect(m.markReady).not.toHaveBeenCalled();
    }
  });
});
