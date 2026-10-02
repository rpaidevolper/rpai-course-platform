export type HealthResult = {
  httpStatus: 200 | 503;
  body: {
    status: "ok" | "error";
    database: "ok" | "error";
    commit: string | null;
  };
};

/**
 * 部署後 smoke test 與平台健康檢查用。
 * probe 丟錯就視為資料庫不通；錯誤內容不回傳，避免洩漏連線資訊。
 */
export async function checkHealth(
  probe: () => Promise<void>,
  commit: string | null,
): Promise<HealthResult> {
  try {
    await probe();
    return { httpStatus: 200, body: { status: "ok", database: "ok", commit } };
  } catch {
    return { httpStatus: 503, body: { status: "error", database: "error", commit } };
  }
}
