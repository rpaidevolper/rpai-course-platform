"use client";

import { useState } from "react";
import { getFramework, getScenario, latestFrameworkVersion } from "@/lib/mockup/logic";
import { useDemoState } from "@/lib/mockup/store";
import { TOPICS, type Project } from "@/lib/mockup/types";
import { Dialog } from "../../../_components/dialog";
import { Field, Select, TextInput } from "../../../_components/ui";

const FROM_SCRATCH = "";

export type NewCourseValues = { title: string; frameworkId: string | null; scenarioId: string | null };

/** 在專案底下開新課程（#48）。藍圖依 ADR 0002 從框架與情境複製內容出生。只在要開的時候掛上。 */
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
  const [frameworkId, setFrameworkId] = useState(st.frameworks[0]?.id ?? FROM_SCRATCH);
  const [scenarioId, setScenarioId] = useState(project.clientContext.scenarioId);

  const framework = frameworkId === FROM_SCRATCH ? undefined : getFramework(st, frameworkId);
  const scenario = getScenario(st, scenarioId);
  const valid = title.trim() !== "" && scenario !== undefined;
  const itNote = project.clientContext.itConstraints.length > 0 ? `客戶的 ${project.clientContext.itConstraints.length} 條 IT 限制也會一併複製進藍圖。` : "";

  return (
    <Dialog
      open
      onClose={onClose}
      title="在這個專案開新課程"
      description={`AI 會先把「${project.clientContext.company}」的客戶背景帶進新藍圖，接著跟你把缺的部分談完。`}
      submitLabel="開課程並開始談藍圖"
      submitDisabled={!valid}
      onSubmit={() => onSubmit({ title: title.trim(), frameworkId: framework?.id ?? null, scenarioId: scenario?.id ?? null })}
    >
      <Field label="課程名稱">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="例如：Claude 入門工作坊" />
      </Field>
      <Field label="框架">
        <Select value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)}>
          {TOPICS.map((topic) => {
            const fws = st.frameworks.filter((f) => f.topicId === topic.id);
            if (fws.length === 0) return null;
            return (
              <optgroup key={topic.id} label={topic.label}>
                {fws.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}（目前 v{latestFrameworkVersion(f)}）
                  </option>
                ))}
              </optgroup>
            );
          })}
          <option value={FROM_SCRATCH}>不套用框架，從零開始</option>
        </Select>
      </Field>
      <Field label="情境" hint="預設是客戶背景選定的情境。">
        <Select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} required>
          {st.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}（{s.industry}）
            </option>
          ))}
        </Select>
      </Field>
      <p className="rounded-md bg-iced px-3 py-2 text-xs">
        {framework && scenario
          ? `藍圖會從「${framework.title}」v${latestFrameworkVersion(framework)} 與情境「${scenario.title}」複製內容出生；之後框架升版，這門課的藍圖不會跟著變。`
          : "藍圖會從零開始，只帶入客戶背景與情境的受眾；之後一樣可以跟 AI 談。"}
        {itNote}
      </p>
    </Dialog>
  );
}
