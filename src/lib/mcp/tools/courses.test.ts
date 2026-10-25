import { describe, expect, it } from "vitest";
import type { Blueprint } from "@/lib/blueprint/schema";
import { sampleBlueprint } from "@/lib/blueprint/testing";
import type { BlueprintRecord, CourseStore } from "../course-store";
import { registerCourseTools } from "./courses";
import { createTestServer, type ToolResult } from "./testing";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const TITLE = "用 AI 工具把週報時間砍一半";

/**
 * 記憶體版的 CourseStore，語意照 Supabase 版：每個方法都用 ownerId 過濾，藍圖只增不改，
 * 課程標題跟著最新一版走。時間用計數器，排序不會因為同一毫秒而亂。
 */
function memoryStore(): CourseStore {
  interface Course {
    id: string;
    owner_id: string;
    title: string;
    updated_at: string;
    /** 寫入順序，最後一筆是最新版。 */
    versions: BlueprintRecord[];
  }
  const courses: Course[] = [];
  let clock = Date.UTC(2026, 9, 25);
  const tick = () => {
    clock += 1000;
    return new Date(clock).toISOString();
  };

  const addVersion = (course: Course, content: Blueprint, changeNote: string | null, at: string): number => {
    const version = (course.versions.at(-1)?.version ?? 0) + 1;
    course.versions.push({ id: crypto.randomUUID(), version, content, change_note: changeNote, created_at: at });
    return version;
  };

  return {
    async listCourses(ownerId) {
      return courses
        .filter((c) => c.owner_id === ownerId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((c) => ({
          id: c.id,
          title: c.title,
          latest_version: c.versions.at(-1)?.version ?? null,
          updated_at: c.updated_at,
        }));
    },

    async getBlueprint(ownerId, courseId, version) {
      const course = courses.find((c) => c.id === courseId && c.owner_id === ownerId);
      const newestFirst = [...(course?.versions ?? [])].reverse();
      const record = version === undefined ? newestFirst[0] : newestFirst.find((r) => r.version === version);
      if (!course || !record) return null;
      return {
        course: { id: course.id, title: course.title },
        blueprint: record,
        versions: newestFirst.map(({ version, created_at, change_note }) => ({ version, created_at, change_note })),
      };
    },

    async saveBlueprint(ownerId, input) {
      const at = tick();
      const { courseId, content, changeNote } = input;

      if (courseId === undefined) {
        const course: Course = {
          id: crypto.randomUUID(),
          owner_id: ownerId,
          title: content.title,
          updated_at: at,
          versions: [],
        };
        courses.push(course);
        const version = addVersion(course, content, changeNote, at);
        return { courseId: course.id, courseTitle: course.title, version, createdCourse: true };
      }

      const course = courses.find((c) => c.id === courseId && c.owner_id === ownerId);
      if (!course) return null;
      const version = addVersion(course, content, changeNote, at);
      course.title = content.title;
      course.updated_at = at;
      return { courseId: course.id, courseTitle: course.title, version, createdCourse: false };
    },
  };
}

function setup() {
  const t = createTestServer();
  registerCourseTools(t.server, memoryStore());
  return t;
}

type Setup = ReturnType<typeof setup>;

/** 工具成功時的 structuredContent；失敗就丟出錯誤訊息，讓測試直接看到原因。 */
function data(result: ToolResult): Record<string, unknown> {
  if (result.isError || !result.structuredContent) throw new Error(result.content[0].text);
  return result.structuredContent;
}

/** save_blueprint 成功時的 structuredContent（見 ./courses.ts）。 */
type Saved = { course_id: string; course_title: string; version: number; created_course: boolean };

/** 以講師身分存一版藍圖，回傳 save_blueprint 的結果。 */
async function save(
  t: Setup,
  ownerId: string,
  blueprint: Blueprint,
  args: { course_id?: string; change_note?: string } = {},
): Promise<Saved> {
  return data(await t.call("rpai_platform_save_blueprint", { blueprint, ...args }, { ownerId })) as Saved;
}

describe("rpai_platform_list_courses", () => {
  it("只列出權杖那位講師的課程", async () => {
    const t = setup();
    const { course_id } = await save(t, ALICE, sampleBlueprint());

    const alice = data(await t.call("rpai_platform_list_courses", {}, { ownerId: ALICE }));
    expect(alice).toMatchObject({ count: 1, courses: [{ id: course_id, title: TITLE }] });

    const bob = data(await t.call("rpai_platform_list_courses", {}, { ownerId: BOB }));
    expect(bob).toEqual({ count: 0, courses: [] });
  });

  it("用標題片段找課，不分大小寫；找不到時 count 是 0", async () => {
    const t = setup();
    await save(t, ALICE, sampleBlueprint({ title: "Excel 週報自動化" }));
    await save(t, ALICE, sampleBlueprint({ title: "簡報製作入門" }));

    const lower = data(await t.call("rpai_platform_list_courses", { query: "excel" }, { ownerId: ALICE }));
    expect(lower).toMatchObject({ count: 1, courses: [{ title: "Excel 週報自動化" }] });

    const upper = data(await t.call("rpai_platform_list_courses", { query: "EXCEL" }, { ownerId: ALICE }));
    expect(upper).toMatchObject({ count: 1, courses: [{ title: "Excel 週報自動化" }] });

    const none = data(await t.call("rpai_platform_list_courses", { query: "會計" }, { ownerId: ALICE }));
    expect(none).toEqual({ count: 0, courses: [] });
  });

  it("沒給 query、或 query 只有空白，列出全部", async () => {
    const t = setup();
    await save(t, ALICE, sampleBlueprint({ title: "Excel 週報自動化" }));
    await save(t, ALICE, sampleBlueprint({ title: "簡報製作入門" }));

    for (const args of [{}, { query: "   " }]) {
      const list = data(await t.call("rpai_platform_list_courses", args, { ownerId: ALICE }));
      expect(list.count).toBe(2);
    }
  });
});

describe("rpai_platform_get_blueprint", () => {
  it("回傳課程、藍圖 JSON、markdown 與 report", async () => {
    const t = setup();
    const blueprint = sampleBlueprint({
      openQuestions: [{ text: "場地有沒有投影機？", audience: "client", unit: null }],
    });
    const { course_id } = await save(t, ALICE, blueprint);

    const read = data(await t.call("rpai_platform_get_blueprint", { course_id }, { ownerId: ALICE }));
    expect(read).toMatchObject({
      course: { id: course_id, title: TITLE },
      version: 1,
      content: blueprint,
      markdown: expect.stringContaining("## 待確認事項\n- [問客戶] 場地有沒有投影機？"),
      report: {
        total_minutes: 720,
        missing_elements: [],
        issues: [
          "第 2 天上午「部門導入的阻力」是純講述單元，沒有動手環節。",
          "第 2 天下午「維護與治理」是純講述單元，沒有動手環節。",
        ],
        open_items: [{ text: "場地有沒有投影機？", audience: "client", unit: null, tool: null }],
      },
    });
  });

  it("舊版仍讀得到，versions 新到舊；沒有的版本回錯誤", async () => {
    const t = setup();
    const { course_id } = await save(t, ALICE, sampleBlueprint());
    await save(t, ALICE, sampleBlueprint({ title: "週報課（部門版）" }), {
      course_id,
      change_note: "改成部門版",
    });

    const v1 = data(await t.call("rpai_platform_get_blueprint", { course_id, version: 1 }, { ownerId: ALICE }));
    expect(v1).toMatchObject({ version: 1, content: { title: TITLE } });

    const latest = data(await t.call("rpai_platform_get_blueprint", { course_id }, { ownerId: ALICE }));
    expect(latest).toMatchObject({ version: 2, change_note: "改成部門版" });
    expect(latest.versions).toMatchObject([
      { version: 2, change_note: "改成部門版" },
      { version: 1, change_note: null },
    ]);

    const missing = await t.call("rpai_platform_get_blueprint", { course_id, version: 9 }, { ownerId: ALICE });
    expect(missing.isError).toBe(true);
  });

  it("別的講師的課回「找不到」", async () => {
    const t = setup();
    const { course_id } = await save(t, ALICE, sampleBlueprint());

    const result = await t.call("rpai_platform_get_blueprint", { course_id }, { ownerId: BOB });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("找不到");
  });

  it("course_id 不是 uuid 時不進 handler，錯誤指出欄位", async () => {
    const result = await setup().call("rpai_platform_get_blueprint", { course_id: "週報課" }, { ownerId: ALICE });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("course_id");
  });
});

describe("rpai_platform_save_blueprint", () => {
  it("沒給 course_id 會建立課程並存成 v1；同一門課再存就是 v2", async () => {
    const t = setup();

    const first = await save(t, ALICE, sampleBlueprint());
    expect(first).toMatchObject({ course_title: TITLE, version: 1, created_course: true });

    const second = await save(t, ALICE, sampleBlueprint(), { course_id: first.course_id });
    expect(second).toMatchObject({ course_id: first.course_id, version: 2, created_course: false });
  });

  it("存第二版換了標題，課程標題跟著改", async () => {
    const t = setup();
    const { course_id } = await save(t, ALICE, sampleBlueprint({ title: "舊標題" }));
    await save(t, ALICE, sampleBlueprint({ title: "新標題" }), { course_id });

    const list = data(await t.call("rpai_platform_list_courses", {}, { ownerId: ALICE }));
    expect(list.courses).toMatchObject([{ id: course_id, title: "新標題", latest_version: 2 }]);

    const read = data(await t.call("rpai_platform_get_blueprint", { course_id }, { ownerId: ALICE }));
    expect(read.course).toMatchObject({ id: course_id, title: "新標題" });
  });

  it.each([
    ["days", { ...sampleBlueprint(), days: [] }],
    ["title", { ...sampleBlueprint(), title: "" }],
  ])("藍圖的 %s 不合格式：回錯誤、指出欄位，而且什麼都不寫", async (field, blueprint) => {
    const t = setup();

    const result = await t.call("rpai_platform_save_blueprint", { blueprint }, { ownerId: ALICE });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(field);

    const list = data(await t.call("rpai_platform_list_courses", {}, { ownerId: ALICE }));
    expect(list).toEqual({ count: 0, courses: [] });
  });

  it("別的講師的 course_id：存回「找不到」，而且不寫入", async () => {
    const t = setup();
    const { course_id } = await save(t, ALICE, sampleBlueprint());

    const result = await t.call(
      "rpai_platform_save_blueprint",
      { course_id, blueprint: sampleBlueprint({ title: "Bob 想改的版本" }) },
      { ownerId: BOB },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("找不到");

    const alice = data(await t.call("rpai_platform_get_blueprint", { course_id }, { ownerId: ALICE }));
    expect(alice.versions).toHaveLength(1);
    expect(alice.course).toMatchObject({ title: TITLE });
  });
});
