import {
  checkBlueprint,
  FIVE_ELEMENT_LABELS,
  FIVE_ELEMENTS,
  isLectureOnly,
  totalMinutes,
  type Blueprint,
  type BlueprintIssue,
} from "@/lib/blueprint/schema";
import { Badge } from "./ui";

type DurationIssue = Extract<BlueprintIssue, { kind: "duration_mismatch" }>;

/** 藍圖面板：單元依天、時段分組。 */
export function BlueprintPanel({ blueprint }: { blueprint: Blueprint }) {
  const issues = checkBlueprint(blueprint);
  const durationIssues = issues.filter((i): i is DurationIssue => i.kind === "duration_mismatch");
  const lectureOnlyCount = issues.filter((i) => i.kind === "lecture_only").length;

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

      {blueprint.openQuestions.length > 0 && (
        <section>
          <h4 className="text-xs font-bold tracking-wide text-body-muted">
            待確認（{blueprint.openQuestions.length}）
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {blueprint.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
