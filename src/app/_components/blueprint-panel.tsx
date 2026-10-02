import { clientEmailText, openItems, unitPlace, type OpenItem } from "@/lib/blueprint/open-items";
import {
  checkBlueprint,
  FIVE_ELEMENT_LABELS,
  FIVE_ELEMENTS,
  isLectureOnly,
  TOOL_PLAN_LABELS,
  totalMinutes,
  type Blueprint,
  type BlueprintIssue,
} from "@/lib/blueprint/schema";
import { CopyButton } from "./copy-button";
import { Badge } from "./ui";

type DurationIssue = Extract<BlueprintIssue, { kind: "duration_mismatch" }>;

/** 藍圖面板：單元依天、時段分組。 */
export function BlueprintPanel({ blueprint }: { blueprint: Blueprint }) {
  const issues = checkBlueprint(blueprint);
  const durationIssues = issues.filter((i): i is DurationIssue => i.kind === "duration_mismatch");
  const lectureOnlyCount = issues.filter((i) => i.kind === "lecture_only").length;
  const items = openItems(blueprint);
  const clientItems = items.filter((i) => i.audience === "client");
  const selfItems = items.filter((i) => i.audience === "self");
  const emailText = clientEmailText(blueprint);

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-lg font-bold text-navy">{blueprint.title}</h3>
        <p className="mt-1 text-sm">{blueprint.oneLiner}</p>
      </header>

      <section>
        <h4 className="text-xs font-bold tracking-wide text-body-muted">受眾</h4>
        <p className="mt-1 text-sm">
          {blueprint.audience.who}
          {blueprint.audience.size ? `（約 ${blueprint.audience.size} 人）` : ""}
        </p>
      </section>

      <section>
        <h4 className="text-xs font-bold tracking-wide text-body-muted">
          學習成果
        </h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {blueprint.outcomes.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="text-xs font-bold tracking-wide text-body-muted">五元素</h4>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {FIVE_ELEMENTS.map((key) => {
            const items = blueprint.elements[key];
            const missing = items.length === 0;
            return (
              <li
                key={key}
                className={`rounded-md p-3 text-sm ${missing ? "bg-warning-tint" : "bg-iced"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy">
                    {FIVE_ELEMENT_LABELS[key]}
                  </span>
                  {missing && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-warning">
                      缺
                    </span>
                  )}
                </div>
                <p className="mt-1">
                  {missing ? "還沒有內容，需要跟講師補" : items.join("；")}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-xs font-bold tracking-wide text-body-muted">單元</h4>
          <span className="text-xs">
            {blueprint.days.length} 天，共 {totalMinutes(blueprint)} 分鐘
          </span>
        </div>
        {lectureOnlyCount > 0 && (
          <p className="mt-1 text-xs">
            有 {lectureOnlyCount} 個純講述單元（沒有動手環節），看看要不要補互動。
          </p>
        )}
        <ol className="mt-3 space-y-5">
          {blueprint.days.map((day, di) => (
            <li key={di}>
              <h5 className="text-sm font-bold text-navy">
                第 {di + 1} 天<span className="font-normal">・{day.theme}</span>
              </h5>
              <ol className="mt-2 space-y-3">
                {day.slots.map((slot, si) => {
                  const mismatch = durationIssues.find((i) => i.day === di + 1 && i.slot === si + 1);
                  return (
                    <li key={si} className="rounded-md border-2 border-iced p-3">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-bold text-navy">{slot.label}</span>
                        <span>{slot.minutes} 分鐘</span>
                      </div>
                      {mismatch && (
                        <p className="mt-1 text-xs font-bold text-warning">
                          單元加總 {mismatch.planned} 分鐘，與時段長度差{" "}
                          {Math.abs(mismatch.planned - mismatch.expected)} 分鐘
                        </p>
                      )}
                      <ol className="mt-2 space-y-2">
                        {slot.units.map((u) => (
                          <li key={u.title} className="rounded-md bg-iced p-3 text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="flex flex-wrap items-center gap-2 font-bold text-navy">
                                {u.title}
                                {isLectureOnly(u) && <Badge tone="warning">純講述</Badge>}
                              </span>
                              <span className="shrink-0 text-xs">{u.minutes} 分</span>
                            </div>
                            <p className="mt-1">{u.objective}</p>
                            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                              <dt className="font-bold">教學方式</dt>
                              <dd>{u.method}</dd>
                              <dt className="font-bold">成果</dt>
                              <dd>{u.outcome}</dd>
                              {u.carriesFrom && (
                                <>
                                  <dt className="font-bold">承接自</dt>
                                  <dd>{u.carriesFrom}</dd>
                                </>
                              )}
                            </dl>
                            <UnitClientItems items={clientItems.filter((i) => i.unit === u.title)} />
                          </li>
                        ))}
                      </ol>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h4 className="text-xs font-bold tracking-wide text-body-muted">工具</h4>
        {blueprint.tools.length === 0 ? (
          <p className="mt-1 text-sm">還沒列出學員要用的工具。</p>
        ) : (
          <ul className="mt-2 divide-y-2 divide-iced text-sm">
            {blueprint.tools.map((t) => (
              <li key={t.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-bold text-navy">
                  {t.name}
                  <span className="ml-2 font-normal text-body">{TOOL_PLAN_LABELS[t.plan]}</span>
                </span>
                {t.confirmedWithClient ? (
                  <Badge tone="success">已跟客戶確認</Badge>
                ) : (
                  <Badge tone="warning">還沒跟客戶確認</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-xs font-bold tracking-wide text-body-muted">待確認事項（{items.length}）</h4>
        {items.length === 0 ? (
          <p className="mt-1 text-sm">沒有待確認事項。</p>
        ) : (
          <div className="mt-2 space-y-4">
            <div>
              <h5 className="text-sm font-bold text-navy">問客戶（{clientItems.length}）</h5>
              {clientItems.length === 0 ? (
                <p className="mt-1 text-sm">沒有要問客戶的事。</p>
              ) : (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {clientItems.map((i) => (
                    <li key={i.text}>
                      {i.text}
                      {i.unit && <span className="text-body-muted">（影響{unitPlace(blueprint, i.unit)}）</span>}
                    </li>
                  ))}
                </ul>
              )}
              {emailText && (
                <div className="mt-3 rounded-md border-2 border-iced p-3">
                  <CopyButton text={emailText}>複製給客戶</CopyButton>
                  <p className="mt-2 text-xs text-body-muted">平台不代寄，複製後貼進你自己的信件。</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">{emailText}</pre>
                </div>
              )}
            </div>
            <div>
              <h5 className="text-sm font-bold text-navy">自己決定（{selfItems.length}）</h5>
              {selfItems.length === 0 ? (
                <p className="mt-1 text-sm">沒有要自己決定的事。</p>
              ) : (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {selfItems.map((i) => (
                    <li key={i.text}>
                      {i.text}
                      {i.unit && <span className="text-body-muted">（影響{unitPlace(blueprint, i.unit)}）</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** 掛在單元上的問客戶事項。 */
function UnitClientItems({ items }: { items: OpenItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((i) => (
        <li key={i.text} className="flex flex-wrap items-start gap-2 rounded-md bg-white p-2 text-xs">
          <Badge tone="outline">問客戶</Badge>
          <span className="min-w-0 flex-1 break-words">{i.text}</span>
        </li>
      ))}
    </ul>
  );
}
