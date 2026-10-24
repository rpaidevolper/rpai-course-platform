"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { unitLevelText } from "@/lib/blueprint/schema";
import { formatDate, getCourse, getModuleCard, getUnitCard, latestModuleCardVersion, moduleLabel, recipesUsingUnit, seriesLabel } from "@/lib/mockup/logic";
import { canExcludeUnit, moduleChangeText, pendingUsageIncrease } from "@/lib/mockup/draft-review";
import type { DemoState } from "@/lib/mockup/state";
import { dispatch } from "@/lib/mockup/store";
import type { KnowledgeDraft, UnitCard } from "@/lib/mockup/types";
import { Dialog } from "../../_components/dialog";
import { toast } from "../../_components/demo-runtime";
import { TagList } from "../../_components/tags";
import { Badge, Button, CARD, Field, FieldLabel, TextArea, TextButton, TextInput } from "../../_components/ui";

const TRIGGER_TEXT: Record<KnowledgeDraft["trigger"], string> = {
  closing: "課程結案後產生",
  manual: "講師手動",
  import: "匯入過往講義",
};

const KIND_LABEL: Record<KnowledgeDraft["proposal"]["kind"], string> = {
  new_unit_card: "新單元卡",
  update_unit_card: "更新單元卡",
  new_course_recipe: "新課程配方",
  module_card_version: "模組卡新版本",
};

