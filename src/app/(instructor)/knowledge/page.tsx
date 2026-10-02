import Link from "next/link";
import { COURSES, SCENARIOS } from "@/lib/mockup/data";
import { TOPICS, type Framework, type KnowledgeDraft } from "@/lib/mockup/types";
import {
  formatDate,
  frameworksOfTopic,
  getCourse,
  getFramework,
  latestFrameworkVersion,
  pendingDrafts,
} from "@/lib/mockup/logic";
import { Badge, Card, CARD, Empty, FieldLabel, MockAction, PageHeader, SectionTitle } from "../../_components/ui";

const TRIGGER_TEXT: Record<KnowledgeDraft["trigger"], string> = {
  auto: "課程結束後自動產生",
  manual: "講師手動",
  import: "匯入過往講義",
};

/** 知識庫：待審核草稿 > 框架（依主題分組） > 情境。 */
export default function KnowledgePage() {
  const drafts = pendingDrafts();

  return (
    <>
      <PageHeader
        title="知識庫"
        description="從過去的課整理出來、你確認過的框架與情境。新課程的藍圖從這裡複製內容出生，之後框架改版不會動到已經存在的藍圖。"
      >
        <MockAction variant="secondary">匯入過往講義</MockAction>
      </PageHeader>

      <section aria-labelledby="drafts-title" className="mb-12">
        <SectionTitle aside="確認後才會收進知識庫">
          <span id="drafts-title">待審核草稿（{drafts.length}）</span>
        </SectionTitle>
        {drafts.length === 0 ? (
          <Empty>目前沒有草稿。課程最後一個場次結束後，AI 會自動拆出新的草稿。</Empty>
        ) : (
          <ul className="space-y-4">
            {drafts.map((d) => (
              <li key={d.id}>
                <DraftCard draft={d} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="frameworks-title" className="mb-12">
        <SectionTitle aside="直接編輯框架會升一版">
          <span id="frameworks-title">框架</span>
        </SectionTitle>
        <p className="mb-5 max-w-2xl text-sm">
          開新課程時，AI 會依專案的客戶背景，從這裡推薦框架與情境。
        </p>

        <nav aria-label="跳到主題" className="mb-6 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <a key={t.id} href={`#topic-${t.id}`} className="rounded-md bg-navy-tint px-3 py-1.5 text-sm font-bold text-navy hover:bg-iced">
              {t.label}（{frameworksOfTopic(t.id).length}）
            </a>
          ))}
        </nav>

        <div className="space-y-10">
          {TOPICS.map((t) => {
            const list = frameworksOfTopic(t.id);
            return (
              <section key={t.id} id={`topic-${t.id}`} aria-labelledby={`topic-title-${t.id}`} className="scroll-mt-6">
                <h3 id={`topic-title-${t.id}`} className="mb-3 text-lg font-bold text-navy">
                  {t.label}
                </h3>
                {list.length === 0 ? (
                  <Empty>這個主題還沒有框架。上完這類課程、審核通過草稿後，會出現在這裡。</Empty>
                ) : (
                  <ul className="space-y-4">
                    {list.map((f) => (
                      <li key={f.id}>
                        <FrameworkCard framework={f} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="scenarios-title">
        <SectionTitle aside="一份藍圖只套用一個情境">
          <span id="scenarios-title">情境</span>
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-2">
          {SCENARIOS.map((s) => (
            <li key={s.id} id={s.id} className="scroll-mt-6">
              <Card className="h-full">
                <h3 className="text-base font-bold text-navy">{s.title}</h3>
                <p className="mt-1 text-sm">
                  適用於{s.industry}，受眾是{s.audience}
                </p>
                <dl className="mt-4 space-y-3">
                  <div>
                    <FieldLabel>案例</FieldLabel>
                    <dd>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                        {s.cases.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <FieldLabel>素材檔</FieldLabel>
                    <dd className="mt-1 text-sm text-navy">
                      {s.materialNames.length > 0 ? s.materialNames.join("、") : "沒有素材檔"}
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function DraftCard({ draft }: { draft: KnowledgeDraft }) {
  const course = getCourse(draft.fromCourseId);
  const p = draft.proposal;
  const fw = p.kind === "framework_version" ? getFramework(p.frameworkId) : undefined;

  return (
    <article className={`${CARD} border-l-[3px] border-navy p-5`}>
      <p className="text-xs text-body-muted">
        來自{" "}
        {course ? (
          <Link href={`/courses/${course.id}`} className="font-bold text-navy underline underline-offset-2">
            {course.title}
          </Link>
        ) : (
          "已刪除的課程"
        )}
        ，{formatDate(draft.createdAt)}，{TRIGGER_TEXT[draft.trigger]}
      </p>

      {p.kind === "framework_version" ? (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">
            建議把框架「{fw?.title ?? p.frameworkId}」升到 v{fw ? latestFrameworkVersion(fw) + 1 : "?"}
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {p.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <MockAction>升成 v{fw ? latestFrameworkVersion(fw) + 1 : "?"}</MockAction>
            <MockAction variant="secondary">另存成新框架</MockAction>
            <MockAction variant="secondary">捨棄</MockAction>
          </div>
        </>
      ) : (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">建議新增情境「{p.scenario.title}」</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <FieldLabel>產業</FieldLabel>
              <dd className="mt-0.5 text-navy">{p.scenario.industry}</dd>
            </div>
            <div>
              <FieldLabel>受眾</FieldLabel>
              <dd className="mt-0.5 text-navy">{p.scenario.audience}</dd>
            </div>
            <div>
              <FieldLabel>案例</FieldLabel>
              <dd>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                  {p.scenario.cases.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <FieldLabel>素材檔</FieldLabel>
              <dd className="mt-0.5 text-navy">
                {p.scenario.materialNames.length > 0 ? p.scenario.materialNames.join("、") : "沒有素材檔"}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <MockAction>收進知識庫</MockAction>
            <MockAction variant="secondary">捨棄</MockAction>
          </div>
        </>
      )}
    </article>
  );
}

function FrameworkCard({ framework: f }: { framework: Framework }) {
  const latest = latestFrameworkVersion(f);
  const versions = [...f.versions].sort((a, b) => b.version - a.version);
  const users = COURSES.filter((c) => c.source?.frameworkId === f.id);

  return (
    <article id={f.id} className={`${CARD} scroll-mt-6 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="min-w-0 text-base font-bold text-navy">{f.title}</h4>
        <Badge tone="outline">目前 v{latest}</Badge>
      </div>
      <p className="mt-1.5 max-w-3xl text-sm">{f.summary}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <FieldLabel>單元</FieldLabel>
          <ol className="mt-1.5 space-y-1 text-sm">
            {f.moduleTitles.map((m, i) => (
              <li key={m} className="flex gap-2.5">
                <span className="w-5 shrink-0 text-right font-bold text-navy">{i + 1}</span>
                <span>{m}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-5">
          <div>
            <FieldLabel>版本紀錄</FieldLabel>
            <ul className="mt-1.5 space-y-1.5 text-sm">
              {versions.map((v) => {
                const from = v.fromCourseId ? getCourse(v.fromCourseId) : undefined;
                return (
                  <li key={v.version} className="flex gap-2.5">
                    <span className="w-8 shrink-0 font-bold text-navy">v{v.version}</span>
                    <span>
                      <span className="text-body-muted">{formatDate(v.createdAt)}</span> {v.note}
                      {from && (
                        <>
                          {" "}
                          <Link href={`/courses/${from.id}`} className="text-body-muted underline underline-offset-2 hover:text-navy">
                            （來自{from.title}）
                          </Link>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <FieldLabel>用到這個框架的課程</FieldLabel>
            {users.length === 0 ? (
              <p className="mt-1.5 text-sm text-body-muted">還沒有課程用過。</p>
            ) : (
              <ul className="mt-1.5 space-y-1 text-sm">
                {users.map((c) => {
                  const used = c.source!.frameworkVersion;
                  return (
                    <li key={c.id}>
                      <Link href={`/courses/${c.id}`} className="font-bold text-navy underline underline-offset-2">
                        {c.title}
                      </Link>{" "}
                      用 v{used}
                      {used < latest && <span className="text-xs text-body-muted">（不是最新版，藍圖不會跟著變）</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
