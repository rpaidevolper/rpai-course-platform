import { openItems, unitPlace } from "@/lib/blueprint/open-items";
import {
  BlueprintSchema,
  checkBlueprint,
  FIVE_ELEMENT_LABELS,
  missingElements,
  plannedMinutes,
  REUSE_LABELS,
  TOOL_PLAN_LABELS,
  type Blueprint,
  type FiveElement,
  type OpenQuestion,
  type ReuseLevel,
  type Slot,
  type SlotLocation,
  type ToolPlan,
  type Unit,
} from "@/lib/blueprint/schema";

/**
 * 可互動 demo（#48）的藍圖對話腳本。不呼叫任何 AI：
 * 依目前藍圖缺什麼排出要問的題目，講師回一句就問下一題；
 * 「更新藍圖」時把缺的五元素、待確認事項、時段時間不符、要改／新做的單元都處理掉，產出新的一版。
 * 純函式、可決定（同樣輸入同樣輸出），方便測試。
 */

export interface ChatMessage {
  role: "instructor" | "assistant";
  text: string;
}

/**
 * 藍圖裡還要跟講師談的事，依 checkBlueprint 的順序排列。
 * 開場、每一句回覆、更新藍圖都用同一份清單，第 i 句話才會對到第 i 題。
 * 純講述單元（lecture_only）是設計提醒、不是缺項，不問。
 */
type Gap =
  | { kind: "element"; element: FiveElement }
  | ({ kind: "duration"; planned: number; expected: number } & SlotLocation)
  | ({ kind: "unit"; unit: string; reuse: Exclude<ReuseLevel, "reuse"> } & SlotLocation)
  | { kind: "question"; question: OpenQuestion }
  | { kind: "tool"; tool: string; plan: ToolPlan };

function gapsOf(bp: Blueprint): Gap[] {
  return checkBlueprint(bp).flatMap((issue): Gap[] => {
    switch (issue.kind) {
      case "missing_element":
        return [{ kind: "element", element: issue.element }];
      case "duration_mismatch":
        return [{ kind: "duration", day: issue.day, slot: issue.slot, planned: issue.planned, expected: issue.expected }];
      case "unit_needs_work":
        return [{ kind: "unit", day: issue.day, slot: issue.slot, unit: issue.unit, reuse: issue.reuse }];
      case "open_question":
        return [{ kind: "question", question: { text: issue.text, audience: issue.audience, unit: issue.unit } }];
      case "unconfirmed_tool":
        return [{ kind: "tool", tool: issue.tool, plan: issue.plan }];
      case "lecture_only":
        return [];
    }
  });
}

const ELEMENT_PROMPTS: Record<FiveElement, string> = {
  theory: "這場課背後的核心觀念是什麼？學員要先懂哪個原則，後面的練習才接得上？",
  handsOn: "學員在課堂上要動手做什麼？最好是拿他們自己工作上的資料來練。",
  takeaway: "學員離場時要帶走什麼？一張清單、一份範本，還是一個做好的成品？",
  quote: "有沒有一句你希望學員記住、回去會轉述給同事的話？",
  story: "有沒有一個真實的案例或故事，可以讓學員看到改變前後的差別？",
};

const slotName = (bp: Blueprint, at: SlotLocation) => `第 ${at.day} 天${bp.days[at.day - 1].slots[at.slot - 1].label}`;

function askAbout(bp: Blueprint, gap: Gap): string {
  switch (gap.kind) {
    case "element":
      return `先補「${FIVE_ELEMENT_LABELS[gap.element]}」：${ELEMENT_PROMPTS[gap.element]}`;
    case "duration":
      return `${slotName(bp, gap)}的單元加總是 ${gap.planned} 分鐘，但時段是 ${gap.expected} 分鐘。我先照比例把單元時間調到剛好 ${gap.expected} 分鐘，有哪個單元要特別多留時間嗎？`;
    case "unit":
      return gap.reuse === "new"
        ? `${unitPlace(bp, gap.unit)}是新做的單元，這段你想帶學員做到什麼？重點有哪些？`
        : `${unitPlace(bp, gap.unit)}要從來源改過來，這次要改哪裡？`;
    case "question": {
      const who = gap.question.audience === "client" ? "要問客戶" : "要你決定";
      return `藍圖上還有一件${who}的事：「${gap.question.text}」，現在有答案了嗎？`;
    }
    case "tool":
      return `學員要用 ${gap.tool}（${TOOL_PLAN_LABELS[gap.plan]}），客戶那邊確認過大家都有這個方案了嗎？`;
  }
}

