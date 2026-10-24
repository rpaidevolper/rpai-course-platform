"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { makeId } from "@/lib/mockup/actions";
import { coursesOfProject, formatDate, formatTwd, sessionStartsAt, upcomingSessions } from "@/lib/mockup/logic";
import { isProjectClosed, projectGroups, type ProjectGroupKey } from "@/lib/mockup/closing";
import { dispatch, useDemoState } from "@/lib/mockup/store";
import { PROJECT_STATUS_LABELS, type Project, type Session } from "@/lib/mockup/types";
import type { DemoState } from "@/lib/mockup/state";
import { toast } from "../../_components/demo-runtime";
import { Badge, Button, CARD, Empty, PageHeader, ProjectStatusBadge, SectionTitle } from "../../_components/ui";
import { ProjectDialog } from "./project-dialog";

const GROUP_LABELS: Record<ProjectGroupKey, string> = { ...PROJECT_STATUS_LABELS, closed: "已結案" };

const GROUP_HINTS: Record<ProjectGroupKey, string> = {
  negotiating: "客戶還在洽談；課綱討論談出的藍圖，成交後直接沿用。",
  active: "已成交、正在準備或交付的專案。",
  closed: "底下的課程都結案了；結案由課程推得，不是專案狀態。",
  archived: "沒成交的專案，留著查歷史。",
};

/** 專案列表：依狀態分組（洽談中、進行中、已結案、封存）；已結案不混在進行中底下，封存只代表沒成交。 */
export function ProjectsView() {
  const st = useDemoState();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const upcoming = upcomingSessions(st, st.now);
  const groups = projectGroups(st, st.projects);

  return (
    <>
      <PageHeader title="專案" description="每個專案是與一個客戶的一次合作，從洽談就開始存在，底下可以有多門課程。">
        <Button onClick={() => setCreating(true)}>新增專案</Button>
      </PageHeader>

      <div className="space-y-10">
        {groups.map(({ key, projects }) => (
          <section key={key} aria-labelledby={`status-${key}`}>
            <SectionTitle aside={`${projects.length} 個專案`}>
              <span id={`status-${key}`}>{GROUP_LABELS[key]}</span>
            </SectionTitle>
            <p className="-mt-1 mb-3 text-xs text-body-muted">{GROUP_HINTS[key]}</p>
            {projects.length === 0 ? (
              <Empty>沒有{GROUP_LABELS[key]}的專案。</Empty>
            ) : (
              <ul className="space-y-4">
                {projects.map((p) => (
                  <li key={p.id}>
                    <ProjectRow st={st} project={p} upcoming={upcoming} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {creating && (
        <ProjectDialog
          onClose={() => setCreating(false)}
          onSubmit={(v) => {
            const id = makeId("p");
            dispatch({ type: "project/create", id, ...v });
            setCreating(false);
            toast(`已建立專案「${v.title}」`);
            router.push(`/projects/${id}`);
          }}
        />
      )}
    </>
  );
}

function ProjectRow({ st, project: p, upcoming }: { st: DemoState; project: Project; upcoming: Session[] }) {
  const courses = coursesOfProject(st, p.id);
  const courseIds = new Set(courses.map((c) => c.id));
  const next = upcoming.find((s) => courseIds.has(s.courseId));
  return (
    <article className={`${CARD} grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-navy">
            <Link href={`/projects/${p.id}`} className="hover:underline">
              {p.title}
            </Link>
          </h3>
          <ProjectStatusBadge status={p.status} />
          {isProjectClosed(st, p.id) && <Badge tone="success">結案</Badge>}
        </div>
        <p className="mt-0.5 text-sm">
          {p.clientContext.company}，{p.clientContext.industry}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-x-6 text-sm sm:text-right">
        <div>
          <dt className="text-xs font-bold text-body-muted">課程</dt>
          <dd className="mt-0.5 text-navy">{courses.length} 門</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-body-muted">下一場</dt>
          <dd className="mt-0.5 text-navy">{next ? formatDate(sessionStartsAt(next)) : "沒有排定"}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-body-muted">價格</dt>
          <dd className="mt-0.5 text-navy">{formatTwd(p.priceTwd)}</dd>
        </div>
      </dl>
    </article>
  );
}
