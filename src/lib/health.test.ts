import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("資料庫查得到時回 200 與 ok", async () => {
    const result = await checkHealth(async () => {}, "abc123");
    expect(result).toEqual({
      httpStatus: 200,
      body: { status: "ok", database: "ok", commit: "abc123" },
    });
  });

  it("資料庫查詢丟錯時回 503，且不洩漏錯誤內容", async () => {
    const result = await checkHealth(async () => {
      throw new Error("password authentication failed for user postgres");
    }, null);
    expect(result.httpStatus).toBe(503);
    expect(result.body).toEqual({ status: "error", database: "error", commit: null });
    expect(JSON.stringify(result)).not.toContain("password");
  });
});
