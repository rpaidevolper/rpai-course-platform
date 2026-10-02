import { describe, expect, it } from "vitest";
import { CURRENT_INSTRUCTOR_ID, INSTRUCTORS, addPreference, editPreference, getInstructor, removePreference } from "./instructor";

describe("講師 fixture", () => {
  it("每位講師都帶有講師偏好", () => {
    expect(INSTRUCTORS.length).toBeGreaterThan(0);
    for (const i of INSTRUCTORS) expect(i.preferences.length).toBeGreaterThan(0);
  });

  it("目前登入的講師存在且有偏好", () => {
    expect(getInstructor(CURRENT_INSTRUCTOR_ID)?.preferences).toContainEqual(
      expect.objectContaining({ text: "不自動排休息" }),
    );
  });
});

const LIST = [
  { id: "pref-1", text: "不自動排休息" },
  { id: "pref-3", text: "單元不要切太細" },
];

describe("新增講師偏好", () => {
  it("去掉前後空白後加在最後，id 不和既有條目重複", () => {
    const next = addPreference(LIST, "  客戶版要放報價 ");
    expect(next).toHaveLength(3);
    expect(next[2].text).toBe("客戶版要放報價");
    expect(["pref-1", "pref-3"]).not.toContain(next[2].id);
    expect(next.slice(0, 2)).toEqual(LIST);
  });

  it("空白內容不新增", () => {
    expect(addPreference(LIST, "   ")).toEqual(LIST);
  });

  it("不改動傳入的清單", () => {
    addPreference(LIST, "新條目");
    expect(LIST).toHaveLength(2);
  });
});

describe("編輯講師偏好", () => {
  it("只改指定條目的內容，順序與 id 不變", () => {
    expect(editPreference(LIST, "pref-3", " 一個單元至少 30 分鐘 ")).toEqual([
      { id: "pref-1", text: "不自動排休息" },
      { id: "pref-3", text: "一個單元至少 30 分鐘" },
    ]);
  });

  it("改成空白不生效（要拿掉請用刪除）", () => {
    expect(editPreference(LIST, "pref-3", "  ")).toEqual(LIST);
  });

  it("找不到的 id 不生效", () => {
    expect(editPreference(LIST, "pref-9", "x")).toEqual(LIST);
  });
});

describe("刪除講師偏好", () => {
  it("拿掉指定條目，其他不變", () => {
    expect(removePreference(LIST, "pref-1")).toEqual([{ id: "pref-3", text: "單元不要切太細" }]);
  });

  it("找不到的 id 不生效", () => {
    expect(removePreference(LIST, "pref-9")).toEqual(LIST);
  });
});
