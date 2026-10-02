import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MOCK_NOW, SESSIONS } from "@/lib/mockup/data";
import {
  PORTAL_VALID_DAYS,
  formatDate,
  formatDateTime,
  formatTime,
  getCourse,
  getProject,
  getSession,
  latestArtifact,
  portalExpiresAt,
  portalState,
  readiness,
  readinessText,
  seriesLabel,
  type PortalState,
  VENUE_UNSET,
} from "@/lib/mockup/logic";
import { Badge, Breadcrumb, Card, CARD, Empty, Facts, MockAction, PageHeader, SectionTitle } from "../../../_components/ui";

export function generateStaticParams() {
  return SESSIONS.map((s) => ({ sessionId: s.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/sessions/[sessionId]">): Promise<Metadata> {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  const course = session && getCourse(session.courseId);
  return { title: course ? `${course.title} ${formatDate(session!.startsAt)}` : "場次" };
}

const PORTAL_BADGE: Record<PortalState, { tone: "neutral" | "success" | "warning" | "danger"; label: string }> = {
  unpublished: { tone: "neutral", label: "未發布" },
  open: { tone: "success", label: "開放中" },
  expired: { tone: "warning", label: "已過期" },
  closed: { tone: "danger", label: "已關閉" },
};

export default async function SessionPage({ params }: PageProps<"/sessions/[sessionId]">) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) notFound();
  const course = getCourse(session.courseId)!;
  const project = getProject(course.projectId)!;

  const items = readiness(session);
  const pub = session.publication;
  const state = portalState(session, MOCK_NOW);
  const badge = PORTAL_BADGE[state];
  const code = session.portal.code;

  const lockedArtifacts = pub ? course.artifacts.filter((a) => pub.artifactIds.includes(a.id)) : [];
  const lockedMaterials = pub ? course.materials.filter((m) => pub.materialIds.includes(m.id)) : [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: project.title, href: `/projects/${project.id}` },
          { label: course.title, href: `/courses/${course.id}` },
          { label: formatDate(session.startsAt) },
        ]}
      />
      <PageHeader
        title={`${course.title}　${formatDate(session.startsAt)}`}
        description="這一場的時間、地點、連結和要給學員的東西，都在這裡。"
      />

      <div className="space-y-8">
        {/* 發布：本頁重點 */}
        <section aria-labelledby="publish" className={`${CARD} border-l-[3px] border-navy p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="publish" className="text-xl font-bold text-navy">
              發布
            </h2>
            {pub ? <Badge tone="success">已發布</Badge> : <Badge tone="warning">還沒發布</Badge>}
          </div>

          {!pub ? (
            <>
              <p className="mt-3 max-w-xl text-sm">
                發布後，學員入口才會打開；之後你再改藍圖或重新產出，學員看到的都不會變，直到再次發布。
              </p>
              <div className="mt-5">
                <MockAction>發布給學員</MockAction>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm">
                上次發布：<span className="font-bold text-navy">{formatDateTime(pub.publishedAt)}</span>
              </p>

              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-bold text-body-muted">學員看到的產物</h3>
                  <ul className="space-y-3 text-sm">
                    {lockedArtifacts.map((a) => {
                      const latest = latestArtifact(course, a.kind, a.day);
                      const newer = latest && latest.status === "ready" && latest.version > a.version ? latest : null;
                      return (
                        <li key={a.id}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-navy">{seriesLabel(a)}</span>
                            <Badge tone="outline">v{a.version}</Badge>
                          </div>
                          {newer && (
                            <p className="mt-1 text-xs font-bold text-warning">
                              有較新的 v{newer.version} 未發布，學員目前看到的還是 v{a.version}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-xs font-bold text-body-muted">鎖定的素材</h3>
                    {lockedMaterials.length === 0 ? (
                      <p className="text-sm text-body-muted">沒有素材</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {lockedMaterials.map((m) => (
                          <li key={m.id} className="break-words text-navy">
                            {m.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold text-body-muted">鎖定的連結</h3>
                    {pub.links.length === 0 ? (
                      <p className="text-sm text-body-muted">沒有連結</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {pub.links.map((l) => (
                          <li key={l.url} className="break-words text-navy">
                            {l.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-5 max-w-xl text-sm">
                重新發布會把學員入口換成目前最新的產物、素材與連結。
              </p>
              <div className="mt-4">
                <MockAction>重新發布</MockAction>
              </div>
            </>
          )}
        </section>

        {/* 學員入口 */}
        <section aria-labelledby="portal">
          <SectionTitle>
            <span id="portal">學員入口</span>
          </SectionTitle>
          <Card>
            <Facts
              items={[
                [
                  "頁面",
                  <Link key="u" href={`/s/${code}`} className="break-all font-bold underline underline-offset-2">
                    /s/{code}
                  </Link>,
                ],
                ["狀態", <Badge key="b" tone={badge.tone}>{badge.label}</Badge>],
                ["有效期限", session.publication ? formatDateTime(portalExpiresAt(session)) : `發布後開始計算，預設課後 ${PORTAL_VALID_DAYS} 天`],
              ]}
            />
            <p className="mt-3 text-xs text-body-muted">
              預設到課後 {PORTAL_VALID_DAYS} 天失效，你可以延長或提前關閉。學員不需要帳號，打開這個頁面就能看。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MockAction variant="secondary">提前關閉</MockAction>
              <MockAction variant="secondary">延長期限</MockAction>
            </div>
          </Card>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          {/* 場次資訊與準備度 */}
          <section aria-labelledby="info">
            <SectionTitle>
              <span id="info">場次資訊</span>
            </SectionTitle>
            <Card>
              <Facts
                items={[
                  ["日期", formatDate(session.startsAt)],
                  ["時間", `${formatTime(session.startsAt)}–${formatTime(session.endsAt)}`],
                  [
                    "地點",
                    session.venue === null ? (
                      <span key="v" className="font-bold text-warning">{VENUE_UNSET}</span>
                    ) : (
                      session.venue
                    ),
                  ],
                ]}
              />
            </Card>
          </section>

          <section aria-labelledby="ready">
            <SectionTitle>
              <span id="ready">準備度</span>
            </SectionTitle>
            <Card>
              {items.length === 0 ? (
                <Badge tone="success">準備好了</Badge>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-warning" />
                      <span>{readinessText(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>

        {/* 連結 */}
        <section aria-labelledby="links">
          <SectionTitle>
            <span id="links">這一場的連結</span>
          </SectionTitle>
          <Card>
            <p className="mb-3 text-xs text-body-muted">連結屬於場次，每一場各自填，例如這一場專用的 Slido。</p>
            {session.links.length === 0 ? (
              <div className="space-y-3">
                <Empty>這一場還沒有連結。填上 Slido 之類的外部連結，發布後學員才找得到。</Empty>
                <MockAction variant="secondary">新增連結</MockAction>
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {session.links.map((l) => (
                  <li key={l.url} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-bold text-navy">{l.label}</span>
                    <span className="break-all text-body-muted">{l.url}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
