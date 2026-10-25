import { describe, expect, it } from "vitest";
import { contentTypeFor } from "@/lib/artifacts";
import { nextArtifactVersion, type ArtifactRecord } from "@/lib/artifact-rules";
import type { Blueprint } from "@/lib/blueprint/schema";
import { sampleBlueprint } from "@/lib/blueprint/testing";
import type { ArtifactStore } from "../artifact-store";
import { registerArtifactTools } from "./artifacts";
import { createTestServer, type ToolResult } from "./testing";

const BASE_URL = "https://rpai.test";
const NOW = new Date("2026-10-25T03:00:00.000Z");
const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const COURSE = "11111111-1111-4111-8111-111111111111";
const WRONG_UPSTREAM = "22222222-2222-4222-8222-222222222222";
const UPLOAD_PREFIX = "https://storage.test/upload/";

interface MemoryStore extends ArtifactStore {
  /** 新增一版藍圖（測試用，版本號自己給）。 */
  addBlueprint(version: number, content: Blueprint): void;
  /** 模擬 curl PUT 到 upload_url 成功：Storage 收到檔案。 */
  put(uploadUrl: string): void;
}

/**
 * 記憶體版的 ArtifactStore。課程只屬於 ALICE；owner 過濾、版本取號、markReady 清掉權杖都照介面的語意。
 */
function memoryStore(): MemoryStore {
  const blueprints: { id: string; version: number; content: Blueprint }[] = [];
  const rows: ArtifactRecord[] = [];
  const files = new Set<string>();
  const ownerOf = (courseId: string) => (courseId === COURSE ? ALICE : undefined);
  const copy = (row: ArtifactRecord): ArtifactRecord => ({ ...row, meta: { ...row.meta } });
  const latestVersion = () => (blueprints.length === 0 ? null : Math.max(...blueprints.map((b) => b.version)));

  const store: MemoryStore = {
    addBlueprint(version, content) {
      blueprints.push({ id: `bp-${version}`, version, content });
    },

    put(uploadUrl) {
      files.add(uploadUrl.slice(UPLOAD_PREFIX.length));
    },

    async getCourse(ownerId, courseId) {
      if (ownerOf(courseId) !== ownerId) return null;
      return { id: COURSE, title: "週報課", latestBlueprintVersion: latestVersion() };
    },

    async getBlueprint(courseId, version) {
      if (courseId !== COURSE) return null;
      const found = blueprints.find((b) => b.version === version);
      return found ? { id: found.id, version: found.version, content: found.content } : null;
    },

    async listArtifacts(courseId) {
      return rows.filter((row) => row.course_id === courseId).map(copy);
    },

    async getArtifact(ownerId, artifactId) {
      const row = rows.find((r) => r.id === artifactId);
      return row && ownerOf(row.course_id) === ownerId ? copy(row) : null;
    },

    async createArtifact(input) {
      const blueprint = blueprints.find((b) => b.id === input.blueprintId);
      if (!blueprint) throw new Error("測試資料錯誤：找不到藍圖");
      const sameCourse = rows.filter((r) => r.course_id === input.courseId);
      const record: ArtifactRecord = {
        id: input.id,
        course_id: input.courseId,
        kind: input.kind,
        day: input.day,
        version: nextArtifactVersion(sameCourse, input.kind, input.day),
        blueprint_version: blueprint.version,
        status: "generating",
        filename: input.filename,
        storage_path: input.storagePath,
        upstream_id: input.upstreamId,
        edited_from_id: input.editedFromId,
        created_at: new Date(NOW.getTime() + rows.length * 1000).toISOString(),
        meta: { ...input.meta },
      };
      rows.push(record);
      return copy(record);
    },

    async createUploadUrl(storagePath) {
      return `${UPLOAD_PREFIX}${storagePath}`;
    },

    async fileExists(storagePath) {
      return files.has(storagePath);
    },

    async markReady(artifactId) {
      const row = rows.find((r) => r.id === artifactId);
      if (!row) throw new Error("測試資料錯誤：找不到產物");
      row.status = "ready";
      delete row.meta.upload_token_hash;
      delete row.meta.upload_expires_at;
    },

    async createDownloadUrl(storagePath) {
      return `https://storage.test/download/${storagePath}`;
    },
  };

  store.addBlueprint(1, sampleBlueprint());
  return store;
}

function setup(store: MemoryStore = memoryStore()) {
  const t = createTestServer();
  registerArtifactTools(t.server, store, { baseUrl: BASE_URL, now: () => NOW });
  return { t, store };
}

type Harness = ReturnType<typeof setup>;

interface ListedRow {
  id: string;
  kind: string;
  day: number | null;
  version: number;
  stale_reasons: string[];
}

