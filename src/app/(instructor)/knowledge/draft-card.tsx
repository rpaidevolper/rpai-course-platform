"use client";

import Link from "next/link";
import { useState } from "react";
import { makeId } from "@/lib/mockup/actions";
import { formatDate, getCourse, getModuleCard, latestModuleCardVersion, moduleLabel } from "@/lib/mockup/logic";
import type { DemoState } from "@/lib/mockup/state";
import { dispatch } from "@/lib/mockup/store";
import type { KnowledgeDraft } from "@/lib/mockup/types";
import { Dialog } from "../../_components/dialog";
import { toast } from "../../_components/demo-runtime";
import { Button, CARD, FieldLabel } from "../../_components/ui";

const TRIGGER_TEXT: Record<KnowledgeDraft["trigger"], string> = {
  auto: "課程結束後自動產生",
  manual: "講師手動",
  import: "匯入過往講義",
};

/** 一份待審核草稿。審核後呼叫 onDone(id) 讓頁面捲到、標出被改動的模組卡、課程配方或產業素材包。 */
export function DraftCard({ st, draft, onDone }: { st: DemoState; draft: KnowledgeDraft; onDone: (targetId: string) => void }) {
  const [dialog, setDialog] = useState<"discard" | null>(null);
  const course = draft.fromCourseId ? getCourse(st, draft.fromCourseId) : undefined;
  const p = draft.proposal;
  const card = p.kind === "module_card_version" ? getModuleCard(st, p.moduleId) : undefined;
  const nextVersion = card ? latestModuleCardVersion(card) + 1 : undefined;

  const close = () => setDialog(null);

  const accept = () => {
    if (p.kind === "module_card_version") {
      if (!card) return;
      dispatch({ type: "draft/accept", draftId: draft.id, newId: "" });
      toast(`模組卡「${moduleLabel(p.moduleId)}」已升到 v${nextVersion}`);
      onDone(`module-${p.moduleId}`);
    } else if (p.kind === "new_course_recipe") {
      const id = makeId("rc");
      dispatch({ type: "draft/accept", draftId: draft.id, newId: id });
      toast(`已收進知識庫：課程配方「${p.recipe.title}」與 ${p.unitCards.length} 張單元卡`);
      onDone(id);
    } else {
      const id = makeId("ip");
      dispatch({ type: "draft/accept", draftId: draft.id, newId: id });
      toast(`已收進知識庫：產業素材包「${p.industryPack.title}」`);
      onDone(id);
    }
  };

  const discard = () => {
    close();
    dispatch({ type: "draft/discard", draftId: draft.id });
    toast("已捨棄草稿，知識庫沒有改動");
  };

  const discardButton = (
    <Button variant="secondary" onClick={() => setDialog("discard")}>
      捨棄
    </Button>
  );

  return (
    <article className={`${CARD} border-l-[3px] border-navy p-5`}>
      <p className="text-xs text-body-muted">
        {draft.fromCourseId === null && draft.importedFileName ? (
          <>
            來自匯入的講義「<span className="font-bold text-navy">{draft.importedFileName}</span>」，{formatDate(draft.createdAt)}
          </>
        ) : (
          <>
            來自{" "}
            {course ? (
              <Link href={`/courses/${course.id}`} className="font-bold text-navy underline underline-offset-2">
                {course.title}
              </Link>
            ) : (
              "已刪除的課程"
            )}
            ，{formatDate(draft.createdAt)}，{TRIGGER_TEXT[draft.trigger]}
          </>
        )}
      </p>

      {p.kind === "module_card_version" && (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">
            建議把模組卡「{moduleLabel(p.moduleId)}」升到 v{nextVersion ?? "?"}
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {p.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={accept} disabled={!card} title={card ? undefined : "找不到原模組卡"}>
              升成 v{nextVersion ?? "?"}
            </Button>
            {discardButton}
          </div>
        </>
      )}

      {p.kind === "new_course_recipe" && (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">建議新增課程配方「{p.recipe.title}」</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <FieldLabel>產業</FieldLabel>
              <dd className="mt-0.5 text-navy">{p.recipe.industry}</dd>
            </div>
            <div>
              <FieldLabel>對象</FieldLabel>
              <dd className="mt-0.5 text-navy">{p.recipe.audience}</dd>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>同時新增的單元卡（{p.unitCards.length}）</FieldLabel>
              <dd>
                <ol className="mt-0.5 space-y-0.5">
                  {p.unitCards.map((u, i) => (
                    <li key={u.title} className="flex gap-2.5">
                      <span className="w-4 shrink-0 text-right font-bold text-navy">{i + 1}</span>
                      <span>
                        {u.title}（{moduleLabel(u.moduleId)}・{u.minutes} 分）
                      </span>
                    </li>
                  ))}
                </ol>
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={accept}>收進知識庫</Button>
            {discardButton}
          </div>
        </>
      )}

      {p.kind === "new_industry_pack" && (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">建議新增產業素材包「{p.industryPack.title}」</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <FieldLabel>產業</FieldLabel>
              <dd className="mt-0.5 text-navy">{p.industryPack.industry}</dd>
            </div>
            <div>
              <FieldLabel>受眾</FieldLabel>
              <dd className="mt-0.5 text-navy">{p.industryPack.audience}</dd>
            </div>
            <div>
              <FieldLabel>案例</FieldLabel>
              <dd>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                  {p.industryPack.cases.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <FieldLabel>素材檔</FieldLabel>
              <dd className="mt-0.5 text-navy">
                {p.industryPack.materialNames.length > 0 ? p.industryPack.materialNames.join("、") : "沒有素材檔"}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={accept}>收進知識庫</Button>
            {discardButton}
          </div>
        </>
      )}

      <Dialog
        open={dialog === "discard"}
        onClose={close}
        title="捨棄這份草稿？"
        description="捨棄後就找不回來，知識庫不會有任何改動。"
        submitLabel="捨棄"
        onSubmit={discard}
      />
    </article>
  );
}