/** 一份待審核草稿。審核後呼叫 onDone(id) 讓頁面捲到、標出被改動的模組卡或課程配方。 */
export function DraftCard({ st, draft, onDone }: { st: DemoState; draft: KnowledgeDraft; onDone: (targetId: string) => void }) {
  const [dialog, setDialog] = useState<"discard" | "rewrite" | null>(null);
  const course = draft.fromCourseId ? getCourse(st, draft.fromCourseId) : undefined;
  const p = draft.proposal;
  const close = () => setDialog(null);

  const accept = (message: string, highlight: string) => {
    dispatch({ type: "draft/accept", draftId: draft.id });
    toast(message);
    onDone(highlight);
  };
  const discard = () => {
    close();
    dispatch({ type: "draft/discard", draftId: draft.id });
    toast(p.kind === "new_unit_card" ? "已排除這個單元，課程配方裡也一併拿掉" : "已捨棄草稿，知識庫沒有改動");
  };

  const finals = (draft.basis?.finalArtifactIds ?? []).flatMap((id) => {
    const a = course?.artifacts.find((x) => x.id === id);
    return a ? [`${seriesLabel({ kind: a.kind, day: a.day })} v${a.version}`] : [];
  });

  const buttons = (primary: ReactNode, opts: { rewrite?: boolean; discardLabel?: string } = {}) => (
    <div className="mt-5 flex flex-wrap gap-2">
      {primary}
      {opts.rewrite && (
        <Button variant="secondary" onClick={() => setDialog("rewrite")}>
          改寫文字
        </Button>
      )}
      <Button variant="secondary" onClick={() => setDialog("discard")}>
        {opts.discardLabel ?? "捨棄"}
      </Button>
    </div>
  );

  return (
    <article className={`${CARD} border-l-[3px] border-navy p-5`}>
      <p className="text-xs text-body-muted">
        <Badge tone="outline">{KIND_LABEL[p.kind]}</Badge>{" "}
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
        {draft.basis && (
          <>
            。依第 {draft.basis.blueprintVersion} 版藍圖{finals.length > 0 ? `與最終版（${finals.join("、")}）` : ""}
          </>
        )}
      </p>

      {p.kind === "new_unit_card" && (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">建議新增單元卡「{p.unitCard.title}」</h3>
          <UnitCardFacts card={p.unitCard} />
          {buttons(<Button onClick={() => accept(`已收進知識庫：單元卡「${p.unitCard.title}」`, `module-${p.unitCard.moduleId}`)}>收進知識庫</Button>, {
            rewrite: true,
            discardLabel: "排除這個單元",
          })}
        </>
      )}

      {p.kind === "update_unit_card" && <UpdateBody st={st} draft={draft} accept={accept} buttons={buttons} />}

      {p.kind === "new_course_recipe" && (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">建議新增課程配方「{p.recipe.title}」</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>標籤</FieldLabel>
              <dd className="mt-1">
                <TagList tags={p.recipe} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>單元（{p.unitCardIds.length}）</FieldLabel>
              <dd>
                <ol className="mt-0.5 space-y-1">
                  {p.unitCardIds.map((id, i) => {
                    const existing = getUnitCard(st, id);
                    const proposed = st.drafts.find((d) => d.proposal.kind === "new_unit_card" && d.proposal.unitCard.id === id)?.proposal;
                    const card = existing ?? (proposed?.kind === "new_unit_card" ? proposed.unitCard : undefined);
                    const used = recipesUsingUnit(st, id).length;
                    return (
                      <li key={id} className="flex flex-wrap items-center gap-2.5">
                        <span className="w-4 shrink-0 text-right font-bold text-navy">{i + 1}</span>
                        <span>
                          {card ? `${card.title}（${moduleLabel(card.moduleId)}・${card.minutes} 分）` : id}
                        </span>
                        {existing ? <Badge tone="neutral">既有・用過的配方 {used} → {used + 1}</Badge> : <Badge tone="outline">新單元卡</Badge>}
                        {canExcludeUnit(st, draft.id, id) ? (
                          <TextButton
                            tone="danger"
                            onClick={() => {
                              dispatch({ type: "draft/excludeUnit", draftId: draft.id, unitCardId: id });
                              toast("已排除這個單元，相關草稿一併拿掉");
                            }}
                          >
                            排除
                          </TextButton>
                        ) : (
                          <span className="text-xs text-body-muted">已收進知識庫，不能排除</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </dd>
            </div>
          </dl>
          {buttons(
            <Button
              disabled={p.unitCardIds.length === 0}
              title={p.unitCardIds.length === 0 ? "單元都被排除了，沒有東西可以收" : undefined}
              onClick={() => accept(`已收進知識庫：課程配方「${p.recipe.title}」與 ${p.unitCardIds.length} 個單元`, p.recipe.id)}
            >
              收進知識庫
            </Button>,
            { rewrite: true },
          )}
        </>
      )}

      {p.kind === "module_card_version" && <ModuleBody st={st} draft={draft} accept={accept} buttons={buttons} />}

      <Dialog
        open={dialog === "discard"}
        onClose={close}
        title={p.kind === "new_unit_card" ? "排除這個單元？" : "捨棄這份草稿？"}
        description={
          p.kind === "new_unit_card"
            ? "這個單元會從課程配方、模組卡改動裡一併拿掉，找不回來。"
            : "捨棄後就找不回來，知識庫不會有任何改動。"
        }
        submitLabel={p.kind === "new_unit_card" ? "排除" : "捨棄"}
        onSubmit={discard}
      />
      {dialog === "rewrite" && <RewriteDialog draft={draft} onClose={close} />}
    </article>
  );
}

function UnitCardFacts({ card }: { card: UnitCard }) {
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      <div>
        <FieldLabel>模組・時間</FieldLabel>
        <dd>
          {moduleLabel(card.moduleId)}・{card.minutes} 分
        </dd>
      </div>
      <div>
        <FieldLabel>教學方式</FieldLabel>
        <dd>{card.method}</dd>
      </div>
      <div>
        <FieldLabel>應用層級</FieldLabel>
        <dd>{unitLevelText(card.level)}</dd>
      </div>
      <div>
        <FieldLabel>學習目標</FieldLabel>
        <dd>{card.objective}</dd>
      </div>
      <div>
        <FieldLabel>成果</FieldLabel>
        <dd>{card.outcome}</dd>
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>標籤</FieldLabel>
        <dd className="mt-1">
          <TagList tags={{ audiences: card.audiences, tools: card.tools, scenarios: card.scenarios }} />
        </dd>
      </div>
    </dl>
  );
}

type BodyProps = {
  st: DemoState;
  draft: KnowledgeDraft;
  accept: (message: string, highlight: string) => void;
  buttons: (primary: ReactNode, opts?: { rewrite?: boolean; discardLabel?: string }) => ReactNode;
};

function UpdateBody({ st, draft, accept, buttons }: BodyProps) {
  const p = draft.proposal;
  if (p.kind !== "update_unit_card") return null;
  const card = getUnitCard(st, p.unitCardId);
  const used = recipesUsingUnit(st, p.unitCardId).length;
  const added = [...p.addTags.audiences, ...p.addTags.tools, ...p.addTags.scenarios];
  return (
    <>
      <h3 className="mt-2 text-base font-bold text-navy">建議更新單元卡「{card?.title ?? p.unitCardId}」</h3>
      <p className="mt-2 text-sm">
        這門課沿用了它。{pendingUsageIncrease(st, draft) ? `用過的配方 ${used} → ${used + 1}（課程配方收進後計入）。` : `用過的配方 ${used}。`}
      </p>
      <p className="mt-1 text-sm">{added.length > 0 ? `補上新標籤：${added.join("、")}` : "沒有新標籤，只是多一次使用。"}</p>
      {p.fillLevel !== null && card?.level === null && <p className="mt-1 text-sm">單元卡還沒評應用層級，補上：{unitLevelText(p.fillLevel)}</p>}
      {buttons(
        <Button onClick={() => accept(`已更新單元卡「${card?.title ?? ""}」`, `module-${card?.moduleId ?? ""}`)} disabled={!card} title={card ? undefined : "找不到原單元卡"}>
          更新單元卡
        </Button>,
      )}
    </>
  );
}

function ModuleBody({ st, draft, accept, buttons }: BodyProps) {
  const p = draft.proposal;
  if (p.kind !== "module_card_version") return null;
  const card = getModuleCard(st, p.moduleId);
  const next = card ? latestModuleCardVersion(card) + 1 : undefined;
  return (
    <>
      <h3 className="mt-2 text-base font-bold text-navy">
        建議把模組卡「{moduleLabel(p.moduleId)}」升到 v{next ?? "?"}
      </h3>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {p.changes.map((c, i) => (
          <li key={i}>{moduleChangeText(st, c)}</li>
        ))}
      </ul>
      {buttons(
        <Button onClick={() => accept(`模組卡「${moduleLabel(p.moduleId)}」已升到 v${next}`, `module-${p.moduleId}`)} disabled={!card} title={card ? undefined : "找不到原模組卡"}>
          升成 v{next ?? "?"}
        </Button>,
      )}
    </>
  );
}

/** 改寫含客戶機密的文字：把客戶名稱、代號換成中性的說法再收進知識庫。模組卡新版本的說明由單元卡推得，改寫單元標題就會跟著變。 */
function RewriteDialog({ draft, onClose }: { draft: KnowledgeDraft; onClose: () => void }) {
  const p = draft.proposal;
  const [fields, setFields] = useState<Record<string, string>>((): Record<string, string> => {
    if (p.kind === "new_unit_card") return { title: p.unitCard.title, objective: p.unitCard.objective, method: p.unitCard.method, outcome: p.unitCard.outcome };
    if (p.kind === "new_course_recipe") return { title: p.recipe.title };
    return {};
  });
  const set = (key: string) => ({ value: fields[key] ?? "", onChange: (e: { target: { value: string } }) => setFields({ ...fields, [key]: e.target.value }) });

  const submit = () => {
    if (p.kind === "new_unit_card") {
      dispatch({ type: "draft/rewrite", draftId: draft.id, patch: { kind: "new_unit_card", title: fields.title, objective: fields.objective, method: fields.method, outcome: fields.outcome } });
    } else if (p.kind === "new_course_recipe") {
      dispatch({ type: "draft/rewrite", draftId: draft.id, patch: { kind: "new_course_recipe", title: fields.title } });
    }
    toast("已改寫，收進知識庫的是改寫後的文字");
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title="改寫文字" description="客戶名稱、代號、內部數字不該進知識庫；改成中性的說法。" submitLabel="套用改寫" onSubmit={submit}>
      {p.kind === "new_unit_card" && (
        <>
          <Field label="單元標題">
            <TextInput {...set("title")} />
          </Field>
          <Field label="學習目標">
            <TextArea {...set("objective")} />
          </Field>
          <Field label="教學方式">
            <TextInput {...set("method")} />
          </Field>
          <Field label="成果">
            <TextArea {...set("outcome")} />
          </Field>
        </>
      )}
      {p.kind === "new_course_recipe" && (
        <>
          <Field label="配方名稱">
            <TextInput {...set("title")} />
          </Field>
        </>
      )}
    </Dialog>
  );
}
