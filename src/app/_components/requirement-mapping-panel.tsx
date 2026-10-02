import type { CoverageStatus, PartialReason, RequirementMapping } from "@/lib/blueprint/requirement-mapping";
import type { Blueprint } from "@/lib/blueprint/schema";
import type { RequirementMappingRow } from "@/lib/mockup/logic";
import { Badge, CARD, Empty } from "./ui";

const STATUS: Record<CoverageStatus, { icon: string; label: string; tone: "success" | "warning" | "danger" }> = {
  covered: { icon: "✅", label: "已涵蓋", tone: "success" },
  partial: { icon: "⚠️", label: "", tone: "warning" },
  not_found: { icon: "❌", label: "字面上找不到", tone: "danger" },
};
const REASON_LABELS: Record<PartialReason, string> = { crammed: "擠在一起", short: "時間偏短" };

const statusLabel = (m: RequirementMapping) =>
  m.status === "partial" ? m.reasons.map((r) => REASON_LABELS[r]).join("、") : STATUS[m.status].label;

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function TimeChange({ m }: { m: RequirementMapping }) {
  if (m.requestedMinutes === null) {
    return <p className="text-sm">客戶沒指定時數・藍圖安排 {m.allocatedMinutes} 分</p>;
  }
  const delta = m.deltaMinutes!;
  return (
    <p className="text-sm">
      客戶要求 {m.requestedMinutes} 分 → 藍圖安排 {m.allocatedMinutes} 分
      <span className={`ml-1.5 font-bold ${delta < 0 ? "text-danger" : "text-navy"}`}>
        （{delta === 0 ? "剛好" : `${signed(delta)} 分`}）
      </span>
    </p>
  );
}

/** 需求對照：課程負責的每條需求條目，被藍圖涵蓋的狀態與時數變化。 */
export function RequirementMappingPanel({ rows, blueprint }: { rows: RequirementMappingRow[]; blueprint: Blueprint }) {
  if (rows.length === 0) return <Empty>這門課沒有負責任何需求條目。</Empty>;
  const textOf = (id: string) => rows.find((r) => r.requirement.id === id)?.requirement.text ?? id;

  return (
    <ul className="space-y-3">
      {rows.map(({ requirement, mapping: m, review }) => {
        const s = STATUS[m.status];
        return (
          <li key={requirement.id} className={`${CARD} p-5 ${m.status !== "covered" ? "border-l-[3px] border-navy" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h3 className="min-w-0 text-base font-bold text-navy">{requirement.text}</h3>
              <Badge tone={s.tone}>
                <span aria-hidden className="mr-1">{s.icon}</span>
                {statusLabel(m)}
              </Badge>
            </div>
            <div className="mt-2">
              <TimeChange m={m} />
            </div>
            {m.units.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {m.units.map((u) => (
                  <li key={`${u.day}-${u.slot}-${u.unit}`}>
                    第 {u.day} 天・{blueprint.days[u.day - 1]?.slots[u.slot - 1]?.label}・{u.title}（{u.minutes} 分
                    {u.sharedWith.length > 0 && `，與「${u.sharedWith.map(textOf).join("」「")}」共用，分到 ${u.sharedMinutes} 分`}）
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-body-muted">沒有任何單元提到「{requirement.keywords.join("」「") || requirement.text}」。</p>
            )}
            {review && (
              <p className="mt-3 rounded-md bg-iced px-3 py-2 text-sm">
                <span className="font-bold text-navy">實質涵蓋：{review.substantive ? "有" : "沒有"}</span>
                <span className="text-body-muted">（設計稿標註，之後由 AI 判斷）</span>
                <br />
                {review.note}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
