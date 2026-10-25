import { describe, expect, it } from "vitest";
import { sampleBlueprint } from "@/lib/blueprint/testing";
import {
  checkArtifactRequest,
  checkEditedFrom,
  handsOnDays,
  nextArtifactVersion,
  resolveUpstream,
  staleReasons,
  summarizeArtifacts,
  type ArtifactRecord,
} from "./artifact-rules";

const COURSE = "11111111-1111-4111-8111-111111111111";
const NO_HANDS_ON_DAY_2 = "第 2 天沒有動手環節，不產學員手冊。";

/** 測試用的產物：預設是 ready、課程大綱、藍圖第 1 版。 */
function artifact(overrides: Partial<ArtifactRecord> & Pick<ArtifactRecord, "id" | "kind">): ArtifactRecord {
  return {
    course_id: COURSE,
    day: null,
    version: 1,
    blueprint_version: 1,
    status: "ready",
    filename: null,
    storage_path: null,
    upstream_id: null,
    edited_from_id: null,
    created_at: "2026-10-25T00:00:00.000Z",
    meta: {},
    ...overrides,
  };
}

describe("handsOnDays", () => {
  it("只回有動手環節的天；測試藍圖只有第 1 天", () => {
    expect(handsOnDays(sampleBlueprint())).toEqual([1]);
  });
});

describe("checkArtifactRequest", () => {
  const bp = sampleBlueprint();

  it("三種產物照規則都通過", () => {
    expect(checkArtifactRequest({ kind: "outline", day: null, filename: "週報課_大綱.docx" }, bp)).toEqual([]);
    expect(checkArtifactRequest({ kind: "slides", day: 2, filename: "第2天_簡報.pptx" }, bp)).toEqual([]);
    expect(checkArtifactRequest({ kind: "handbook", day: 1, filename: "第1天_手冊.html" }, bp)).toEqual([]);
  });

  it("副檔名不分大小寫", () => {
    expect(checkArtifactRequest({ kind: "slides", day: 1, filename: "deck.PPTX" }, bp)).toEqual([]);
  });

  it("課程大綱不給 day，也只收 .docx", () => {
    expect(checkArtifactRequest({ kind: "outline", day: 1, filename: "大綱.docx" }, bp)).toEqual([
      "課程大綱是整門課一份，不要給 day。",
    ]);
    expect(checkArtifactRequest({ kind: "outline", day: null, filename: "大綱.pptx" }, bp)).toEqual([
      "課程大綱要上傳 .docx 檔。",
    ]);
  });

  it("簡報一天一份：沒給 day 或超過藍圖天數都回錯誤", () => {
    expect(checkArtifactRequest({ kind: "slides", day: null, filename: "簡報.pptx" }, bp)).toEqual([
      "簡報一天一份，要給 day（1 到 2）。",
    ]);
    expect(checkArtifactRequest({ kind: "slides", day: 3, filename: "簡報.pptx" }, bp)).toEqual([
      "藍圖只有 2 天，沒有第 3 天。",
    ]);
  });

  it("簡報只收 .pptx", () => {
    expect(checkArtifactRequest({ kind: "slides", day: 1, filename: "簡報.docx" }, bp)).toEqual([
      "簡報要上傳 .pptx 檔。",
    ]);
  });

  it("學員手冊只給有動手環節的天：第 2 天是純講述，不產手冊", () => {
    expect(checkArtifactRequest({ kind: "handbook", day: 2, filename: "手冊.html" }, bp)).toEqual([
      NO_HANDS_ON_DAY_2,
    ]);
  });

  it("學員手冊沒給 day、或副檔名不對都回錯誤", () => {
    expect(checkArtifactRequest({ kind: "handbook", day: null, filename: "手冊.html" }, bp)).toEqual([
      "學員手冊一天一份，要給 day（1 到 2）。",
    ]);
    expect(checkArtifactRequest({ kind: "handbook", day: 1, filename: "手冊.pdf" }, bp)).toEqual([
      "學員手冊要上傳 .html 檔。",
    ]);
  });
});

