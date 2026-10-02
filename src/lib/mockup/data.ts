import { BlueprintSchema } from "@/lib/blueprint/schema";
import type {
  Course,
  Framework,
  KnowledgeDraft,
  Project,
  Scenario,
  Session,
} from "./types";

/**
 * 設計稿（#22）的假資料。一個貫穿全部畫面的例子：
 * 專案「A 公司 2026 AI 培訓」→ 課程「Claude 入門」「Claude 進階」→「Claude 入門」有 10/15、10/22 兩個場次。
 * 不接資料庫、不接 AI。
 */

/** 設計稿的「現在」。所有時間判斷都以它為準，不在畫面上呼叫 new Date()。 */
export const MOCK_NOW = "2026-10-08T10:00:00+08:00";

export const FRAMEWORKS: Framework[] = [
  {
    id: "fw-claude-intro",
    topicId: "claude",
    title: "Claude 入門：把日常文書交給 AI",
    summary: "從一份真實文件出發，學會寫出穩定的提示詞，最後建立自己的 Project。",
    moduleTitles: ["AI 能做什麼、不能做什麼", "提示詞的四個零件", "用 Project 記住工作脈絡", "找出自己的三件事"],
    versions: [
      { version: 1, createdAt: "2026-03-20T18:00:00+08:00", note: "由 2026-03 行政人員工作坊整理", fromCourseId: null },
      { version: 2, createdAt: "2026-06-02T18:00:00+08:00", note: "把 Project 單元提前，動手時間由 60 分加到 120 分", fromCourseId: null },
    ],
  },
  {
    id: "fw-claude-advanced",
    topicId: "claude",
    title: "Claude 進階：串起跨部門的 AI 流程",
    summary: "把單人提效擴大成部門流程：交接文件、審核規則與共用 Project。",
    moduleTitles: ["從個人到部門", "審核規則寫成提示詞", "共用 Project 的權限", "流程上線與維護"],
    versions: [
      { version: 1, createdAt: "2026-07-10T18:00:00+08:00", note: "首版", fromCourseId: null },
    ],
  },
  {
    id: "fw-gas-forms",
    topicId: "gas",
    title: "Google 表單自動化",
    summary: "表單送出後自動彙整、寄信與通知，全程在試算表裡完成。",
    moduleTitles: ["第一支 Apps Script", "表單觸發器", "寄送前的安全網"],
    versions: [
      { version: 1, createdAt: "2026-02-25T18:00:00+08:00", note: "由 2026-02 行政與人資班整理", fromCourseId: null },
    ],
  },
  {
    id: "fw-pa-basics",
    topicId: "power-automate",
    title: "Power Automate 簽核流程",
    summary: "把紙本簽核改成 Teams 一鍵核准，含退回與逾期提醒。",
    moduleTitles: ["雲端流程上手", "核准與退回分支", "逾期提醒", "上線檢查表"],
    versions: [
      { version: 1, createdAt: "2026-01-22T18:00:00+08:00", note: "由 2026-01 財務部工作坊整理", fromCourseId: null },
      { version: 2, createdAt: "2026-04-30T18:00:00+08:00", note: "加入「上線檢查表」單元", fromCourseId: null },
    ],
  },
];

export const SCENARIOS: Scenario[] = [
  {
    id: "sc-manufacturing",
    title: "製造業：生管與品保的日常文書",
    industry: "製造業",
    audience: "生管、品保、業務助理",
    cases: ["把客訴信整理成 8D 報告草稿", "週會記錄變成跨部門待辦", "供應商來信的交期比對"],
    materialNames: ["客訴信範例（去識別化）.docx", "生產週報範本.xlsx"],
  },
  {
    id: "sc-finance-approval",
    title: "金融業：請款與費用簽核",
    industry: "金融業",
    audience: "財務、行政",
    cases: ["差旅費請款從紙本到 Teams", "金額門檻決定簽核層級"],
    materialNames: ["請款單欄位對照.xlsx"],
  },
];

export const PROJECTS: Project[] = [
  {
    id: "p-a-2026",
    title: "A 公司 2026 AI 培訓",
    priceTwd: 360000,
    clientContext: {
      company: "A 公司",
      industry: "精密機械製造",
      goal: "生管、品保與業務助理在年底前，各自完成一個能每天使用的 AI 協作流程。",
      scenarioId: "sc-manufacturing",
    },
  },
  {
    id: "p-b-2026",
    title: "B 公司請款流程數位化",
    priceTwd: 85000,
    clientContext: {
      company: "B 公司",
      industry: "金融服務",
      goal: "差旅與費用請款全面改走 Teams 簽核，財務每月少花兩天對單。",
      scenarioId: "sc-finance-approval",
    },
  },
];