async function request(t: Harness["t"], args: Record<string, unknown>, ownerId = ALICE): Promise<ToolResult> {
  return t.call("rpai_platform_request_artifact_upload", { course_id: COURSE, blueprint_version: 1, ...args }, { ownerId });
}

async function complete(t: Harness["t"], artifactId: string, ownerId = ALICE): Promise<ToolResult> {
  return t.call("rpai_platform_complete_artifact_upload", { artifact_id: artifactId }, { ownerId });
}

async function list(t: Harness["t"], ownerId = ALICE): Promise<ToolResult> {
  return t.call("rpai_platform_list_artifacts", { course_id: COURSE }, { ownerId });
}

async function listRows(t: Harness["t"], ownerId = ALICE): Promise<ListedRow[]> {
  const res = await list(t, ownerId);
  return res.structuredContent?.artifacts as ListedRow[];
}

async function download(t: Harness["t"], artifactId: string, ownerId = ALICE): Promise<ToolResult> {
  return t.call("rpai_platform_get_artifact_download", { artifact_id: artifactId }, { ownerId });
}

function rowOf(rows: ListedRow[], artifactId: string): ListedRow {
  const row = rows.find((r) => r.id === artifactId);
  if (!row) throw new Error(`列表裡沒有產物 ${artifactId}`);
  return row;
}

/** 上傳並完成一份產物：模擬 curl PUT 成功，再呼叫 complete。回傳 artifact_id。 */
async function publish(h: Harness, args: Record<string, unknown>): Promise<string> {
  const res = await request(h.t, args);
  expect(res.isError).toBeUndefined();
  const id = res.structuredContent?.artifact_id as string;
  h.store.put(res.structuredContent?.upload_url as string);
  expect((await complete(h.t, id)).isError).toBeUndefined();
  return id;
}