describe("nextArtifactVersion", () => {
  it("同一種類、同一天遞增", () => {
    const existing = [
      artifact({ id: "s1", kind: "slides", day: 1, version: 1 }),
      artifact({ id: "s2", kind: "slides", day: 1, version: 2 }),
    ];
    expect(nextArtifactVersion(existing, "slides", 1)).toBe(3);
  });

  it("不同天各自從 1 起算", () => {
    const existing = [artifact({ id: "s1", kind: "slides", day: 1, version: 3 })];
    expect(nextArtifactVersion(existing, "slides", 2)).toBe(1);
  });

  it("課程大綱沒有天（day 是 null），自己遞增", () => {
    const existing = [artifact({ id: "o1", kind: "outline", version: 1 })];
    expect(nextArtifactVersion(existing, "outline", null)).toBe(2);
  });

  it("不同種類各算各的；還沒在生成的版本也算進去，不重複用號", () => {
    const existing = [
      artifact({ id: "s1", kind: "slides", day: 1, version: 5 }),
      artifact({ id: "h1", kind: "handbook", day: 1, version: 1, status: "generating" }),
    ];
    expect(nextArtifactVersion(existing, "handbook", 1)).toBe(2);
    expect(nextArtifactVersion(existing, "handbook", 2)).toBe(1);
  });
});

describe("resolveUpstream", () => {
  it("學員手冊沒指定上游，就自動取那天最新的 ready 簡報，不取 generating 的", () => {
    const artifacts = [
      artifact({ id: "s1", kind: "slides", day: 1, version: 1 }),
      artifact({ id: "s2", kind: "slides", day: 1, version: 2 }),
      artifact({ id: "s3", kind: "slides", day: 1, version: 3, status: "generating" }),
    ];
    expect(resolveUpstream({ kind: "handbook", day: 1, upstreamArtifactId: null, artifacts })).toEqual({
      upstreamId: "s2",
      errors: [],
      warnings: [],
    });
  });

  it("那天還沒有簡報時照樣收下，只給 warning", () => {
    const artifacts = [artifact({ id: "s1", kind: "slides", day: 2, version: 1 })];
    expect(resolveUpstream({ kind: "handbook", day: 1, upstreamArtifactId: null, artifacts })).toEqual({
      upstreamId: null,
      errors: [],
      warnings: ["第 1 天還沒有簡報；學員手冊照樣收下，之後做了簡報記得再對一次。"],
    });
  });

  const NOT_THIS_UPSTREAM = "上游要是這門課第 1 天、已經上傳完成的簡報。";

  it("指定的上游是別天的簡報，回錯誤", () => {
    const artifacts = [artifact({ id: "s2", kind: "slides", day: 2, version: 1 })];
    expect(resolveUpstream({ kind: "handbook", day: 1, upstreamArtifactId: "s2", artifacts }).errors).toEqual([
      NOT_THIS_UPSTREAM,
    ]);
  });

  it("指定的上游不是簡報，或還沒上傳完成，都回錯誤", () => {
    const artifacts = [
      artifact({ id: "h1", kind: "handbook", day: 1, version: 1 }),
      artifact({ id: "s1", kind: "slides", day: 1, version: 1, status: "generating" }),
    ];
    expect(resolveUpstream({ kind: "handbook", day: 1, upstreamArtifactId: "h1", artifacts }).errors).toEqual([
      NOT_THIS_UPSTREAM,
    ]);
    expect(resolveUpstream({ kind: "handbook", day: 1, upstreamArtifactId: "s1", artifacts }).errors).toEqual([
      NOT_THIS_UPSTREAM,
    ]);
  });

  it("不是學員手冊卻給上游，回錯誤", () => {
    const artifacts = [artifact({ id: "s1", kind: "slides", day: 1, version: 1 })];
    expect(resolveUpstream({ kind: "slides", day: 1, upstreamArtifactId: "s1", artifacts })).toEqual({
      upstreamId: null,
      errors: ["只有學員手冊有上游（那一天的簡報）。"],
      warnings: [],
    });
  });
});

