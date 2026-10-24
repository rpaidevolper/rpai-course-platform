"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatDate,
  getCourse,
  getUnitCard,
  latestModuleCardVersion,
  moduleCardSkeleton,
  moduleLabel,
  recipeMinutes,
  recipeModules,
  recipesUsingModule,
  recipesUsingUnit,
  recipeUnitCards,
} from "@/lib/mockup/logic";
import { moduleCardUsage, unitCardUsage, type CourseUsage } from "@/lib/mockup/browse";
import type { DemoState } from "@/lib/mockup/state";
import { recipeSpec, unitTags } from "@/lib/mockup/tags";
import { RECIPE_STATUS_LABELS } from "@/lib/mockup/types";
import { Dialog } from "../../_components/dialog";
import { TagList } from "../../_components/tags";
import { Badge, FieldLabel } from "../../_components/ui";

/** 知識庫裡正在打開的一張卡。 */
export type OpenCard = { kind: "module" | "unit" | "recipe"; id: string };

const linkButton = "text-left font-bold text-navy underline underline-offset-2 hover:text-body";

/** 模組卡、單元卡、課程配方的詳細內容。三種卡共用一個對話框，卡與卡之間可以直接跳轉。 */
export function CardDetailDialog({
  st,
  open,
  onOpen,
  onClose,
}: {
  st: DemoState;
  open: OpenCard | null;
  onOpen: (card: OpenCard) => void;
  onClose: () => void;
}) {
  const content = open ? detailOf(st, open, onOpen) : null;
  return (
    <Dialog open={content !== null} onClose={onClose} title={content?.title ?? ""} description={content?.description}>
      {content?.body}
    </Dialog>
  );
}

function detailOf(st: DemoState, card: OpenCard, onOpen: (card: OpenCard) => void) {
  if (card.kind === "module") return moduleDetail(st, card.id, onOpen);
  if (card.kind === "unit") return unitDetail(st, card.id, onOpen);
  return recipeDetail(st, card.id, onOpen);
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

/** 用過的課程：課程名稱連到課程頁，旁邊是藍圖版本與用到的單元。 */
export function UsageList({ usages, empty }: { usages: CourseUsage[]; empty: string }) {
  if (usages.length === 0) return <p className="text-body-muted">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {usages.map(({ course, blueprintVersion, unitTitles }) => (
        <li key={course.id}>
          <Link href={`/courses/${course.id}`} className="font-bold text-navy underline underline-offset-2">
            {course.title}
          </Link>{" "}
          <Badge tone="outline">藍圖 v{blueprintVersion}</Badge>
          <span className="ml-1.5 text-body-muted">{unitTitles.length === 1 ? unitTitles[0] : `${unitTitles.length} 個單元`}</span>
        </li>
      ))}
    </ul>
  );
}

