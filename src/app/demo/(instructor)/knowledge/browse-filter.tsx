"use client";

import { hasFilter, noFilter, type KnowledgeFilter } from "@/lib/mockup/browse";
import { moduleLabel } from "@/lib/mockup/logic";
import { SPECS, toggleTag } from "@/lib/mockup/tags";
import { MODULES } from "@/lib/mockup/types";
import { TagPicker } from "../../_components/tags";
import { Button, CARD, TextInput } from "@/app/_components/ui";

/**
 * 知識庫的篩選與搜尋：關鍵字、模組、四組標籤、規格。
 * 不同條件之間是「而且」，同一組內多選是「或」。篩選條件是畫面狀態，不存進 demo 狀態。
 */
export function BrowseFilter({ value, onChange, unitCount, recipeCount }: { value: KnowledgeFilter; onChange: (next: KnowledgeFilter) => void; unitCount: number; recipeCount: number }) {
  return (
    <section aria-labelledby="browse-title" className={`${CARD} mb-10 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="browse-title" className="text-base font-bold text-navy">
          找單元卡與課程配方
        </h2>
        {hasFilter(value) && (
          <Button variant="secondary" onClick={() => onChange(noFilter())}>
            清除條件
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm">
        不同條件要同時符合；同一組裡多選，符合其中一個就算。關鍵字用空白隔開時，每個詞都要出現。
      </p>

      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="text-xs font-bold text-body-muted">關鍵字</span>
          <TextInput
            type="search"
            value={value.keyword}
            onChange={(e) => onChange({ ...value, keyword: e.target.value })}
            placeholder="標題、目標、成果、客戶、工具…"
          />
        </label>

        <fieldset>
          <legend className="text-xs font-bold text-body-muted">模組（可多選）</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {MODULES.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 text-sm text-navy">
                <input type="checkbox" checked={value.moduleIds.includes(m.id)} onChange={() => onChange({ ...value, moduleIds: toggleTag(value.moduleIds, m.id) })} />
                {moduleLabel(m.id)}
              </label>
            ))}
          </div>
        </fieldset>

        <TagPicker value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />

        <fieldset>
          <legend className="text-xs font-bold text-body-muted">規格（可多選，只篩課程配方）</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {SPECS.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-navy">
                <input type="checkbox" checked={value.specs.includes(s)} onChange={() => onChange({ ...value, specs: toggleTag(value.specs, s) })} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p role="status" aria-live="polite" className="mt-4 text-sm font-bold text-navy">
        符合的單元卡 {unitCount} 張、課程配方 {recipeCount} 份
      </p>
    </section>
  );
}