describe("rpai_platform_request_artifact_upload", () => {
  it("三種產物照規則收下，回傳上傳網址、上傳頁網址與 content type", async () => {
    const h = setup();
    const outline = await request(h.t, { kind: "outline", filename: "週報課_大綱.docx" });
    const slides = await request(h.t, { kind: "slides", day: 1, filename: "週報課_第1天_簡報.pptx" });
    const handbook = await request(h.t, { kind: "handbook", day: 1, filename: "週報課_第1天_手冊.html" });

    expect(outline.structuredContent).toMatchObject({
      version: 1,
      content_type: contentTypeFor("週報課_大綱.docx"),
      expires_in_seconds: 7200,
      warnings: [],
    });
    expect(slides.structuredContent).toMatchObject({ content_type: contentTypeFor("週報課_第1天_簡報.pptx") });
    expect(handbook.structuredContent).toMatchObject({ content_type: "text/html" });

    for (const res of [outline, slides, handbook]) {
      const id = res.structuredContent?.artifact_id as string;
      expect(String(res.structuredContent?.upload_url)).toMatch(/^https:\/\/storage\.test\/upload\//);
      const pageUrl = String(res.structuredContent?.upload_page_url);
      expect(pageUrl.startsWith(`${BASE_URL}/u/${id}?t=`)).toBe(true);
    }
  });

  it("不合規則時回白話錯誤，而且沒有寫入任何產物", async () => {
    const h = setup();
    const cases: [Record<string, unknown>, string][] = [
      [{ kind: "outline", day: 1, filename: "大綱.docx" }, "課程大綱是整門課一份，不要給 day。"],
      [{ kind: "outline", filename: "大綱.pptx" }, "課程大綱要上傳 .docx 檔。"],
      [{ kind: "slides", filename: "簡報.pptx" }, "簡報一天一份，要給 day（1 到 2）。"],
      [{ kind: "slides", day: 3, filename: "簡報.pptx" }, "藍圖只有 2 天，沒有第 3 天。"],
      [{ kind: "handbook", day: 2, filename: "手冊.html" }, "第 2 天沒有動手環節，不產學員手冊。"],
      [{ kind: "handbook", day: 1, filename: "手冊.pdf" }, "學員手冊要上傳 .html 檔。"],
      [{ kind: "slides", day: 1, filename: "簡報.pptx", upstream_artifact_id: WRONG_UPSTREAM }, "只有學員手冊有上游（那一天的簡報）。"],
    ];
    for (const [args, message] of cases) {
      const res = await request(h.t, args);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain(message);
    }
    expect(await h.store.listArtifacts(COURSE)).toEqual([]);
  });

  it("多個錯誤會一起回，讓講師一次改完", async () => {
    const res = await request(setup().t, { kind: "outline", day: 1, filename: "大綱.pptx" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("課程大綱是整門課一份，不要給 day。");
    expect(res.content[0].text).toContain("課程大綱要上傳 .docx 檔。");
  });

  it("同一種類同一天的版本遞增，不同天各自從 v1 起算", async () => {
    const h = setup();
    const versionOf = async (args: Record<string, unknown>) =>
      (await request(h.t, args)).structuredContent?.version;

    expect(await versionOf({ kind: "slides", day: 1, filename: "a.pptx" })).toBe(1);
    expect(await versionOf({ kind: "slides", day: 1, filename: "b.pptx" })).toBe(2);
    expect(await versionOf({ kind: "slides", day: 2, filename: "c.pptx" })).toBe(1);
    expect(await versionOf({ kind: "outline", filename: "d.docx" })).toBe(1);
    expect(await versionOf({ kind: "outline", filename: "e.docx" })).toBe(2);
  });

  it("改過再上傳會存成同一份產物的新版本，並記下改自哪一份", async () => {
    const h = setup();
    const original = await publish(h, { kind: "slides", day: 1, filename: "第1天_簡報.pptx" });
    const edited = await request(h.t, { kind: "slides", day: 1, filename: "第1天_簡報_改.pptx", edited_from_id: original });

    expect(edited.isError).toBeUndefined();
    expect(edited.structuredContent?.version).toBe(2);
    const record = (await h.store.listArtifacts(COURSE)).find((a) => a.id === edited.structuredContent?.artifact_id);
    expect(record?.edited_from_id).toBe(original);
  });

  it("學員手冊沒給上游就自動接那天最新的 ready 簡報，不接還在生成的", async () => {
    const h = setup();
    const slidesV1 = await publish(h, { kind: "slides", day: 1, filename: "第1天_簡報v1.pptx" });
    await request(h.t, { kind: "slides", day: 1, filename: "第1天_簡報v2.pptx" });

    const handbook = await request(h.t, { kind: "handbook", day: 1, filename: "第1天_手冊.html" });
    expect(handbook.isError).toBeUndefined();
    expect(handbook.structuredContent?.warnings).toEqual([]);

    const record = (await h.store.listArtifacts(COURSE)).find((a) => a.id === handbook.structuredContent?.artifact_id);
    expect(record?.upstream_id).toBe(slidesV1);
  });

  it("學員手冊那天還沒有簡報時照樣收下，warnings 提醒之後要再對一次", async () => {
    const res = await request(setup().t, { kind: "handbook", day: 1, filename: "第1天_手冊.html" });
    expect(res.isError).toBeUndefined();
    expect(res.structuredContent?.warnings).toEqual([
      "第 1 天還沒有簡報；學員手冊照樣收下，之後做了簡報記得再對一次。",
    ]);
  });

  it("blueprint_version 不是最新時有 warning；沒有那一版時回錯誤", async () => {
    const h = setup();
    const missing = await request(h.t, { kind: "slides", day: 1, blueprint_version: 2, filename: "a.pptx" });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain("這門課沒有第 2 版藍圖");

    h.store.addBlueprint(2, sampleBlueprint({ title: "用 AI 工具把週報時間砍一半（第二版）" }));
    const outdated = await request(h.t, { kind: "slides", day: 1, blueprint_version: 1, filename: "a.pptx" });
    expect(outdated.isError).toBeUndefined();
    expect(outdated.structuredContent?.warnings).toEqual([
      "第 1 版不是最新的藍圖（最新是第 2 版），這份產物存進來就會標成藍圖過期。",
    ]);
  });
});

describe("rpai_platform_complete_artifact_upload", () => {
  it("Storage 沒有檔案時不標 ready；有檔案時標 ready，meta 裡的權杖被清掉", async () => {
    const h = setup();
    const res = await request(h.t, { kind: "slides", day: 1, filename: "第1天_簡報.pptx" });
    const id = res.structuredContent?.artifact_id as string;

    const early = await complete(h.t, id);
    expect(early.isError).toBe(true);
    expect(early.content[0].text).toContain("Storage 裡還沒有這個檔案");
    expect((await h.store.getArtifact(ALICE, id))?.status).toBe("generating");
    expect((await h.store.getArtifact(ALICE, id))?.meta).toHaveProperty("upload_token_hash");

    h.store.put(res.structuredContent?.upload_url as string);
    const done = await complete(h.t, id);
    expect(done.isError).toBeUndefined();
    expect(done.structuredContent).toEqual({ artifact_id: id, status: "ready" });

    const after = await h.store.getArtifact(ALICE, id);
    expect(after?.status).toBe("ready");
    expect(after?.meta).not.toHaveProperty("upload_token_hash");
    expect(after?.meta).not.toHaveProperty("upload_expires_at");
  });

  it("已經是 ready 再呼叫，還是回成功", async () => {
    const h = setup();
    const id = await publish(h, { kind: "outline", filename: "大綱.docx" });
    expect((await complete(h.t, id)).structuredContent).toEqual({ artifact_id: id, status: "ready" });
  });
});

describe("rpai_platform_list_artifacts", () => {
  it("依種類、天、版本排序", async () => {
    const h = setup();
    await publish(h, { kind: "slides", day: 2, filename: "d2.pptx" });
    await publish(h, { kind: "outline", filename: "大綱.docx" });
    await publish(h, { kind: "slides", day: 1, filename: "d1v1.pptx" });
    await publish(h, { kind: "slides", day: 1, filename: "d1v2.pptx" });
    await publish(h, { kind: "handbook", day: 1, filename: "d1.html" });

    const order = (await listRows(h.t)).map((r) => `${r.kind}-${r.day}-v${r.version}`);
    expect(order).toEqual(["outline-null-v1", "slides-1-v2", "slides-1-v1", "slides-2-v1", "handbook-1-v1"]);
  });

  it("藍圖升到 v2 後，照 v1 做的產物標成 blueprint_outdated；手冊的上游也是舊的，所以同時標上游過期", async () => {
    const h = setup();
    const slides = await publish(h, { kind: "slides", day: 1, filename: "第1天_簡報.pptx" });
    const handbook = await publish(h, { kind: "handbook", day: 1, filename: "第1天_手冊.html" });
    h.store.addBlueprint(2, sampleBlueprint());

    const res = await list(h.t);
    expect(res.structuredContent?.latest_blueprint_version).toBe(2);
    const rows = await listRows(h.t);
    expect(rowOf(rows, slides).stale_reasons).toEqual(["blueprint_outdated"]);
    expect(rowOf(rows, handbook).stale_reasons).toEqual(["blueprint_outdated", "upstream_outdated"]);
  });

  it("那天的簡報有新的 ready 版本後，用舊簡報做的手冊標成 upstream_outdated", async () => {
    const h = setup();
    await publish(h, { kind: "slides", day: 1, filename: "第1天_簡報v1.pptx" });
    const handbook = await publish(h, { kind: "handbook", day: 1, filename: "第1天_手冊.html" });
    expect(rowOf(await listRows(h.t), handbook).stale_reasons).toEqual([]);

    await publish(h, { kind: "slides", day: 1, filename: "第1天_簡報v2.pptx" });
    expect(rowOf(await listRows(h.t), handbook).stale_reasons).toEqual(["upstream_outdated"]);
  });

  it("藍圖升版後重新產出的簡報與手冊沒有過期原因", async () => {
    const h = setup();
    await publish(h, { kind: "slides", day: 1, filename: "舊簡報.pptx" });
    h.store.addBlueprint(2, sampleBlueprint());
    const slides = await publish(h, { kind: "slides", day: 1, blueprint_version: 2, filename: "新簡報.pptx" });
    const handbook = await publish(h, { kind: "handbook", day: 1, blueprint_version: 2, filename: "新手冊.html" });

    const rows = await listRows(h.t);
    expect(rowOf(rows, slides).stale_reasons).toEqual([]);
    expect(rowOf(rows, handbook).stale_reasons).toEqual([]);
  });
});

describe("rpai_platform_get_artifact_download", () => {
  it("還沒 ready 的產物拿不到下載網址；ready 的拿得到，有效 600 秒", async () => {
    const h = setup();
    const res = await request(h.t, { kind: "slides", day: 1, filename: "第1天_簡報.pptx" });
    const id = res.structuredContent?.artifact_id as string;

    const notYet = await download(h.t, id);
    expect(notYet.isError).toBe(true);
    expect(notYet.content[0].text).toContain("這份產物還沒上傳完成。");

    h.store.put(res.structuredContent?.upload_url as string);
    await complete(h.t, id);
    const ready = await download(h.t, id);
    expect(ready.isError).toBeUndefined();
    expect(ready.structuredContent).toMatchObject({ filename: "第1天_簡報.pptx", expires_in_seconds: 600 });
    expect(String(ready.structuredContent?.download_url).startsWith("https://")).toBe(true);
  });
});

describe("別的講師", () => {
  it("對四個工具的呼叫一律回含「找不到」的錯誤，而且不會寫入任何東西", async () => {
    const h = setup();
    const id = await publish(h, { kind: "slides", day: 1, filename: "第1天_簡報.pptx" });

    const results = [
      await request(h.t, { kind: "slides", day: 1, filename: "第1天_簡報v2.pptx" }, BOB),
      await complete(h.t, id, BOB),
      await list(h.t, BOB),
      await download(h.t, id, BOB),
    ];
    for (const res of results) {
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("找不到");
    }
    expect(await h.store.listArtifacts(COURSE)).toHaveLength(1);
  });
});
