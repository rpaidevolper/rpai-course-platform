import type { Blueprint, Unit } from "./schema";

/**
 * 需求對照：一門課程的藍圖逐條比對它負責的需求條目。
 *
 * 這裡只算「字面」與「時數」，不判斷內容是否實質涵蓋（那是之後交給 AI 的事）。
 *
 * 規則：
 * - 字面比對：需求條目的每一個關鍵詞都出現在同一個單元的文字裡，該單元就算命中。
 *   單元文字 = 標題、學習目標、成果、重點、動手環節；不看天的主軸、受眾痛點等藍圖其他欄位，
 *   因為時數只能從單元算。比對前兩邊都做 NFKC 正規化、轉小寫、去掉空白（「８Ｄ」= 8D、project = Project）。
 *   沒有關鍵詞的條目，以整句原文當成唯一關鍵詞。
 * - 時數：命中單元的分鐘數加總；一個單元同時命中多條需求時，分鐘數平均分給這幾條（四捨五入），
 *   讓「擠在一起」稀釋的時間反映在時數變化上。
 * - 狀態：沒有命中 → not_found（❌）；命中但與其他條目擠在同一單元，或分到的時數少於客戶要求 → partial（⚠️）；
 *   其餘 → covered（✅）。客戶沒指定時數的條目不檢查偏短，時數變化為 null。
 */

/** 需求對照需要的需求條目欄位（結構化型別，不綁設計稿的型別）。 */
export interface MappableRequirement {
  id: string;
  text: string;
  /** 用來字面比對的關鍵詞；全部出現在同一單元才算命中 */
  keywords: string[];
  /** 客戶要求的分鐘數；沒指定則為 null */
  minutes: number | null;
}

export type CoverageStatus = "covered" | "partial" | "not_found";
export type PartialReason = "crammed" | "short";

/** 命中單元的位置，天與時段從 1 起算，unit 是時段裡第幾個單元（從 1 起算）。 */
export interface MatchedUnit {
  day: number;
  slot: number;
  unit: number;
  title: string;
  /** 單元本身的分鐘數 */
  minutes: number;
  /** 這條需求分到的分鐘數（與其他條目共用時平均分攤） */
  sharedMinutes: number;
  /** 同一單元還命中了哪些其他需求條目 */
  sharedWith: string[];
}

export interface RequirementMapping {
  requirementId: string;
  status: CoverageStatus;
  /** 只有 partial 才有內容 */
  reasons: PartialReason[];
  units: MatchedUnit[];
  requestedMinutes: number | null;
  allocatedMinutes: number;
  /** 藍圖安排減客戶要求；客戶沒指定時數則為 null */
  deltaMinutes: number | null;
}

const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

const unitText = (u: Unit) =>
  normalize([u.title, u.objective, u.outcome, ...u.keyPoints, u.activity ?? ""].join("\n"));

function matches(text: string, r: MappableRequirement): boolean {
  const keywords = (r.keywords.length > 0 ? r.keywords : [r.text]).map(normalize).filter((k) => k !== "");
  return keywords.length > 0 && keywords.every((k) => text.includes(k));
}

export function mapRequirements(bp: Blueprint, requirements: MappableRequirement[]): RequirementMapping[] {
  const units = bp.days.flatMap((d, di) =>
    d.slots.flatMap((s, si) =>
      s.units.map((u, ui) => {
        const text = unitText(u);
        return {
          day: di + 1,
          slot: si + 1,
          unit: ui + 1,
          title: u.title,
          minutes: u.minutes,
          hits: requirements.filter((r) => matches(text, r)).map((r) => r.id),
        };
      }),
    ),
  );

  return requirements.map((r) => {
    const matched: MatchedUnit[] = units
      .filter((u) => u.hits.includes(r.id))
      .map(({ hits, ...u }) => ({
        ...u,
        sharedMinutes: Math.round(u.minutes / hits.length),
        sharedWith: hits.filter((id) => id !== r.id),
      }));
    const allocatedMinutes = matched.reduce((sum, u) => sum + u.sharedMinutes, 0);
    const deltaMinutes = r.minutes === null ? null : allocatedMinutes - r.minutes;

    const reasons: PartialReason[] = [];
    if (matched.some((u) => u.sharedWith.length > 0)) reasons.push("crammed");
    if (matched.length > 0 && deltaMinutes !== null && deltaMinutes < 0) reasons.push("short");

    const status: CoverageStatus = matched.length === 0 ? "not_found" : reasons.length > 0 ? "partial" : "covered";
    return {
      requirementId: r.id,
      status,
      reasons: status === "partial" ? reasons : [],
      units: matched,
      requestedMinutes: r.minutes,
      allocatedMinutes,
      deltaMinutes,
    };
  });
}
