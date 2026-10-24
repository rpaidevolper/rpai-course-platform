"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { makeId } from "@/lib/mockup/actions";
import { closingGate, isCourseClosed } from "@/lib/mockup/closing";
import { filterRecipes, filterUnitCards, hasFilter, noFilter } from "@/lib/mockup/browse";
import { IMPORT_ACCEPT, importProposals } from "@/lib/mockup/import-script";
import {
  getModule,
  getModuleCard,
  latestModuleCardVersion,
  moduleLabel,
  pendingDrafts,
  recipeMinutes,
  recipeModules,
  recipeUnitCards,
} from "@/lib/mockup/logic";
import type { DemoState } from "@/lib/mockup/state";
import { recipeSpec } from "@/lib/mockup/tags";
import { dispatch, useDemoState } from "@/lib/mockup/store";
import { MODULES, RECIPE_STATUS_LABELS, type ModuleId, type UnitCard } from "@/lib/mockup/types";
import { Dialog } from "../../_components/dialog";
import { toast } from "../../_components/demo-runtime";
import { TagList } from "../../_components/tags";
import { Badge, Button, Card, CARD, EMPHASIS, Empty, Field, FieldLabel, PageHeader, SectionTitle, Select, TextInput } from "../../_components/ui";
import { CardDetailDialog, type OpenCard } from "./card-details";
import { BrowseFilter } from "./browse-filter";
import { DraftCard } from "./draft-card";

/** 假裝 AI 拆解講義要花的時間 */
const IMPORT_MS = 1500;
const HIGHLIGHT_MS = 2400;
const HIGHLIGHT = "ring-2 ring-accent";

