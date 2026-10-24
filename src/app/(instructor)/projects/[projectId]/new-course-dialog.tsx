"use client";

import { useState } from "react";
import { compositionWarnings, compositionWarningText } from "@/lib/mockup/composition";
import { chosenModuleCards } from "@/lib/mockup/actions";
import { getIndustryPack, latestModuleCardVersion, moduleLabel } from "@/lib/mockup/logic";
import { useDemoState } from "@/lib/mockup/store";
import { MODULES, type ModuleId, type Project } from "@/lib/mockup/types";
import { Dialog } from "../../../_components/dialog";
import { Field, Select, TextInput } from "../../../_components/ui";

const NO_B = "";

/** 總時數的選項（小時）：對應規格標籤的各檔，標籤由總時數推得、不另存 */
const HOUR_OPTIONS: { hours: number; label: string }[] = [
  { hours: 2, label: "2 小時（短講座）" },
  { hours: 3, label: "3 小時（半日）" },
  { hours: 6, label: "6 小時（一日）" },
  { hours: 12, label: "12 小時（兩日）" },
  { hours: 18, label: "18 小時（系列班）" },
  { hours: 30, label: "30 小時（長期班）" },
];

export type NewCourseValues = { title: string; moduleIds: ModuleId[]; totalHours: number; industryPackId: string | null };

const A_MODULES = MODULES.filter((m) => m.kind === "A");
const B_MODULES = MODULES.filter((m) => m.kind === "B");

/**
 * 在專案底下開新課程（#48、#58）。名稱＋總時數＋A 模組（多選）＋B 模組（建議選 1 個定錨）＋產業。
 * 藍圖依 ADR 0002 從所選模組卡與產業素材包複製內容出生。組課提醒只提醒、不擋建立。只在要開的時候掛上。
 */
export function NewCourseDialog({
  project,
  onClose,
  onSubmit,
}: {
  project: Project;
  onClose: () => void;
  onSubmit: (values: NewCourseValues) => void;
}) {
  const st = useDemoState();
  const [title, setTitle] = useState("");
  const [totalHours, setTotalHours] = useState(6);
  const [aIds, setAIds] = useState<ModuleId[]>([]);
  const [bId, setBId] = useState<string>(NO_B);
  const [industryPackId, setIndustryPackId] = useState(project.clientContext.industryPackId);

  const moduleIds = [...aIds, ...(bId === NO_B ? [] : [bId as ModuleId])];
  const cards = chosenModuleCards(st, moduleIds);
  const warnings = compositionWarnings({ moduleIds, totalHours });
  const pack = getIndustryPack(st, industryPackId);
  const valid = title.trim() !== "" && pack !== undefined;
  const itNote = project.clientContext.itConstraints.length > 0 ? `客戶的 ${project.clientContext.itConstraints.length} 條 IT 限制也會一併複製進藍圖。` : "";
  const toggleA = (id: ModuleId) => setAIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const versionOf = (id: ModuleId) => {
    const card = st.moduleCards.find((c) => c.moduleId === id);
    return card ? `（v${latestModuleCardVersion(card)}）` : "";
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="在這個專案開新課程"
      description={`AI 會先把「${project.clientContext.company}」的客戶背景帶進新藍圖，接著跟你把缺的部分談完。`}
      submitLabel="開課程並開始談藍圖"
      submitDisabled={!valid}
      onSubmit={() => onSubmit({ title: title.trim(), moduleIds, totalHours, industryPackId: pack?.id ?? null })}
    >
      <Field label="課程名稱">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="例如：Claude 入門工作坊" />
      </Field>
      <Field label="總時數" hint="藍圖的總長就是這個數字，規格（短講座、半日、一日…）由它推得。">
        <Select value={totalHours} onChange={(e) => setTotalHours(Number(e.target.value))}>
          {HOUR_OPTIONS.map((o) => (
            <option key={o.hours} value={o.hours}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset>
        <legend className="text-xs font-bold text-body-muted">A 模組：學員課堂上打開的環境（可多選）</legend>
        <div className="mt-1 grid gap-1">
          {A_MODULES.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" checked={aIds.includes(m.id)} onChange={() => toggleA(m.id)} />
              {moduleLabel(m.id)}
              <span className="text-xs text-body-muted">{versionOf(m.id)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold text-body-muted">B 模組：不綁工具的方法（建議選 1 個當定錨）</legend>
        <div className="mt-1 grid gap-1">
          {B_MODULES.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-navy">
              <input type="radio" name="b-module" checked={bId === m.id} onChange={() => setBId(m.id)} />
              {moduleLabel(m.id)}
              <span className="text-xs text-body-muted">{versionOf(m.id)}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-navy">
            <input type="radio" name="b-module" checked={bId === NO_B} onChange={() => setBId(NO_B)} />
            先不選 B 模組
          </label>
        </div>
      </fieldset>
      <Field label="產業素材包" hint="預設是客戶背景選定的素材包。">
        <Select value={industryPackId} onChange={(e) => setIndustryPackId(e.target.value)} required>
          {st.industryPacks.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}（{s.industry}）
            </option>
          ))}
        </Select>
      </Field>
      {warnings.length > 0 && (
        <ul role="status" aria-label="組課提醒" className="grid gap-1 rounded-md bg-warning-tint px-3 py-2 text-xs text-warning">
          {warnings.map((w) => (
            <li key={w.kind}>{compositionWarningText(w)}</li>
          ))}
          <li className="text-body-muted">這些只是提醒，仍然可以開課程。</li>
        </ul>
      )}
      <p className="rounded-md bg-iced px-3 py-2 text-xs">
        {cards.length > 0 && pack
          ? `藍圖會依序從模組卡${cards.map((c) => `「${moduleLabel(c.moduleId)}」v${latestModuleCardVersion(c)}`).join("、")}的核心單元骨架，加上產業素材包「${pack.title}」複製內容出生；之後模組卡升版，這門課的藍圖不會跟著變。`
          : "沒選任何模組：藍圖會從零開始，只帶入客戶背景與素材包的受眾；之後一樣可以跟 AI 談。"}
        {itNote}
      </p>
    </Dialog>
  );
}
