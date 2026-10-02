/**
 * 設計稿（#29）：講師與講師偏好。名詞依 GLOSSARY.md。
 *
 * 講師偏好是一位講師自己的排課與製作習慣，和 RPAI 全公司共用的品牌規範分開；
 * 每位講師一份，帶入每次藍圖對話與每個產檔工作。
 * 這不是資料庫 schema，名稱全部虛構。
 */

export interface InstructorPreference {
  id: string;
  text: string;
}

export interface Instructor {
  id: string;
  name: string;
  preferences: InstructorPreference[];
}

export const INSTRUCTORS: Instructor[] = [
  {
    id: "inst-lin",
    name: "林予晴",
    preferences: [
      { id: "pref-1", text: "簡報字級至少 16pt，全文粗體" },
      { id: "pref-2", text: "單元不要切太細，一個單元至少 30 分鐘" },
      { id: "pref-3", text: "不自動排休息" },
      { id: "pref-4", text: "客戶版課程大綱要放報價" },
    ],
  },
  {
    id: "inst-chou",
    name: "周明遠",
    preferences: [{ id: "pref-1", text: "每個單元結尾留 5 分鐘問答" }],
  },
];

/** 設計稿裡「目前登入的講師」。 */
export const CURRENT_INSTRUCTOR_ID = "inst-lin";

export function getInstructor(id: string): Instructor | undefined {
  return INSTRUCTORS.find((i) => i.id === id);
}

/** 下一個不和既有條目重複的 id（pref-N，N 取目前最大值 + 1）。 */
function nextPreferenceId(list: InstructorPreference[]): string {
  const max = list.reduce((m, p) => {
    const n = Number(p.id.match(/^pref-(\d+)$/)?.[1] ?? 0);
    return Math.max(m, n);
  }, 0);
  return `pref-${max + 1}`;
}

/** 新增一條講師偏好；去掉前後空白後是空字串就不新增。 */
export function addPreference(list: InstructorPreference[], text: string): InstructorPreference[] {
  const trimmed = text.trim();
  if (!trimmed) return list;
  return [...list, { id: nextPreferenceId(list), text: trimmed }];
}

/** 改寫一條講師偏好；改成空白不生效（要拿掉請用刪除）。 */
export function editPreference(list: InstructorPreference[], id: string, text: string): InstructorPreference[] {
  const trimmed = text.trim();
  if (!trimmed || !list.some((p) => p.id === id)) return list;
  return list.map((p) => (p.id === id ? { ...p, text: trimmed } : p));
}

/** 刪除一條講師偏好。 */
export function removePreference(list: InstructorPreference[], id: string): InstructorPreference[] {
  return list.filter((p) => p.id !== id);
}