const claudeIntroBlueprint = BlueprintSchema.parse({
  title: "Claude 入門：讓生管與品保把文書交給 AI",
  oneLiner: "讓製造業的內勤人員，一天之內用 Claude 處理自己手上真實的客訴信與週報。",
  audience: {
    who: "A 公司生管、品保與業務助理",
    size: 24,
    priorKnowledge: "每天用 Outlook 與 Excel，用過 ChatGPT 但沒有固定用法",
    painPoints: ["客訴信要整理成 8D 報告很花時間", "週會決議沒人追，下週又重講一次"],
  },
  outcomes: ["用 Claude 把一封客訴信整理成 8D 報告草稿", "建立一個帶有部門規範的 Project", "列出三件明天就能交給 AI 的工作"],
  format: { durationMinutes: 360, mode: "workshop", venue: "A 公司台中廠 3F 訓練教室" },
  narrative: {
    model: "SCQA",
    arc: ["情境：每天被文書追著跑", "衝突：AI 用過，但結果不穩定", "提問：怎樣讓 AI 每次都給對的格式", "解答：提示詞零件加上 Project"],
  },
  elements: {
    theory: ["提示詞的四個零件：角色、任務、格式、範例"],
    handsOn: ["整理一封真實客訴信", "建立部門 Project"],
    takeaway: ["三件事清單", "提示詞小卡"],
    quote: [],
    story: ["品保課長把 8D 報告從兩小時縮到二十分鐘"],
  },
  modules: [
    { title: "AI 能做什麼、不能做什麼", minutes: 60, objective: "分辨哪些工作適合交給 AI", keyPoints: ["生成、整理、比對三種用途", "哪些資料不能上傳"], activity: null, elements: ["theory", "story"] },
    { title: "提示詞的四個零件", minutes: 90, objective: "寫出能穩定產出 8D 草稿的提示詞", keyPoints: ["格式要寫死", "給一個範例勝過十句說明"], activity: "拿一封客訴信改三次提示詞並比較", elements: ["theory", "handsOn"] },
    { title: "用 Project 記住工作脈絡", minutes: 120, objective: "建立一個帶有部門規範與範本的 Project", keyPoints: ["指示與知識檔的分工", "範本放在哪裡"], activity: "建立自己部門的 Project，用它回覆一封供應商來信", elements: ["handsOn", "takeaway"] },
    { title: "找出自己的三件事", minutes: 90, objective: "列出明天就能交給 AI 的三件工作", keyPoints: ["頻率 × 耗時 × 出錯成本", "先做最小的一個"], activity: "填三件事清單並兩兩互評", elements: ["takeaway"] },
  ],
  constraints: ["學員用公司筆電，需事先開通 Claude 帳號", "客訴信需去識別化"],
  openQuestions: [],
});

const claudeAdvancedBlueprint = BlueprintSchema.parse({
  title: "Claude 進階：把個人用法變成部門流程",
  oneLiner: "讓上過入門課的學員，把自己的 AI 用法變成整個部門都能接手的流程。",
  audience: {
    who: "上過入門課的 A 公司生管與品保主管",
    size: 12,
    priorKnowledge: "已能寫穩定的提示詞並使用 Project",
    painPoints: ["個人用得好，但同事接不起來", "不知道哪些規則該寫進共用 Project"],
  },
  outcomes: ["把一個個人流程寫成部門可交接的說明", "建立部門共用的審核規則提示詞"],
  format: { durationMinutes: 180, mode: "workshop", venue: null },
  narrative: { model: "PDCA", arc: ["盤點入門課後的用法", "挑一個流程擴大到部門", "寫成規則並試跑", "訂出維護方式"] },
  elements: {
    theory: ["流程交接的三個層次"],
    handsOn: ["把審核規則寫成提示詞並互測"],
    takeaway: ["部門流程交接範本"],
    quote: ["流程不是寫給 AI 看的，是寫給下一個同事看的"],
    story: [],
  },
  modules: [
    { title: "從個人到部門", minutes: 40, objective: "盤點入門課後各自的用法", keyPoints: ["誰在用、用在哪"], activity: "分組分享一個成功與一個失敗", elements: ["theory"] },
    { title: "審核規則寫成提示詞", minutes: 90, objective: "寫出部門共用的審核規則", keyPoints: ["規則要能被驗證"], activity: "兩組互相測對方的規則", elements: ["handsOn", "quote"] },
    { title: "流程上線與維護", minutes: 50, objective: "訂出流程的負責人與更新方式", keyPoints: ["誰改規則、多久檢查一次"], activity: null, elements: ["takeaway"] },
  ],
  constraints: ["需在入門課所有場次結束後才能上"],
  openQuestions: ["場地還沒定：台中廠或台北總部", "要不要讓業務部一起來"],
});