describe("checkEditedFrom", () => {
  const NOT_SAME_KIND_DAY = "edited_from_id 要是這門課同種類、同一天的產物。";

  it("改自同種類、同一天的產物可以；別的種類、別天、不存在的都不行", () => {
    const artifacts = [artifact({ id: "s1", kind: "slides", day: 1, version: 1 })];
    expect(checkEditedFrom("s1", { kind: "slides", day: 1 }, artifacts)).toEqual([]);
    expect(checkEditedFrom("s1", { kind: "slides", day: 2 }, artifacts)).toEqual([NOT_SAME_KIND_DAY]);
    expect(checkEditedFrom("s1", { kind: "handbook", day: 1 }, artifacts)).toEqual([NOT_SAME_KIND_DAY]);
    expect(checkEditedFrom("missing", { kind: "slides", day: 1 }, artifacts)).toEqual([NOT_SAME_KIND_DAY]);
  });

  it("沒有 edited_from_id 就通過", () => {
    expect(checkEditedFrom(null, { kind: "slides", day: 1 }, [])).toEqual([]);
  });
});

describe("staleReasons", () => {
  it("藍圖升版後，照舊版藍圖做的產物是 blueprint_outdated", () => {
    const slides = artifact({ id: "s1", kind: "slides", day: 1, version: 1, blueprint_version: 1 });
    expect(staleReasons(slides, [slides], 2)).toEqual(["blueprint_outdated"]);
  });

  it("那天的簡報有新的 ready 版本後，用舊簡報做的手冊是 upstream_outdated", () => {
    const s1 = artifact({ id: "s1", kind: "slides", day: 1, version: 1 });
    const s2 = artifact({ id: "s2", kind: "slides", day: 1, version: 2 });
    const handbook = artifact({ id: "h1", kind: "handbook", day: 1, version: 1, upstream_id: "s1" });
    expect(staleReasons(handbook, [s1, s2, handbook], 1)).toEqual(["upstream_outdated"]);
  });

  it("新的簡報還沒 ready 時，手冊不算過期", () => {
    const s1 = artifact({ id: "s1", kind: "slides", day: 1, version: 1 });
    const s2 = artifact({ id: "s2", kind: "slides", day: 1, version: 2, status: "generating" });
    const handbook = artifact({ id: "h1", kind: "handbook", day: 1, version: 1, upstream_id: "s1" });
    expect(staleReasons(handbook, [s1, s2, handbook], 1)).toEqual([]);
  });

  it("上游簡報自己照舊版藍圖做的，手冊也是 upstream_outdated", () => {
    const s1 = artifact({ id: "s1", kind: "slides", day: 1, version: 1, blueprint_version: 1 });
    const handbook = artifact({ id: "h1", kind: "handbook", day: 1, version: 1, blueprint_version: 2, upstream_id: "s1" });
    expect(staleReasons(handbook, [s1, handbook], 2)).toEqual(["upstream_outdated"]);
  });

  it("藍圖和上游都過期時，依 STALE_REASONS 的順序回傳", () => {
    const s1 = artifact({ id: "s1", kind: "slides", day: 1, version: 1, blueprint_version: 1 });
    const s2 = artifact({ id: "s2", kind: "slides", day: 1, version: 2, blueprint_version: 2 });
    const handbook = artifact({ id: "h1", kind: "handbook", day: 1, version: 1, blueprint_version: 1, upstream_id: "s1" });
    expect(staleReasons(handbook, [s1, s2, handbook], 2)).toEqual(["blueprint_outdated", "upstream_outdated"]);
  });

  it("上游找不到時，手冊不判上游過期", () => {
    const handbook = artifact({ id: "h1", kind: "handbook", day: 1, version: 1, upstream_id: "gone" });
    expect(staleReasons(handbook, [handbook], 1)).toEqual([]);
  });

  it("最新的產物沒有過期原因", () => {
    const slides = artifact({ id: "s1", kind: "slides", day: 1, version: 1, blueprint_version: 2 });
    const handbook = artifact({ id: "h1", kind: "handbook", day: 1, version: 1, blueprint_version: 2, upstream_id: "s1" });
    expect(staleReasons(slides, [slides, handbook], 2)).toEqual([]);
    expect(staleReasons(handbook, [slides, handbook], 2)).toEqual([]);
  });
});

