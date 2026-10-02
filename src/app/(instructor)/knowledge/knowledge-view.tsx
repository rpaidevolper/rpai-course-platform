"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { makeId } from "@/lib/mockup/actions";
import { IMPORT_ACCEPT, importProposal } from "@/lib/mockup/import-script";
import { formatDate, frameworksOfTopic, getCourse, latestFrameworkVersion, pendingDrafts } from "@/lib/mockup/logic";
import type { DemoState } from "@/lib/mockup/state";
import { dispatch, useDemoState } from "@/lib/mockup/store";
import { TOPICS, type Framework, type TopicId } from "@/lib/mockup/types";
import { Dialog } from "../../_components/dialog";
import { toast } from "../../_components/demo-runtime";
import { Badge, Button, Card, CARD, Empty, Field, FieldLabel, PageHeader, SectionTitle, Select, TextInput } from "../../_components/ui";
import { DraftCard } from "./draft-card";

/** 假裝 AI 拆解講義要花的時間 */
const IMPORT_MS = 1500;
const HIGHLIGHT_MS = 2400;
const HIGHLIGHT = "ring-2 ring-navy";

/** 知識庫：待審核草稿 > 框架（依主題分組） > 情境。 */
export function KnowledgeView() {
  const st = useDemoState();
  const drafts = pendingDrafts(st);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // 審核後捲到被改動的框架或情境，短暫標出來
  useEffect(() => {
    if (!highlight) return;
    document.getElementById(highlight)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlight]);

  const importTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (importTimer.current) clearTimeout(importTimer.current);
  }, []);

  const startImport = (fileName: string, topicId: TopicId) => {
    setImportOpen(false);
    setImporting(fileName);
    importTimer.current = setTimeout(() => {
      importTimer.current = null;
      dispatch({ type: "draft/import", id: makeId("d"), fileName, proposal: importProposal(fileName, topicId) });
      setImporting(null);
      toast("已產生草稿，等你審核");
    }, IMPORT_MS);
  };

  return (
    <>
      <PageHeader
        title="知識庫"
        description="從過去的課整理出來、你確認過的框架與情境。新課程的藍圖從這裡複製內容出生，之後框架改版不會動到已經存在的藍圖。"
      >
        <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={importing !== null}>
          匯入過往講義
        </Button>
      </PageHeader>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={startImport} />

      <section aria-labelledby="drafts-title" className="mb-12">
        <SectionTitle aside="確認後才會收進知識庫">
          <span id="drafts-title">待審核草稿（{drafts.length}）</span>
        </SectionTitle>
        <div aria-live="polite">
          {importing && (
            <p className={`${CARD} mb-4 border-l-[3px] border-navy p-5 text-sm font-bold text-navy`}>
              <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-navy align-middle" aria-hidden />
              AI 正在拆解講義「{importing}」…
            </p>
          )}
        </div>
        {drafts.length === 0 ? (
          !importing && <Empty>目前沒有草稿。課程最後一個場次結束後，AI 會自動拆出新的草稿。</Empty>
        ) : (
          <ul className="space-y-4">
            {drafts.map((d) => (
              <li key={d.id}>
                <DraftCard st={st} draft={d} onDone={setHighlight} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="frameworks-title" className="mb-12">
        <SectionTitle aside="直接編輯框架會升一版">
          <span id="frameworks-title">框架</span>
        </SectionTitle>
        <p className="mb-5 max-w-2xl text-sm">開新課程時，AI 會依專案的客戶背景，從這裡推薦框架與情境。</p>

        <nav aria-label="跳到主題" className="mb-6 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <a key={t.id} href={`#topic-${t.id}`} className="rounded-md bg-navy-tint px-3 py-1.5 text-sm font-bold text-navy hover:bg-iced">
              {t.label}（{frameworksOfTopic(st, t.id).length}）
            </a>
          ))}
        </nav>

        <div className="space-y-10">
          {TOPICS.map((t) => {
            const list = frameworksOfTopic(st, t.id);
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
                        <FrameworkCard st={st} framework={f} highlighted={highlight === f.id} />
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
        {st.scenarios.length === 0 ? (
          <Empty>還沒有情境。審核通過課後草稿裡的情境後，會出現在這裡。</Empty>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {st.scenarios.map((s) => (
              <li key={s.id} id={s.id} className={`scroll-mt-6 rounded-lg transition-shadow ${highlight === s.id ? HIGHLIGHT : ""}`}>
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
        )}
      </section>
    </>
  );
}

/** 選講義檔與主題。demo 不讀檔內容，只用檔名產生腳本化的草稿。 */
function ImportDialog({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (fileName: string, topicId: TopicId) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<TopicId>(TOPICS[0].id);
  // 每次打開都換一個 key，清掉上次選的檔案
  const [round, setRound] = useState(0);

  const reset = () => {
    setFileName(null);
    setTopicId(TOPICS[0].id);
    setRound((r) => r + 1);
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="匯入過往講義"
      description="AI 會把講義拆成一份新框架的草稿，你審核過才會收進知識庫。"
      submitLabel="開始拆解"
      submitDisabled={fileName === null}
      onSubmit={() => {
        if (!fileName) return;
        onImport(fileName, topicId);
        reset();
      }}
    >
      <Field label="講義檔案" hint="支援 PDF、PowerPoint、Word、Markdown">
        <TextInput
          key={round}
          type="file"
          accept={IMPORT_ACCEPT}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </Field>
      <Field label="主題">
        <Select value={topicId} onChange={(e) => setTopicId(e.target.value as TopicId)}>
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}

function FrameworkCard({ st, framework: f, highlighted }: { st: DemoState; framework: Framework; highlighted: boolean }) {
  const latest = latestFrameworkVersion(f);
  const versions = [...f.versions].sort((a, b) => b.version - a.version);
  const users = st.courses.filter((c) => c.source?.frameworkId === f.id);

  return (
    <article id={f.id} className={`${CARD} scroll-mt-6 p-5 transition-shadow ${highlighted ? HIGHLIGHT : ""}`}>
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
                const from = v.fromCourseId ? getCourse(st, v.fromCourseId) : undefined;
                return (
                  <li key={v.version} className="flex gap-2.5">
                    <span className="w-8 shrink-0 font-bold text-navy">v{v.version}</span>
                    <span className="min-w-0">
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