/** 對話開場：盤點目前藍圖缺什麼，並問第一題 */
export function openingMessage(bp: Blueprint): ChatMessage {
  const gaps = gapsOf(bp);
  if (gaps.length === 0) {
    return {
      role: "assistant",
      text: `「${bp.title}」的藍圖目前很完整：五元素齊全、沒有待確認事項，單元也都可以直接沿用。\n想調整哪裡？例如換一個案例、改單元時間，或補一段練習，直接告訴我。`,
    };
  }

  const lines = [`我看了「${bp.title}」目前的藍圖，還有幾件事要跟你談：`];
  const missing = missingElements(bp).map((e) => FIVE_ELEMENT_LABELS[e]);
  if (missing.length > 0) lines.push(`・五元素還缺：${missing.join("、")}`);
  const durations = gaps.filter((g) => g.kind === "duration");
  if (durations.length > 0) {
    lines.push(`・時段時間對不上：${durations.map((g) => `${slotName(bp, g)}（單元加總 ${g.planned}／時段 ${g.expected} 分鐘）`).join("、")}`);
  }
  const units = gaps.filter((g) => g.kind === "unit");
  if (units.length > 0) {
    const count = (reuse: Exclude<ReuseLevel, "reuse">) => units.filter((g) => g.reuse === reuse).length;
    const parts = (["modify", "new"] as const).filter((r) => count(r) > 0).map((r) => `${REUSE_LABELS[r]} ${count(r)} 個`);
    lines.push(`・單元還要準備：${parts.join("、")}`);
  }
  const items = openItems(bp);
  if (items.length > 0) lines.push(`・待確認事項 ${items.length} 件：${items.map((i) => `「${i.text}」`).join("、")}`);
  lines.push("", "我們一件一件來。", askAbout(bp, gaps[0]));
  return { role: "assistant", text: lines.join("\n") };
}

function snippet(text: string, max = 24): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * 講師第 turn 次（從 0 起算）發話後的 AI 回覆。
 * 開場已經問了第 0 題，所以第 turn 次回覆接著問第 turn + 1 題；題目問完就提示按「更新藍圖」。
 */
export function scriptedReply(bp: Blueprint, turn: number, message: string): ChatMessage {
  const gaps = gapsOf(bp);
  const said = snippet(message);
  const ack = said ? `收到，「${said}」這點我記下了。` : "收到。";
  const next = gaps[turn + 1];
  if (next) return { role: "assistant", text: `${ack}\n\n接著，${askAbout(bp, next)}` };
  return {
    role: "assistant",
    text: `${ack}\n\n目前談的已經足夠了。按「更新藍圖」，我會把這些整理成新的一版；之後產出的教材都會讀新版。`,
  };
}

const unique = (items: string[]) => [...new Set(items)];
const PLACEHOLDER = "待跟 AI 談";

/** 把時段內各單元的分鐘數照比例調到剛好等於時段長度；最後一個單元吸收零頭。 */
function fitUnits(slot: Slot): void {
  const planned = plannedMinutes(slot);
  if (planned === slot.minutes) return;
  const last = slot.units.length - 1;
  slot.units.forEach((u, i) => {
    if (i < last) u.minutes = Math.max(1, Math.floor((u.minutes * slot.minutes) / planned));
  });
  const rest = slot.units.slice(0, last).reduce((sum, u) => sum + u.minutes, 0);
  slot.units[last].minutes = Math.max(1, slot.minutes - rest);
}

/**
 * 依對話整理出新的一版藍圖（不改動輸入）。
 * 對話照 gapsOf 的順序一題一題問（開場問第 0 題，第 i 句回答第 i 題），
 * 所以講師第 i 句話就填進第 i 個缺口；沒回答到的缺口用預設內容補齊：
 * - 缺的五元素補上，並標到一個單元上；
 * - 時段時間不符：單元分鐘數照比例調到等於時段長度；
 * - 要改／新做的單元：在對話裡改過了，標成沿用，佔位文字換成實際內容；
 * - 待確認事項記成已確認的限制、清空；未確認的工具標成已確認。
 * 沒有缺口時，把講師最後一句話記成補充。回傳前會通過 BlueprintSchema 驗證。
 */
