/**
 * 模組目錄：模組的代號、類別與名稱，全專案唯一一份。
 * 藍圖 schema（單元的 module 欄位）與設計稿（知識庫、組課）都從這裡取用；依賴方向是設計稿 → 藍圖，不能反過來。
 * A 類是學員課堂上打開的環境，彼此互斥；B 類是不綁工具的方法，可以疊加。
 */
export const MODULES = [
  { id: "A1", kind: "A", label: "通用生成 AI" },
  { id: "A2", kind: "A", label: "知識庫與檢索" },
  { id: "A3", kind: "A", label: "桌面自動化" },
  { id: "A4", kind: "A", label: "雲端自動化" },
  { id: "A5", kind: "A", label: "Agent 與 AI 編碼" },
  { id: "B1", kind: "B", label: "流程診斷" },
  { id: "B2", kind: "B", label: "提問與指令" },
  { id: "B3", kind: "B", label: "AI 治理與風險" },
  { id: "B4", kind: "B", label: "AI 成本節費" },
] as const;
export type ModuleId = (typeof MODULES)[number]["id"];
export type ModuleKind = (typeof MODULES)[number]["kind"];

/** 模組代號清單，給 z.enum 用（zodOutputFormat 不吃 optional／default，所以是純 enum）。 */
export const MODULE_IDS = MODULES.map((m) => m.id) as [ModuleId, ...ModuleId[]];

/** 模組的定義：代號、類別（A 或 B）與名稱。 */
export const getModule = (id: ModuleId) => MODULES.find((m) => m.id === id)!;

/** 模組的顯示名稱，例如「A1 通用生成 AI」。 */
export function moduleLabel(id: ModuleId): string {
  const m = getModule(id);
  return `${m.id} ${m.label}`;
}
