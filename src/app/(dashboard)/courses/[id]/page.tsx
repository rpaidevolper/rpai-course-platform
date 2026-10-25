import { notFound } from "next/navigation";
import { STALE_REASON_LABELS, summarizeArtifacts, type ArtifactSummary } from "@/lib/artifact-rules";
import { ARTIFACT_STATUS_LABELS, formatDateTime } from "@/lib/dashboard/format";
import { createSupabaseDashboardStore } from "@/lib/dashboard/store";
import { blueprintReport } from "@/lib/blueprint/report";
import { BlueprintPanel } from "../../../_components/blueprint-panel";
import { Badge, Card, Empty, Facts, PageHeader, SectionTitle } from "../../../_components/ui";
import { requireSignedIn } from "../../session";

/** 課程頁：頁首、最新藍圖與檢查結果、歷史版本、產物。 */
export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const { id } = await params;
  await requireSignedIn(`/courses/${id}`);

  const detail = await createSupabaseDashboardStore().getCourse(id);
  if (detail === null) notFound();

  const { course, latest, versions } = detail;
  const latestVersion = latest?.version ?? null;
  const updated = `最後更新 ${formatDateTime(course.updated_at)}`;
  const issues = latest === null ? [] : blueprintReport(latest.content).issues;

  return (
    <div className="space-y-10">
      <PageHeader
        title={course.title}
        description={latestVersion === null ? `還沒有藍圖・${updated}` : `最新第 ${latestVersion} 版・${updated}`}
      />

      <section>
        <SectionTitle>{latest === null ? "最新藍圖" : `最新藍圖（第 ${latest.version} 版）`}</SectionTitle>
        {latest === null ? (
          <Empty>這門課還沒有藍圖。</Empty>
        ) : (
          <div className="space-y-4">
            <Card>
              <BlueprintPanel blueprint={latest.content} />
            </Card>
            <Card>
              <h3 className="text-sm font-bold text-ink">檢查結果</h3>
              {issues.length === 0 ? (
                <p className="mt-2 text-sm">沒有發現問題</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </section>

      <section>
        <SectionTitle>歷史版本</SectionTitle>
        {versions.length === 0 ? (
          <Empty>還沒有版本。</Empty>
        ) : (
          <Card>
            <ul className="divide-y-2 divide-layer">
              {versions.map((v) => (
                <li key={v.version} className="py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-bold text-ink">第 {v.version} 版</span>
                    <span className="text-xs text-body-muted">{formatDateTime(v.created_at)}</span>
                  </div>
                  <p className="mt-1 break-words">{v.change_note ?? "—"}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle aside="過期的產物仍可下載，平台不會自動重做">產物</SectionTitle>
        <ArtifactList artifacts={summarizeArtifacts(detail.artifacts, latestVersion)} />
      </section>
    </div>
  );
}

/** 產物清單：每份一張卡，欄位排成格子，窄螢幕不會整頁橫向捲動。 */
function ArtifactList({ artifacts }: { artifacts: ArtifactSummary[] }) {
  if (artifacts.length === 0) return <Empty>還沒有產物。</Empty>;

  return (
    <ul className="space-y-3">
      {artifacts.map((a) => (
        <li key={a.id}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h3 className="font-bold text-ink">{a.kind_label}</h3>
                {a.filename && <p className="mt-0.5 break-all text-xs text-body-muted">{a.filename}</p>}
              </div>
              {a.status === "ready" && (
                <a
                  href={`/artifacts/${a.id}/download`}
                  className="shrink-0 text-sm font-bold text-accent underline underline-offset-2 hover:text-accent-press"
                >
                  下載
                </a>
              )}
            </div>
            <div className="mt-4">
              <Facts
                items={[
                  ["第幾天", a.day === null ? "—" : `第 ${a.day} 天`],
                  ["版本", `v${a.version}`],
                  ["出自藍圖", `第 ${a.blueprint_version} 版`],
                  ["狀態", ARTIFACT_STATUS_LABELS[a.status]],
                  [
                    "過期原因",
                    a.stale_reasons.length === 0 ? (
                      "—"
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {a.stale_reasons.map((reason) => (
                          <Badge key={reason} tone="warning">
                            {STALE_REASON_LABELS[reason]}
                          </Badge>
                        ))}
                      </span>
                    ),
                  ],
                ]}
              />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
