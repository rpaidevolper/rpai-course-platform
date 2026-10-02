import Link from "next/link";
import { readinessGroups, readinessText, type ReadinessItem, type ReadinessSource } from "@/lib/mockup/logic";
import type { Session } from "@/lib/mockup/types";

/**
 * 每一組缺項要去哪裡處理：藍圖缺口（待確認事項、缺的五元素、時數、要改的單元）都是跟 AI 談藍圖補，直接去對話；
 * 需求對照、產物在課程頁；場次安排與發布在場次頁。
 */
function sourceHref(source: ReadinessSource, session: Session): string {
  const course = `/courses/${session.courseId}`;
  switch (source) {
    case "blueprint":
      return `${course}/chat`;
    case "requirements":
      return `${course}#requirement-mapping`;
    case "artifacts":
      return `${course}#artifacts`;
    case "session":
      return `/sessions/${session.id}#info`;
    case "publication":
      return `/sessions/${session.id}#publish`;
  }
}

/** 需求對照缺口逐條列出：❌ 在前、⚠️ 在後。 */
function RequirementGapDetail({ item }: { item: Extract<ReadinessItem, { kind: "requirement_gaps" }> }) {
  const rows = [
    ...item.notFound.map((text) => ({ text, icon: "❌", label: "找不到" })),
    ...item.partial.map((text) => ({ text, icon: "⚠️", label: "部分涵蓋" })),
  ];
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {rows.map((r) => (
        <li key={r.text} className="flex gap-1.5">
          <span aria-label={r.label}>{r.icon}</span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 場次準備度：依來源分組（藍圖、需求對照、產物、場次安排、給學員的東西），每組附「去處理」連結。
 * detailed 時逐條列出需求對照缺口（場次頁用）；首頁只列一行摘要，保持好掃。
 */
export function ReadinessList({
  session,
  items,
  detailed = false,
}: {
  session: Session;
  items: ReadinessItem[];
  detailed?: boolean;
}) {
  return (
    <div className="space-y-3 text-sm">
      {readinessGroups(items).map((group) => (
        <section key={group.source} aria-label={`準備度：${group.label}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-bold text-body-muted">
              {group.label}
              <span className="ml-1.5 font-normal">{group.items.length} 件</span>
            </h3>
            <Link
              href={sourceHref(group.source, session)}
              className="shrink-0 text-xs font-bold text-navy underline-offset-2 hover:underline"
            >
              去處理<span className="sr-only">{group.label}</span>
            </Link>
          </div>
          <ul className="mt-1 space-y-1.5">
            {group.items.map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-warning" />
                <div className="min-w-0">
                  <span>{readinessText(item)}</span>
                  {/* 素材屬於課程，在課程頁上傳；其餘「給學員的東西」在場次頁處理 */}
                  {item.kind === "no_materials" && (
                    <>
                      {" "}
                      <Link
                        href={`/courses/${session.courseId}#materials`}
                        className="text-xs font-bold text-navy underline underline-offset-2"
                      >
                        到課程頁上傳
                      </Link>
                    </>
                  )}
                  {detailed && item.kind === "requirement_gaps" && <RequirementGapDetail item={item} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
