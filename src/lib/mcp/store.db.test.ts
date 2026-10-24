import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbFixture, type TestCourse } from "@/test/db";
import { createSupabaseJobStore, type JobStore } from "./store";

// MCP 這條路：service role 繞過 RLS，store 自己以工作區過濾（#87）。
const db = dbFixture();
let store: JobStore;
let wsA: string;
let wsB: string;
let courseA: TestCourse;
let courseB: TestCourse;

async function statusOf(artifactId: string): Promise<string> {
  const { data } = await db.admin.from("artifacts").select("status").eq("id", artifactId).single();
  return data!.status as string;
}

beforeAll(async () => {
  store = createSupabaseJobStore();
  wsA = await db.workspace("store-A");
  wsB = await db.workspace("store-B");
  const a2 = await db.user("a2", wsA);
  const b1 = await db.user("b1", wsB);
  courseA = await db.course(a2.id, "A 工作區另一位講師的課");
  courseB = await db.course(b1.id, "B 工作區的課");
});

afterAll(() => db.cleanup());

describe("JobStore 以工作區過濾", () => {
  it("列得到同工作區其他講師的課程，列不到別的工作區的", async () => {
    const ids = (await store.listCourses(wsA)).map((c) => c.id);
    expect(ids).toContain(courseA.courseId);
    expect(ids).not.toContain(courseB.courseId);
  });

  it("讀不到別的工作區的藍圖", async () => {
    expect(await store.getBlueprint(wsA, courseA.courseId)).toMatchObject({ version: 1 });
    expect(await store.getBlueprint(wsA, courseB.courseId)).toBeNull();
  });

  it("待生成的工作只列同工作區的", async () => {
    const ids = (await store.listPendingJobs(wsA)).map((j) => j.id);
    expect(ids).toContain(courseA.artifactId);
    expect(ids).not.toContain(courseB.artifactId);
  });

  it("認領不了別的工作區的工作，工作維持 pending", async () => {
    expect(await store.claimJob(wsA, courseB.artifactId, "A 的電腦")).toBeNull();
    expect(await statusOf(courseB.artifactId)).toBe("pending");
    expect(await store.failJob(wsA, courseB.artifactId, "不該改得到")).toBe(false);
    expect(await statusOf(courseB.artifactId)).toBe("pending");
  });

  it("認領得到同工作區其他講師排的工作，上傳路徑以工作區開頭", async () => {
    const job = await store.claimJob(wsA, courseA.artifactId, "A 的電腦");
    expect(job).toMatchObject({ id: courseA.artifactId, course: { id: courseA.courseId } });
    expect(await statusOf(courseA.artifactId)).toBe("generating");

    const upload = await store.createUploadUrl(wsA, courseA.artifactId, "簡報.pptx");
    expect(upload!.storagePath).toBe(`${wsA}/${courseA.courseId}/${courseA.artifactId}/簡報.pptx`);
  });
});