export function reviseBlueprint(bp: Blueprint, instructorMessages: string[]): Blueprint {
  const said = instructorMessages.map((m) => m.trim()).filter((m) => m.length > 0);
  const gaps = gapsOf(bp);
  /** 講師對某個缺口的回答；沒問到就是 undefined */
  const answerTo = (match: (g: Gap) => boolean) => {
    const i = gaps.findIndex(match);
    return i >= 0 ? said[i] : undefined;
  };
  const next: Blueprint = structuredClone(bp);
  // 以下直接改 next 裡的單元物件
  const allUnits = next.days.flatMap((d) => d.slots.flatMap((s) => s.units));
  const firstUnit = next.days[0].slots[0].units[0];
  const lastDay = next.days[next.days.length - 1];
  const lastSlot = lastDay.slots[lastDay.slots.length - 1];
  const lastUnit = lastSlot.units[lastSlot.units.length - 1];
  const shortTitle = bp.title.split("：")[0];
  const pain = bp.audience.painPoints[0];

  // 五元素
  const defaults: Record<FiveElement, string> = {
    theory: `${shortTitle}的三個核心原則：先定義產出、再拆步驟、最後驗證`,
    handsOn: allUnits.find((u) => u.activity)?.activity ?? `用自己的工作資料完成「${firstUnit.title}」練習`,
    takeaway: `${shortTitle}課後檢核清單`,
    quote: "工具不是重點，把你的時間拿回來才是",
    story: `學員案例：原本「${pain}」，課後一週就改用新做法`,
  };
  const home: Record<FiveElement, Unit> = { theory: firstUnit, handsOn: firstUnit, takeaway: lastUnit, quote: lastUnit, story: firstUnit };
  for (const element of missingElements(bp)) {
    const a = answerTo((g) => g.kind === "element" && g.element === element);
    const text = a ? snippet(a, 60) : defaults[element];
    next.elements[element] = [text];
    const u = home[element];
    if (!u.elements.includes(element)) u.elements = [...u.elements, element];
    if (element === "handsOn" && u.activity === null) u.activity = text;
  }

  // 時段時間
  for (const day of next.days) for (const slot of day.slots) fitUnits(slot);

  // 要改／新做的單元：講師在對話裡交代了重點，視為已改好
  for (const u of allUnits) {
    if (u.reuse !== "reuse") {
      const a = answerTo((g) => g.kind === "unit" && g.unit === u.title);
      const kept = u.keyPoints.filter((k) => k !== PLACEHOLDER);
      if (a) u.keyPoints = unique([...kept, snippet(a, 40)]);
      u.reuse = "reuse";
    }
    if (u.keyPoints.every((k) => k === PLACEHOLDER)) u.keyPoints = [`${u.title}的核心觀念`, "現場練習與討論"];
    if (u.outcome === PLACEHOLDER) u.outcome = `完成「${u.title}」的練習成品`;
  }

  // 受眾：起始草稿的佔位
  if (next.audience.priorKnowledge === "待確認") {
    next.audience.priorKnowledge = "會用 Office 與瀏覽器，沒有固定的 AI 用法";
  }
  if (next.audience.size === null) next.audience.size = 20;

  // 待確認事項與工具
  const confirmed = bp.openQuestions.map((q) => {
    const a = answerTo((g) => g.kind === "question" && g.question.text === q.text);
    return a ? `已確認「${q.text}」：${snippet(a, 30)}` : `已確認「${q.text}」`;
  });
  const tools = bp.tools
    .filter((t) => !t.confirmedWithClient)
    .map((t) => {
      const a = answerTo((g) => g.kind === "tool" && g.tool === t.name);
      const base = `已跟客戶確認學員可用 ${t.name}（${TOOL_PLAN_LABELS[t.plan]}）`;
      return a ? `${base}：${snippet(a, 30)}` : base;
    });
  next.constraints = unique([...next.constraints, ...confirmed, ...tools]);
  next.openQuestions = [];
  next.tools = next.tools.map((t) => ({ ...t, confirmedWithClient: true }));

  const last = said[said.length - 1];
  if (gaps.length === 0 && last) {
    next.constraints = unique([...next.constraints, `講師補充：${snippet(last, 40)}`]);
  }

  return BlueprintSchema.parse(next);
}

/** 版本紀錄用的一句話：這一版改了什麼 */
export function revisionNote(before: Blueprint, after: Blueprint): string {
  const parts: string[] = [];
  const added = missingElements(before)
    .filter((e) => after.elements[e].length > 0)
    .map((e) => FIVE_ELEMENT_LABELS[e]);
  if (added.length > 0) parts.push(`補上${joinAnd(added)}`);

  const resolved = openItems(before).length - openItems(after).length;
  if (resolved > 0) parts.push(`確認 ${resolved} 件待確認事項`);

  const mismatched = (bp: Blueprint) => checkBlueprint(bp).filter((i) => i.kind === "duration_mismatch").length;
  const fitted = mismatched(before) - mismatched(after);
  if (fitted > 0) parts.push(`${fitted} 個時段的單元時間對齊時段長度`);

  const needWork = (bp: Blueprint) => checkBlueprint(bp).filter((i) => i.kind === "unit_needs_work").length;
  const reworked = needWork(before) - needWork(after);
  if (reworked > 0) parts.push(`改好 ${reworked} 個要改／新做的單元`);

  if (parts.length === 0 && after.constraints.length > before.constraints.length) parts.push("記下講師補充");
  return parts.length > 0 ? parts.join("、") : "依對話調整細節";
}

/** 「A」「A與B」「A、B與C」 */
function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("、")}與${items[items.length - 1]}`;
}