describe("summarizeArtifacts", () => {
  it("依種類（課程大綱、簡報、學員手冊）、天由小到大、版本由大到小排序", () => {
    const artifacts = [
      artifact({ id: "h1", kind: "handbook", day: 1, version: 1 }),
      artifact({ id: "s2", kind: "slides", day: 2, version: 1 }),
      artifact({ id: "s1v1", kind: "slides", day: 1, version: 1 }),
      artifact({ id: "s1v2", kind: "slides", day: 1, version: 2 }),
      artifact({ id: "o1", kind: "outline", version: 1 }),
    ];
    expect(summarizeArtifacts(artifacts, 1).map((a) => a.id)).toEqual(["o1", "s1v2", "s1v1", "s2", "h1"]);
  });

  it("不改傳進來的陣列順序", () => {
    const artifacts = [
      artifact({ id: "h1", kind: "handbook", day: 1, version: 1 }),
      artifact({ id: "o1", kind: "outline", version: 1 }),
    ];
    summarizeArtifacts(artifacts, 1);
    expect(artifacts.map((a) => a.id)).toEqual(["h1", "o1"]);
  });

  it("每筆只有清單要的欄位：附中文種類名與過期原因，不含儲存路徑與權杖", () => {
    const slides = artifact({
      id: "s1",
      kind: "slides",
      day: 1,
      version: 1,
      blueprint_version: 1,
      filename: "第1天_簡報.pptx",
      storage_path: "owner/course/s1/第1天_簡報.pptx",
      meta: { upload_token_hash: "abc", upload_expires_at: "2026-10-25T05:00:00.000Z" },
    });
    expect(summarizeArtifacts([slides], 2)).toEqual([
      {
        id: "s1",
        kind: "slides",
        kind_label: "簡報",
        day: 1,
        version: 1,
        blueprint_version: 1,
        status: "ready",
        filename: "第1天_簡報.pptx",
        stale_reasons: ["blueprint_outdated"],
        created_at: "2026-10-25T00:00:00.000Z",
      },
    ]);
  });

  it("過期原因用全部產物判斷：手冊的上游簡報有新版，手冊標 upstream_outdated", () => {
    const s1 = artifact({ id: "s1", kind: "slides", day: 1, version: 1 });
    const s2 = artifact({ id: "s2", kind: "slides", day: 1, version: 2 });
    const handbook = artifact({ id: "h1", kind: "handbook", day: 1, version: 1, upstream_id: "s1" });
    const rows = summarizeArtifacts([s1, s2, handbook], 1);
    expect(rows.find((r) => r.id === "h1")?.stale_reasons).toEqual(["upstream_outdated"]);
    expect(rows.find((r) => r.id === "s2")?.stale_reasons).toEqual([]);
  });

  it("還沒有藍圖（最新版本是 null）時，不判藍圖過期", () => {
    const slides = artifact({ id: "s1", kind: "slides", day: 1, version: 1, blueprint_version: 1 });
    expect(summarizeArtifacts([slides], null)[0].stale_reasons).toEqual([]);
  });

  it("沒有產物回空陣列", () => {
    expect(summarizeArtifacts([], 1)).toEqual([]);
  });
});
