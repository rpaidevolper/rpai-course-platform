import {
  checkBlueprint,
  FIVE_ELEMENT_LABELS,
  FIVE_ELEMENTS,
  type Blueprint,
} from "@/lib/blueprint/schema";

export function BlueprintPanel({ blueprint }: { blueprint: Blueprint }) {
  const issues = checkBlueprint(blueprint);
  const durationIssue = issues.find((i) => i.kind === "duration_mismatch");

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
        <div className="flex items-baseline justify-between">
          <h4 className="text-xs font-bold tracking-wide text-body-muted">單元</h4>
          <span className="text-xs">
            共 {blueprint.format.durationMinutes} 分鐘
          </span>
        </div>
        {durationIssue && (
          <p className="mt-1 text-xs font-bold text-warning">
            單元加總 {durationIssue.planned} 分鐘，與課程長度差{" "}
            {Math.abs(durationIssue.planned - durationIssue.expected)} 分鐘
          </p>
        )}
        <ol className="mt-2 space-y-2">
          {blueprint.modules.map((m, i) => (
            <li key={m.title} className="rounded-md bg-iced p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-navy">
                  {i + 1}. {m.title}
                </span>
                <span className="shrink-0 text-xs">{m.minutes} 分</span>
              </div>
              <p className="mt-1">{m.objective}</p>
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