const paFinanceBlueprint = BlueprintSchema.parse({
  title: "Power Automate 請款簽核工作坊",
  oneLiner: "讓財務與行政當天就把差旅請款改成 Teams 一鍵核准。",
  audience: {
    who: "B 公司財務與行政人員",
    size: 16,
    priorKnowledge: "熟悉 Microsoft 365，沒做過自動化流程",
    painPoints: ["紙本請款單常卡在主管桌上", "月結時要一張張對單"],
  },
  outcomes: ["建立含核准與退回分支的請款流程", "設定逾期三天自動提醒"],
  format: { durationMinutes: 360, mode: "workshop", venue: "B 公司 8F 大會議室" },
  narrative: { model: "SCQA", arc: ["情境：月結前的對單地獄", "衝突：紙本卡在主管桌上", "提問：能不能讓主管在手機上核准", "解答：Teams 簽核流程"] },
  elements: {
    theory: ["觸發、動作、條件"],
    handsOn: ["建立差旅請款流程", "兩人一組互相送單核准"],
    takeaway: ["上線檢查表"],
    quote: ["簽核慢，從來不是主管懶，是單子找不到主管"],
    story: ["一張請款單在三個樓層之間走了九天"],
  },
  modules: [
    { title: "雲端流程上手", minutes: 60, objective: "建立第一個雲端流程", keyPoints: ["觸發、動作、條件"], activity: "收到郵件就存附件", elements: ["theory", "handsOn"] },
    { title: "核准與退回分支", minutes: 120, objective: "建立含退回原因的簽核流程", keyPoints: ["Approvals 動作", "退回要帶原因"], activity: "兩人一組互相送單核准", elements: ["handsOn", "story"] },
    { title: "逾期提醒", minutes: 90, objective: "逾期三天自動提醒主管", keyPoints: ["排程流程"], activity: "設定提醒並用假資料測試", elements: ["handsOn"] },
    { title: "上線檢查表", minutes: 90, objective: "確認流程可以正式上線", keyPoints: ["權限、例外、負責人"], activity: null, elements: ["takeaway", "quote"] },
  ],
  constraints: ["需要 Power Automate 授權"],
  openQuestions: [],
});

export const COURSES: Course[] = [
  {
    id: "c-claude-intro",
    projectId: "p-a-2026",
    title: "Claude 入門",
    source: { frameworkId: "fw-claude-intro", frameworkVersion: 2, scenarioId: "sc-manufacturing" },
    blueprint: claudeIntroBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-09-12T15:20:00+08:00", note: "由框架 v2 與製造業情境談出初版" },
      { version: 2, createdAt: "2026-09-26T11:05:00+08:00", note: "加入供應商來信案例" },
      { version: 3, createdAt: "2026-10-07T16:40:00+08:00", note: "Project 單元延長到 120 分鐘" },
    ],
    artifacts: [
      { id: "a-ci-outline-1", kind: "outline", version: 1, blueprintVersion: 2, status: "ready", createdAt: "2026-09-27T10:00:00+08:00" },
      { id: "a-ci-slides-1", kind: "slides", version: 1, blueprintVersion: 2, status: "ready", createdAt: "2026-09-28T21:30:00+08:00" },
      { id: "a-ci-handbook-1", kind: "handbook", version: 1, blueprintVersion: 2, status: "ready", createdAt: "2026-09-29T20:10:00+08:00" },
      { id: "a-ci-outline-2", kind: "outline", version: 2, blueprintVersion: 3, status: "ready", createdAt: "2026-10-07T17:00:00+08:00" },
      { id: "a-ci-slides-2", kind: "slides", version: 2, blueprintVersion: 3, status: "ready", createdAt: "2026-10-07T22:15:00+08:00" },
    ],
    materials: [
      { id: "m-ci-complaint", name: "客訴信範例（去識別化）.docx", sizeKb: 48 },
      { id: "m-ci-report", name: "生產週報範本.xlsx", sizeKb: 112 },
    ],
  },
  {
    id: "c-claude-advanced",
    projectId: "p-a-2026",
    title: "Claude 進階",
    source: { frameworkId: "fw-claude-advanced", frameworkVersion: 1, scenarioId: "sc-manufacturing" },
    blueprint: claudeAdvancedBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-10-05T14:00:00+08:00", note: "由框架 v1 談出初版，帶入專案的客戶背景" },
    ],
    artifacts: [],
    materials: [],
  },
  {
    id: "c-pa-finance",
    projectId: "p-b-2026",
    title: "請款簽核工作坊",
    source: { frameworkId: "fw-pa-basics", frameworkVersion: 2, scenarioId: "sc-finance-approval" },
    blueprint: paFinanceBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-08-28T10:00:00+08:00", note: "由框架 v2 與金融業情境談出初版" },
      { version: 2, createdAt: "2026-09-10T09:30:00+08:00", note: "逾期提醒獨立成一個單元" },
    ],
    artifacts: [
      { id: "a-pa-outline-1", kind: "outline", version: 1, blueprintVersion: 2, status: "ready", createdAt: "2026-09-10T12:00:00+08:00" },
      { id: "a-pa-slides-1", kind: "slides", version: 1, blueprintVersion: 2, status: "ready", createdAt: "2026-09-12T22:00:00+08:00" },
      { id: "a-pa-handbook-1", kind: "handbook", version: 1, blueprintVersion: 2, status: "ready", createdAt: "2026-09-13T20:00:00+08:00" },
    ],
    materials: [{ id: "m-pa-fields", name: "請款單欄位對照.xlsx", sizeKb: 36 }],
  },
];

