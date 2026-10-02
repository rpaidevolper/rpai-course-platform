"use client";

import Link from "next/link";
import { useState } from "react";
import { makeId } from "@/lib/mockup/actions";
import { formatDate, getCourse, getFramework, latestFrameworkVersion } from "@/lib/mockup/logic";
import type { DemoState } from "@/lib/mockup/state";
import { dispatch } from "@/lib/mockup/store";
import { TOPICS, type KnowledgeDraft } from "@/lib/mockup/types";
import { Dialog } from "../../_components/dialog";
import { toast } from "../../_components/demo-runtime";
import { Button, CARD, Field, FieldLabel, TextInput } from "../../_components/ui";

const TRIGGER_TEXT: Record<KnowledgeDraft["trigger"], string> = {
  auto: "課程結束後自動產生",
  manual: "講師手動",
  import: "匯入過往講義",
};

/** 一份待審核草稿。審核後呼叫 onDone(id) 讓頁面捲到、標出被改動的框架或情境。 */
export function DraftCard({ st, draft, onDone }: { st: DemoState; draft: KnowledgeDraft; onDone: (targetId: string) => void }) {
  const [dialog, setDialog] = useState<"saveAs" | "discard" | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const course = draft.fromCourseId ? getCourse(st, draft.fromCourseId) : undefined;
  const p = draft.proposal;
  const fw = p.kind === "framework_version" ? getFramework(st, p.frameworkId) : undefined;
  const nextVersion = fw ? latestFrameworkVersion(fw) + 1 : undefined;

  const close = () => setDialog(null);

  const accept = () => {
    if (p.kind === "framework_version") {
      if (!fw) return;
      dispatch({ type: "draft/accept", draftId: draft.id, newId: "" });
      toast(`框架已升到 v${nextVersion}`);
      onDone(fw.id);
    } else if (p.kind === "new_framework") {
      const id = makeId("fw");
      dispatch({ type: "draft/accept", draftId: draft.id, newId: id });
      toast(`已收進知識庫：框架「${p.framework.title}」`);
      onDone(id);
    } else {
      const id = makeId("sc");
      dispatch({ type: "draft/accept", draftId: draft.id, newId: id });
      toast(`已收進知識庫：情境「${p.scenario.title}」`);
      onDone(id);
    }
  };

  const saveAs = () => {
    const title = newTitle.trim();
    if (!title) return;
    const id = makeId("fw");
    close();
    dispatch({ type: "draft/saveAsFramework", draftId: draft.id, frameworkId: id, title });
    toast(`已另存成新框架「${title}」`);
    onDone(id);
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

      {p.kind === "framework_version" && (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">
            建議把框架「{fw?.title ?? p.frameworkId}」升到 v{nextVersion ?? "?"}
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {p.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={accept} disabled={!fw} title={fw ? undefined : "找不到原框架"}>
              升成 v{nextVersion ?? "?"}
            </Button>
            <Button
              variant="secondary"
              disabled={!fw}
              onClick={() => {
                setNewTitle(fw ? `${fw.title}（新版）` : "");
                setDialog("saveAs");
              }}
            >
              另存成新框架
            </Button>
            {discardButton}
          </div>
        </>
      )}

      {p.kind === "new_framework" && (
        <>
          <h3 className="mt-2 text-base font-bold text-navy">建議新增框架「{p.framework.title}」</h3>
          <p className="mt-1.5 max-w-3xl text-sm">{p.framework.summary}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <FieldLabel>主題</FieldLabel>
              <dd className="mt-0.5 text-navy">{TOPICS.find((t) => t.id === p.framework.topicId)?.label ?? p.framework.topicId}</dd>
            </div>
            <div>
              <FieldLabel>單元</FieldLabel>
              <dd>
                <ol className="mt-0.5 space-y-0.5">
                  {p.framework.moduleTitles.map((m, i) => (
                    <li key={m} className="flex gap-2.5">
                      <span className="w-4 shrink-0 text-right font-bold text-navy">{i + 1}</span>
                      <span>{m}</span>
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

      {p.kind === "new_scenario" && (
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
            <Button onClick={accept}>收進知識庫</Button>
            {discardButton}
          </div>
        </>
      )}

      <Dialog
        open={dialog === "saveAs"}
        onClose={close}
        title="另存成新框架"
        description={<>原框架「{fw?.title}」不會改動。新框架從 v1 開始，單元先沿用原框架，這份草稿的修改記在 v1 的說明裡。</>}
        submitLabel="另存"
        onSubmit={saveAs}
        submitDisabled={newTitle.trim() === ""}
      >
        <Field label="新框架名稱">
          <TextInput value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
        </Field>
      </Dialog>

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
