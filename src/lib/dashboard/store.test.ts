import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDashboardStore } from "./store";

/** 假的 Supabase client：一被呼叫就丟錯，所以只要送出查詢，測試就會失敗。 */
const { from } = vi.hoisted(() => ({
  from: vi.fn((): never => {
    throw new Error("不該送查詢");
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

const VALID_ID = "11111111-1111-4111-8111-111111111111";

describe("不合法的 id 不送進資料庫", () => {
  beforeEach(() => {
    from.mockClear();
  });

  it("getCourse 與 getArtifact 直接回 null，一次查詢都沒有", async () => {
    const store = createSupabaseDashboardStore();

    await expect(store.getCourse("not-a-uuid")).resolves.toBeNull();
    await expect(store.getCourse("")).resolves.toBeNull();
    await expect(store.getArtifact("1 or 1=1")).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("合法的 uuid 才會送查詢（用會丟錯的假 client 確認確實有送出）", async () => {
    const store = createSupabaseDashboardStore();

    await expect(store.getCourse(VALID_ID)).rejects.toThrow("不該送查詢");
    await expect(store.getArtifact(VALID_ID)).rejects.toThrow("不該送查詢");
    expect(from).toHaveBeenCalledWith("courses");
    expect(from).toHaveBeenCalledWith("artifacts");
  });
});