function moduleDetail(st: DemoState, moduleId: string, onOpen: (card: OpenCard) => void) {
  const card = st.moduleCards.find((c) => c.moduleId === moduleId);
  if (!card) return null;
  const versions = [...card.versions].sort((a, b) => b.version - a.version);
  const recipes = recipesUsingModule(st, card.moduleId);
  const courses = moduleCardUsage(st, card.moduleId);
  return {
    title: `模組卡 ${moduleLabel(card.moduleId)}`,
    description: (
      <>
        <Badge tone="outline">目前 v{latestModuleCardVersion(card)}</Badge>
        <p className="mt-2">{card.summary}</p>
      </>
    ),
    body: (
      <>
        <Section label="範圍">{card.scope}</Section>
        <Section label="核心單元骨架">
          <ol className="space-y-1">
            {moduleCardSkeleton(card).map((id, i) => {
              const u = getUnitCard(st, id);
              return (
                <li key={id} className="flex gap-2.5">
                  <span className="w-5 shrink-0 text-right font-bold text-navy">{i + 1}</span>
                  {u ? (
                    <button type="button" className={linkButton} onClick={() => onOpen({ kind: "unit", id })}>
                      {u.title}（{u.minutes} 分）
                    </button>
                  ) : (
                    <span>{id}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
        <Section label="常見搭配">
          <ul className="list-disc space-y-0.5 pl-5">
            {card.combos.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Section>
        <Section label="版本紀錄">
          <ul className="space-y-1.5">
            {versions.map((v) => {
              const from = v.fromCourseId ? getCourse(st, v.fromCourseId) : undefined;
              return (
                <li key={v.version} className="flex gap-2.5">
                  <span className="w-8 shrink-0 font-bold text-navy">v{v.version}</span>
                  <span className="min-w-0">
                    <span className="text-body-muted">{formatDate(v.createdAt)}</span> {v.note}
                    <span className="block text-xs text-body-muted">
                      這一版的骨架（{v.skeletonUnitIds.length} 個單元）：{v.skeletonUnitIds.map((id) => getUnitCard(st, id)?.title ?? id).join("、")}
                    </span>
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
        </Section>
        <Section label="代表課程配方">
          {recipes.length === 0 ? (
            <p className="text-body-muted">還沒有配方用到這個模組。</p>
          ) : (
            <ul className="space-y-1">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button type="button" className={linkButton} onClick={() => onOpen({ kind: "recipe", id: r.id })}>
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section label="平台上用過這個模組的課程">
          <UsageList usages={courses} empty="還沒有課程用過。" />
          <p className="mt-1 text-xs text-body-muted">藍圖裡有單元屬於這個模組的課程；版本是該課程目前的藍圖版本。</p>
        </Section>
      </>
    ),
  };
}

function unitDetail(st: DemoState, unitId: string, onOpen: (card: OpenCard) => void) {
  const u = getUnitCard(st, unitId);
  if (!u) return null;
  const recipes = recipesUsingUnit(st, u.id);
  const courses = unitCardUsage(st, u.id);
  return {
    title: `單元卡：${u.title}`,
    description: (
      <>
        <button type="button" className={linkButton} onClick={() => onOpen({ kind: "module", id: u.moduleId })}>
          {moduleLabel(u.moduleId)}
        </button>
        {" ・ "}
        {u.minutes} 分鐘
      </>
    ),
    body: (
      <>
        <Section label="目標">{u.objective}</Section>
        <Section label="教學方式">{u.method}</Section>
        <Section label="成果">{u.outcome}</Section>
        <Section label="標籤">
          <TagList tags={unitTags(st, u)} />
          <p className="mt-1 text-xs text-body-muted">產業由用過它的課程配方推得。</p>
        </Section>
        <Section label="使用次數">{recipes.length} 次</Section>
        <Section label="用過它的課程配方">
          {recipes.length === 0 ? (
            <p className="text-body-muted">還沒有配方用過。</p>
          ) : (
            <ul className="space-y-1">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button type="button" className={linkButton} onClick={() => onOpen({ kind: "recipe", id: r.id })}>
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section label="平台上用過這張單元卡的課程">
          <UsageList usages={courses} empty="還沒有課程用過。" />
          <p className="mt-1 text-xs text-body-muted">藍圖單元的來源是這張卡的課程；版本是該課程目前的藍圖版本。</p>
        </Section>
      </>
    ),
  };
}

function recipeDetail(st: DemoState, recipeId: string, onOpen: (card: OpenCard) => void) {
  const r = st.recipes.find((x) => x.id === recipeId);
  if (!r) return null;
  const units = recipeUnitCards(st, r);
  return {
    title: `課程配方：${r.title}`,
    description: (
      <>
        {r.client}・{RECIPE_STATUS_LABELS[r.status]}
        {r.heldOn ? `・${r.heldOn}` : ""}
      </>
    ),
    body: (
      <>
        <Section label="標籤">
          <TagList tags={r} spec={recipeSpec(st, r)} />
          <p className="mt-1 text-xs text-body-muted">規格由單元的總分鐘數推得。</p>
        </Section>
        <Section label="用到的模組">
          {recipeModules(st, r)
            .map((m) => moduleLabel(m))
            .join("、")}
        </Section>
        <Section label={`單元（共 ${recipeMinutes(st, r)} 分鐘）`}>
          <ol className="space-y-1">
            {units.map((u, i) => (
              <li key={u.id} className="flex gap-2.5">
                <span className="w-5 shrink-0 text-right font-bold text-navy">{i + 1}</span>
                <button type="button" className={linkButton} onClick={() => onOpen({ kind: "unit", id: u.id })}>
                  {u.title}（{u.minutes} 分）
                </button>
              </li>
            ))}
          </ol>
        </Section>
      </>
    ),
  };
}

