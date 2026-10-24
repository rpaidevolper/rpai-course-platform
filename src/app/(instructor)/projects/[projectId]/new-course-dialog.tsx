"use client";

import { useState } from "react";
import { getIndustryPack, getModuleCard, latestModuleCardVersion, moduleLabel } from "@/lib/mockup/logic";
import { useDemoState } from "@/lib/mockup/store";
import { MODULES, type ModuleId, type Project } from "@/lib/mockup/types";
import { Dialog } from "../../../_components/dialog";
import { Field, Select, TextInput } from "../../../_components/ui";

const FROM_SCRATCH = "";

export type NewCourseValues = { title: string; moduleId: ModuleId | null; industryPackId: string | null };

/**
 * 在專案底下開新課程（#48）。藍圖依 ADR 0002 從模組卡與產業素材包複製內容出生。只在要開的時候掛上。
 * 目前只能選一個模組；A 可多選、B 定錨、產業與組課提醒由 #58 重做。
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
  const [moduleId, setModuleId] = useState<string>(st.moduleCards[0]?.moduleId ?? FROM_SCRATCH);
  const [industryPackId, setIndustryPackId] = useState(project.clientContext.industryPackId);

  const card = moduleId === FROM_SCRATCH ? undefined : getModuleCard(st, moduleId as ModuleId);
  const pack = getIndustryPack(st, industryPackId);
  const valid = title.trim() !== "" && pack !== undefined;
  const itNote = project.clientContext.itConstraints.length > 0 ? `客戶的 ${project.clientContext.itConstraints.length} 條 IT 限制也會一併複製進藍圖。` : "";

  return (
    <Dialog
      open
      onClose={onClose}
      title="在這個專案開新課程"
      description={`AI 會先把「${project.clientContext.company}」的客戶背景帶進新藍圖，接著跟你把缺的部分談完。`}
      submitLabel="開課程並開始談藍圖"
      submitDisabled={!valid}
      onSubmit={() => onSubmit({ title: title.trim(), moduleId: card?.moduleId ?? null, industryPackId: pack?.id ?? null })}
    >
      <Field label="課程名稱">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="例如：Claude 入門工作坊" />
      </Field>
      <Field label="模組">
        <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
          {MODULES.map((m) => {
            const c = getModuleCard(st, m.id);
            return c ? (
              <option key={m.id} value={m.id}>
                {moduleLabel(m.id)}（目前 v{latestModuleCardVersion(c)}）
              </option>
            ) : null;
          })}
          <option value={FROM_SCRATCH}>不套用模組卡，從零開始</option>
        </Select>
      </Field>
      <Field label="產業素材包" hint="預設是客戶背景選定的素材包。">
        <Select value={industryPackId} onChange={(e) => setIndustryPackId(e.target.value)} required>
          {st.industryPacks.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}（{s.industry}）
            </option>
          ))}
        </Select>
      </Field>
      <p className="rounded-md bg-iced px-3 py-2 text-xs">
        {card && pack
          ? `藍圖會從模組卡「${moduleLabel(card.moduleId)}」v${latestModuleCardVersion(card)} 與產業素材包「${pack.title}」複製內容出生；之後模組卡升版，這門課的藍圖不會跟著變。`
          : "藍圖會從零開始，只帶入客戶背景與素材包的受眾；之後一樣可以跟 AI 談。"}
        {itNote}
      </p>
    </Dialog>
  );
}