const SLIDO_CI_1015: { label: string; url: string } = { label: "Slido 互動", url: "https://app.sli.do/event/demo-a1015" };
const SLIDO_PA_0918 = { label: "Slido 互動", url: "https://app.sli.do/event/demo-b0918" };
const SLIDO_CA_1105 = { label: "Slido 互動", url: "https://app.sli.do/event/demo-a1105" };

export const SESSIONS: Session[] = [
  {
    id: "s-ci-1015",
    courseId: "c-claude-intro",
    startsAt: "2026-10-15T09:00:00+08:00",
    endsAt: "2026-10-15T16:00:00+08:00",
    venue: "A 公司台中廠 3F 訓練教室",
    links: [SLIDO_CI_1015],
    publication: {
      publishedAt: "2026-10-06T18:00:00+08:00",
      artifactIds: ["a-ci-outline-1", "a-ci-slides-1", "a-ci-handbook-1"],
      materialIds: ["m-ci-complaint", "m-ci-report"],
      links: [SLIDO_CI_1015],
    },
    portal: { code: "a1015", closedAt: null, expiresAtOverride: null },
  },
  {
    id: "s-ci-1022",
    courseId: "c-claude-intro",
    startsAt: "2026-10-22T09:00:00+08:00",
    endsAt: "2026-10-22T16:00:00+08:00",
    venue: "A 公司台中廠 3F 訓練教室",
    links: [],
    publication: null,
    portal: { code: "a1022", closedAt: null, expiresAtOverride: null },
  },
  {
    id: "s-ca-1105",
    courseId: "c-claude-advanced",
    startsAt: "2026-11-05T13:30:00+08:00",
    endsAt: "2026-11-05T16:30:00+08:00",
    venue: null,
    links: [SLIDO_CA_1105],
    publication: null,
    portal: { code: "a1105", closedAt: null, expiresAtOverride: null },
  },
  {
    id: "s-pa-0918",
    courseId: "c-pa-finance",
    startsAt: "2026-09-18T09:30:00+08:00",
    endsAt: "2026-09-18T16:30:00+08:00",
    venue: "B 公司 8F 大會議室",
    links: [SLIDO_PA_0918],
    publication: {
      publishedAt: "2026-09-16T17:00:00+08:00",
      artifactIds: ["a-pa-outline-1", "a-pa-slides-1", "a-pa-handbook-1"],
      materialIds: ["m-pa-fields"],
      links: [SLIDO_PA_0918],
    },
    portal: { code: "b0918", closedAt: null, expiresAtOverride: null },
  },
];

export const KNOWLEDGE_DRAFTS: KnowledgeDraft[] = [
  {
    id: "d-pa-framework",
    fromCourseId: "c-pa-finance",
    createdAt: "2026-09-18T17:00:00+08:00",
    trigger: "auto",
    proposal: {
      kind: "framework_version",
      frameworkId: "fw-pa-basics",
      changes: ["「逾期提醒」從核准單元拆出，獨立 90 分鐘", "上線檢查表加入「例外金額由誰核准」"],
    },
  },
  {
    id: "d-pa-scenario",
    fromCourseId: "c-pa-finance",
    createdAt: "2026-09-18T17:00:00+08:00",
    trigger: "auto",
    proposal: {
      kind: "new_scenario",
      scenario: {
        title: "金融業：月結對帳",
        industry: "金融業",
        audience: "財務",
        cases: ["一張請款單在三個樓層之間走了九天", "月結前兩天的對單地獄"],
        materialNames: ["請款單欄位對照.xlsx"],
      },
    },
  },
];
