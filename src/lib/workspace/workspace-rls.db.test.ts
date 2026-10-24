import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, dbFixture, PROTECTED_TABLES, type TestCourse, type TestUser } from "@/test/db";

// 頁面這條路：講師用自己的 JWT 查資料，RLS 以工作區過濾（ADR 0004、#87）。
const db = dbFixture();
let wsA: string;
let wsB: string;
let a1: TestUser;
let a2: TestUser;
let b1: TestUser;
let outsider: TestUser;
let courseA: TestCourse;
let courseB: TestCourse;

/** 課程與子表各自要查的 id。 */
function rowsOf(course: TestCourse) {
  return [
    ["courses", course.courseId],
    ["blueprints", course.blueprintId],
    ["conversations", course.conversationId],
    ["messages", course.messageId],
    ["artifacts", course.artifactId],
  ] as const;
}

async function ids(user: TestUser, table: string): Promise<string[]> {
  const { data, error } = await user.client.from(table).select("id");
  if (error) throw error;
  return data.map((row) => row.id as string);
}

beforeAll(async () => {
  wsA = await db.workspace("A");
  wsB = await db.workspace("B");
  a1 = await db.user("a1", wsA);
  a2 = await db.user("a2", wsA);
  b1 = await db.user("b1", wsB);
  outsider = await db.user("outsider");
  courseA = await db.course(a2.id, "A 工作區的課");
  courseB = await db.course(b1.id, "B 工作區的課");
  const { error } = await db.admin.from("api_tokens").insert(
    [a2, b1, outsider].map((u) => ({
      owner_id: u.id,
      label: "測試",
      token_hash: randomUUID(),
      token_prefix: "rcp_test",
    })),
  );
  if (error) throw error;
});

afterAll(() => db.cleanup());

describe("工作區成員", () => {
  it("讀得到同工作區其他講師的課程與子表，讀不到別的工作區的", async () => {
    for (const [table, id] of rowsOf(courseA)) {
      expect(await ids(a1, table), table).toContain(id);
    }
    for (const [table, id] of rowsOf(courseB)) {
      expect(await ids(a1, table), table).not.toContain(id);
    }
  });

  it("course_latest_blueprint 只回同工作區的藍圖", async () => {
    const { data, error } = await a1.client.from("course_latest_blueprint").select("course_id");
    expect(error).toBeNull();
    const courses = data!.map((row) => row.course_id);
    expect(courses).toContain(courseA.courseId);
    expect(courses).not.toContain(courseB.courseId);
  });

  it("可以修改同工作區其他講師的課程", async () => {
    const { data, error } = await a1.client
      .from("courses")
      .update({ title: "a1 改過的標題" })
      .eq("id", courseA.courseId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("改不到別的工作區的課程", async () => {
    const { data, error } = await a1.client
      .from("courses")
      .update({ title: "偷改" })
      .eq("id", courseB.courseId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("建課不帶 workspace_id 時，補上自己的工作區", async () => {
    const { data, error } = await a1.client
      .from("courses")
      .insert({ owner_id: a1.id, title: "a1 自己建的課" })
      .select("workspace_id")
      .single();
    expect(error).toBeNull();
    expect(data!.workspace_id).toBe(wsA);
  });

  it("不能把課程建到或搬到別的工作區", async () => {
    const insert = await a1.client.from("courses").insert({ owner_id: a1.id, title: "越界", workspace_id: wsB });
    expect(insert.error?.code).toBe("42501");

    const move = await a1.client.from("courses").update({ workspace_id: wsB }).eq("id", courseA.courseId);
    expect(move.error?.code).toBe("42501");
  });

  it("看得到自己工作區與它的成員，看不到別的工作區", async () => {
    expect(await ids(a1, "workspaces")).toEqual([wsA]);

    const { data, error } = await a1.client.from("workspace_members").select("user_id");
    expect(error).toBeNull();
    expect(data!.map((row) => row.user_id).sort()).toEqual([a1.id, a2.id].sort());
  });

  it("只看得到自己的權杖，同工作區的也看不到", async () => {
    expect(await ids(a1, "api_tokens")).toEqual([]);
    expect(await ids(a2, "api_tokens")).toHaveLength(1);
  });
});

describe("已登入、但不是工作區成員", () => {
  it("每一張表都讀不到任何資料", async () => {
    for (const table of PROTECTED_TABLES) {
      if (table === "api_tokens") continue; // 自己的權杖例外，下一個測試
      const { data, error } = await outsider.client.from(table).select("*");
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("只看得到自己的權杖", async () => {
    const { data } = await outsider.client.from("api_tokens").select("owner_id");
    expect(data!.map((row) => row.owner_id)).toEqual([outsider.id]);
  });

  it("不能建課", async () => {
    const { error } = await outsider.client.from("courses").insert({ owner_id: outsider.id, title: "外人的課" });
    expect(error).not.toBeNull();
  });
});

describe("沒登入的訪客（anon）", () => {
  it("每一張表都讀不到任何資料", async () => {
    const anon = anonClient();
    for (const table of PROTECTED_TABLES) {
      const { data, error } = await anon.from(table).select("*");
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });
});

describe("courses 的 workspace_id trigger（部署空窗裡的舊程式不帶 workspace_id）", () => {
  it("用 service role 建課時，依建立者的成員資格補上", async () => {
    const { data } = await db.admin.from("courses").select("workspace_id").eq("id", courseB.courseId).single();
    expect(data!.workspace_id).toBe(wsB);
  });

  it("建立者不是任何工作區的成員時拒絕", async () => {
    const { error } = await db.admin.from("courses").insert({ owner_id: outsider.id, title: "沒有工作區的課" });
    expect(error?.message).toContain("不屬於恰好一個工作區");
  });
});