/** 知識庫：待審核草稿 > 模組卡（依模組分組，附單元卡） > 課程配方 > 產業素材包。 */
export function KnowledgeView() {
  const st = useDemoState();
  const drafts = pendingDrafts(st);
  // 結案閘全過、還沒結案的課程：空草稿區指給講師看從哪裡產生草稿
  const closable = st.courses.find((c) => !isCourseClosed(c) && closingGate(st, c, st.now).canClose);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  const [filter, setFilter] = useState(noFilter);
  const units = filterUnitCards(st, filter);
  const recipes = filterRecipes(st, filter);
  // 有設條件時，只留下選了的模組或有符合單元卡的模組
  const visibleModules = MODULES.filter((m) => !hasFilter(filter) || filter.moduleIds.includes(m.id) || units.some((u) => u.moduleId === m.id));

  // 審核後捲到被改動的模組卡、課程配方或產業素材包，短暫標出來
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

  const startImport = (fileName: string, moduleId: ModuleId) => {
    setImportOpen(false);
    setImporting(fileName);
    importTimer.current = setTimeout(() => {
      importTimer.current = null;
      dispatch({ type: "draft/import", id: makeId("d"), fileName, proposals: importProposals(fileName, moduleId, makeId("rc")) });
      setImporting(null);
      toast("已產生草稿，等你審核");
    }, IMPORT_MS);
  };

  return (
    <>
      <PageHeader
        title="知識庫"
        description="從過去的課整理出來、你確認過的模組卡、單元卡、課程配方與產業素材包。新課程的藍圖從這裡複製內容出生，之後模組卡改版不會動到已經存在的藍圖。"
      >
        <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={importing !== null}>
          匯入過往講義
        </Button>
      </PageHeader>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={startImport} />

      <BrowseFilter value={filter} onChange={setFilter} unitCount={units.length} recipeCount={recipes.length} />

      <section aria-labelledby="drafts-title" className="mb-12">
        <SectionTitle aside="確認後才會收進知識庫">
          <span id="drafts-title">待審核草稿（{drafts.length}）</span>
        </SectionTitle>
        <div aria-live="polite">
          {importing && (
            <p className={`${CARD} ${EMPHASIS} mb-4 p-5 text-sm font-bold text-ink`}>
              <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-accent align-middle" aria-hidden />
              AI 正在拆解講義「{importing}」…
            </p>
          )}
        </div>
        {drafts.length === 0 ? (
          !importing && (
            <Empty>
              目前沒有草稿。課程結案後，內容會拆成待審核的草稿
              {closable ? (
                <>
                  ，例如{" "}
                  <Link href={`/courses/${closable.id}#closing`} className="font-bold text-accent underline underline-offset-2">
                    「{closable.title}」
                  </Link>
                  已可結案：到課程頁按「結案」。
                </>
              ) : (
                "。"
              )}
            </Empty>
          )
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

      <section aria-labelledby="modules-title" className="mb-12">
        <SectionTitle aside="模組卡只在審核課程結案草稿時升版">
          <span id="modules-title">模組卡</span>
        </SectionTitle>
        <p className="mb-5 max-w-2xl text-sm">
          9 個模組各一張模組卡。A 類是學員課堂上打開的環境，彼此互斥；B 類是不綁工具的方法，可以疊加。開新課程時，藍圖從所選模組的模組卡複製內容出生。
        </p>

        <nav aria-label="跳到模組" className="mb-6 flex flex-wrap gap-2">
          {visibleModules.map((m) => (
            <a key={m.id} href={`#module-${m.id}`} className="rounded-md bg-accent-tint px-3 py-1.5 text-sm font-bold text-ink hover:bg-accent-tint-hover">
              {moduleLabel(m.id)}（{units.filter((u) => u.moduleId === m.id).length}）
            </a>
          ))}
        </nav>

        <div className="space-y-10">
          {visibleModules.length === 0 && <Empty>沒有符合條件的單元卡。</Empty>}
          {visibleModules.map((m) => (
            <ModuleSection key={m.id} st={st} moduleId={m.id} units={units.filter((u) => u.moduleId === m.id)} filtered={hasFilter(filter)} highlighted={highlight === `module-${m.id}`} onOpen={setOpenCard} />
          ))}
        </div>
      </section>

      <section aria-labelledby="recipes-title" className="mb-12">
        <SectionTitle aside="一門過去課程的骨架，不是藍圖">
          <span id="recipes-title">課程配方（{recipes.length}）</span>
        </SectionTitle>
        {recipes.length === 0 ? (
          <Empty>{st.recipes.length === 0 ? "還沒有課程配方。課程結案、審核通過草稿後，會出現在這裡。" : "沒有符合條件的課程配方。"}</Empty>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {recipes.map((r) => (
              <li key={r.id} id={r.id} className={`rounded-lg transition-shadow ${highlight === r.id ? HIGHLIGHT : ""}`}>
                <Card className="h-full">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="min-w-0 text-base font-bold text-ink">{r.title}</h3>
                    <Badge tone="outline">{RECIPE_STATUS_LABELS[r.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    {recipeUnitCards(st, r).length} 個單元・{recipeMinutes(st, r)} 分鐘
                  </p>
                  <div className="mt-2">
                    <TagList tags={r} spec={recipeSpec(st, r)} />
                  </div>
                  <p className="mt-1 text-sm text-body-muted">{recipeModules(st, r).map(moduleLabel).join("、")}</p>
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => setOpenCard({ kind: "recipe", id: r.id })}>
                      打開課程配方
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="packs-title">
        <SectionTitle aside="一份藍圖只套用一個產業素材包">
          <span id="packs-title">產業素材包</span>
        </SectionTitle>
        {st.industryPacks.length === 0 ? (
          <Empty>還沒有產業素材包。</Empty>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {st.industryPacks.map((s) => (
              <li key={s.id} id={s.id} className={`rounded-lg transition-shadow ${highlight === s.id ? HIGHLIGHT : ""}`}>
                <Card className="h-full">
                  <h3 className="text-base font-bold text-ink">{s.title}</h3>
                  <div className="mt-2">
                    <TagList tags={s} />
                  </div>
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
                      <dd className="mt-1 text-sm text-ink">
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

      <CardDetailDialog st={st} open={openCard} onOpen={setOpenCard} onClose={() => setOpenCard(null)} />
    </>
  );
}

/** 選講義檔與模組。demo 不讀檔內容，只用檔名產生腳本化的草稿。 */
function ImportDialog({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (fileName: string, moduleId: ModuleId) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<ModuleId>(MODULES[0].id);
  // 每次打開都換一個 key，清掉上次選的檔案
  const [round, setRound] = useState(0);

  const reset = () => {
    setFileName(null);
    setModuleId(MODULES[0].id);
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
      description="AI 會把講義拆成單元卡與一份課程配方的草稿，你審核過才會收進知識庫。"
      submitLabel="開始拆解"
      submitDisabled={fileName === null}
      onSubmit={() => {
        if (!fileName) return;
        onImport(fileName, moduleId);
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
      <Field label="模組">
        <Select value={moduleId} onChange={(e) => setModuleId(e.target.value as ModuleId)}>
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {moduleLabel(m.id)}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}

/** 一個模組：標題、模組卡摘要，以及這個模組底下的單元卡。 */
function ModuleSection({ st, moduleId, units, filtered, highlighted, onOpen }: { st: DemoState; moduleId: ModuleId; units: UnitCard[]; filtered: boolean; highlighted: boolean; onOpen: (card: OpenCard) => void }) {
  const mod = getModule(moduleId);
  const card = getModuleCard(st, moduleId);
  return (
    <section id={`module-${moduleId}`} aria-labelledby={`module-title-${moduleId}`}>
      <h3 id={`module-title-${moduleId}`} className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold text-ink">
        {moduleLabel(moduleId)}
        <Badge tone="outline">{mod.kind === "A" ? "A 學員打開的環境" : "B 方法"}</Badge>
      </h3>
      {card ? (
        <article className={`${CARD} p-5 transition-shadow ${highlighted ? HIGHLIGHT : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="min-w-0 text-base font-bold text-ink">模組卡 {moduleLabel(moduleId)}</h4>
            <Badge tone="outline">目前 v{latestModuleCardVersion(card)}</Badge>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm">{card.summary}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => onOpen({ kind: "module", id: moduleId })}>
              打開模組卡
            </Button>
          </div>
        </article>
      ) : (
        <Empty>這個模組還沒有模組卡。</Empty>
      )}
      <div className="mt-4">
        <FieldLabel>單元卡（{units.length}）</FieldLabel>
        {units.length === 0 ? (
          <p className="mt-1.5 text-sm text-body-muted">{filtered ? "沒有符合條件的單元卡。" : "這個模組還沒有單元卡。"}</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {units.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onOpen({ kind: "unit", id: u.id })}
                  className="rounded-md bg-card px-3 py-1.5 text-left text-sm text-ink shadow-[0_1px_6px_rgba(1,20,85,0.08)] hover:bg-accent-tint"
                >
                  {u.title}（{u.minutes} 分）
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
