import { describe, expect, it } from "vitest";
import { sampleBlueprint } from "@/lib/blueprint/testing";
import type { BlueprintRecord, CourseStore } from "../course-store";
import { registerCourseTools } from "./courses";
import { createTestServer } from "./testing";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const COURSE = "11111111-1111-4111-8111-111111111111";

/** 記憶體裡的 CourseStore：Alice 有一門課、一版藍圖。 */
function memoryStore(): CourseStore {
  const courses = [{ id: COURSE, owner_id: ALICE, title: "週報課", updated_at: "2026-10-25T00:00:00.000Z" }];
  const blueprint: BlueprintRecord = {
    id: "22222222-2222-4222-8222-222222222222",
    version: 1,
    content: sampleBlueprint(),
    change_note: null,
    created_at: "2026-10-25T00:00:00.000Z",
  };
  const owns = (ownerId: string, courseId: string) =>
    courses.some((c) => c.id === courseId && c.owner_id === ownerId);

  return {
    async listCourses(ownerId) {
      return courses
        .filter((c) => c.owner_id === ownerId)
        .map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at }));
    },
    async getBlueprint(ownerId, courseId, version) {
      if (!owns(ownerId, courseId)) return null;
      return version === undefined || version === blueprint.version ? blueprint : null;
    },
  };
}

function setup() {
  const t = createTestServer();
  registerCourseTools(t.server, memoryStore());
  return t;
}

describe("rpai_platform_list_courses", () => {
  it("只列出權杖那位講師的課程", async () => {
    const t = setup();

    const alice = await t.call("rpai_platform_list_courses", {}, { ownerId: ALICE });
    expect(alice.structuredContent).toMatchObject({ count: 1, courses: [{ id: COURSE, title: "週報課" }] });

    const bob = await t.call("rpai_platform_list_courses", {}, { ownerId: BOB });
    expect(bob.structuredContent).toEqual({ count: 0, courses: [] });
  });
});

describe("rpai_platform_get_blueprint", () => {
  it("別的講師的課回「找不到」", async () => {
    const result = await setup().call("rpai_platform_get_blueprint", { course_id: COURSE }, { ownerId: BOB });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("找不到");
  });

  it("course_id 不是 uuid 時不進 handler，錯誤指出欄位", async () => {
    const result = await setup().call("rpai_platform_get_blueprint", { course_id: "週報課" }, { ownerId: ALICE });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("course_id");
  });
});
