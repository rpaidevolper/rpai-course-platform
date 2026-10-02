"use client";

import { useState } from "react";
import { useDemoState } from "@/lib/mockup/store";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ClientContext, type Project, type ProjectStatus } from "@/lib/mockup/types";
import { Dialog } from "../../_components/dialog";
import { Field, Select, TextArea, TextInput } from "../../_components/ui";

export type ProjectFormValues = { title: string; status: ProjectStatus; priceTwd: number; clientContext: ClientContext };

/**
 * 新增／編輯專案的對話框（#48）。只在要開的時候掛上，關掉就卸載，每次打開都是乾淨的表單。
 * 客戶品牌不在這裡編輯：新專案預設沿用 RPAI 品牌，編輯時保留原值。
 */
export function ProjectDialog({
  project,
  onClose,
  onSubmit,
}: {
  /** 有給就是編輯，表單帶入現值 */
  project?: Project;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const st = useDemoState();
  const ctx = project?.clientContext;
  const [title, setTitle] = useState(project?.title ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "negotiating");
  const [price, setPrice] = useState(project ? String(project.priceTwd) : "");
  const [company, setCompany] = useState(ctx?.company ?? "");
  const [industry, setIndustry] = useState(ctx?.industry ?? "");
  const [goal, setGoal] = useState(ctx?.goal ?? "");
  const [scenarioId, setScenarioId] = useState(ctx?.scenarioId ?? st.scenarios[0]?.id ?? "");
  const [itConstraints, setItConstraints] = useState(ctx?.itConstraints.join("\n") ?? "");

  const priceTwd = Number(price);
  const valid =
    title.trim() !== "" &&
    company.trim() !== "" &&
    industry.trim() !== "" &&
    goal.trim() !== "" &&
    scenarioId !== "" &&
    price.trim() !== "" &&
    Number.isFinite(priceTwd) &&
    priceTwd >= 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={project ? "編輯專案" : "新增專案"}
      description={
        project
          ? "客戶背景的改動只影響之後開的新課程；已經存在的課程藍圖不會跟著變。"
          : "專案是與一個客戶的一次合作，從洽談就開始存在。客戶背景會帶進這個專案底下每一門新課程的藍圖。"
      }
      submitLabel={project ? "儲存" : "建立專案"}
      submitDisabled={!valid}
      onSubmit={() =>
        onSubmit({
          title: title.trim(),
          status,
          priceTwd: Math.round(priceTwd),
          clientContext: {
            company: company.trim(),
            industry: industry.trim(),
            goal: goal.trim(),
            scenarioId,
            itConstraints: itConstraints
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line !== ""),
            brand: ctx?.brand ?? null,
          },
        })
      }
    >
      <Field label="專案名稱">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="例如：2026 秋季 AI 內訓" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="狀態">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="價格（NT$）" hint="只有講師看得到">
          <TextInput type="number" inputMode="numeric" min={0} step={1000} value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="客戶公司">
          <TextInput value={company} onChange={(e) => setCompany(e.target.value)} required />
        </Field>
        <Field label="產業">
          <TextInput value={industry} onChange={(e) => setIndustry(e.target.value)} required />
        </Field>
      </div>
      <Field label="培訓目標">
        <TextArea value={goal} onChange={(e) => setGoal(e.target.value)} required />
      </Field>
      <Field label="情境" hint="AI 談新課程的藍圖時，會套用這個情境的案例與練習。">
        <Select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} required>
          {st.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}（{s.industry}）
            </option>
          ))}
        </Select>
      </Field>
      <Field label="IT 限制" hint="一行一條，例如「不能安裝桌面版軟體」。新課程的藍圖會帶入這些限制。">
        <TextArea value={itConstraints} onChange={(e) => setItConstraints(e.target.value)} />
      </Field>
    </Dialog>
  );
}
