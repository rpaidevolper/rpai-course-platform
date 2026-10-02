import { BlueprintSchema } from "@/lib/blueprint/schema";
import type {
  Course,
  Framework,
  KnowledgeDraft,
  Project,
  RequirementReview,
  Scenario,
  Session,
} from "./types";

/**
 * 設計稿（#22）的假資料。一個貫穿全部畫面的例子：
 * 專案「A 公司 2026 AI 培訓」→ 課程「Claude 入門」「Claude 入門・主管班」（從入門複製）「Claude 進階」→「Claude 入門」有 10/15、10/22 兩個場次。
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
    status: "active",
    priceTwd: 360000,
    clientContext: {
      company: "A 公司",
      industry: "精密機械製造",
      goal: "生管、品保與業務助理在年底前，各自完成一個能每天使用的 AI 協作流程。",
      scenarioId: "sc-manufacturing",
      itConstraints: ["公司筆電禁止安裝桌面版 App，只能用瀏覽器", "Claude 為企業版，帳號由資訊課統一開通", "客戶資料不得上傳外部服務，練習一律用去識別化範例"],
      brand: { name: "A 公司企業識別", primaryColor: "#0b5d4b", note: "簡報封面與頁尾放 A 公司標誌，內文維持 RPAI 版型" },
    },
    clientDocuments: [
      { id: "doc-a-syllabus", kind: "original_syllabus", title: "人資提供的原課綱", fileName: "2026 AI 培訓課綱（人資版）.docx", receivedAt: "2026-09-05T10:20:00+08:00", respondsToOutlineId: null },
      { id: "doc-a-needs", kind: "requirements", title: "訓練需求信", fileName: "訓練需求說明.pdf", receivedAt: "2026-09-05T10:20:00+08:00", respondsToOutlineId: null },
      { id: "doc-a-template", kind: "planning_template", title: "承辦單位課程規劃表", fileName: "課程規劃表範本.xlsx", receivedAt: "2026-09-08T14:00:00+08:00", respondsToOutlineId: null },
      { id: "doc-a-feedback-1", kind: "feedback", title: "人資對課程大綱 v1 的回饋", fileName: "回覆：課程大綱初稿.eml", receivedAt: "2026-10-01T09:40:00+08:00", respondsToOutlineId: "a-ci-outline-1" },
    ],
    requirements: [
      { id: "r-a-8d", text: "要有一段實際把客訴信整理成 8D 報告的練習", sourceDocumentId: "doc-a-needs", keywords: ["8D"], minutes: 90, courseId: "c-claude-intro" },
      { id: "r-a-project", text: "學員課後要有一個能直接用的部門 Project", sourceDocumentId: "doc-a-syllabus", keywords: ["Project"], minutes: null, courseId: "c-claude-intro" },
      { id: "r-a-limits", text: "先講清楚 AI 能做與不能做的事，至少一個半小時", sourceDocumentId: "doc-a-syllabus", keywords: ["不能做什麼"], minutes: 90, courseId: "c-claude-intro" },
      { id: "r-a-supplier", text: "供應商來信的交期比對要有一段實作", sourceDocumentId: "doc-a-needs", keywords: ["供應商來信"], minutes: 60, courseId: "c-claude-intro" },
      { id: "r-a-weekly", text: "週會記錄整理成跨部門待辦", sourceDocumentId: "doc-a-needs", keywords: ["週會"], minutes: 30, courseId: "c-claude-intro" },
      { id: "r-a-handover", text: "主管要學會把個人用法寫成部門可交接的流程", sourceDocumentId: "doc-a-syllabus", keywords: ["交接"], minutes: 180, courseId: "c-claude-advanced" },
      { id: "r-a-security", text: "說明哪些公司資料不能交給 AI 處理", sourceDocumentId: "doc-a-needs", keywords: ["不能上傳"], minutes: 30, courseId: null },
    ],
  },
  {
    id: "p-b-2026",
    title: "B 公司請款流程數位化",
    status: "active",
    priceTwd: 85000,
    clientContext: {
      company: "B 公司",
      industry: "金融服務",
      goal: "差旅與費用請款全面改走 Teams 簽核，財務每月少花兩天對單。",
      scenarioId: "sc-finance-approval",
      itConstraints: ["Power Automate 只開放標準連接器"],
      brand: null,
    },
    clientDocuments: [
      { id: "doc-b-needs", kind: "requirements", title: "財務部需求清單", fileName: "請款流程需求.xlsx", receivedAt: "2026-08-20T16:00:00+08:00", respondsToOutlineId: null },
    ],
    requirements: [
      { id: "r-b-reminder", text: "逾期未核准要自動提醒主管", sourceDocumentId: "doc-b-needs", keywords: ["逾期"], minutes: 60, courseId: "c-pa-finance" },
    ],
  },
  {
    id: "p-c-2027",
    title: "C 公司主管 AI 素養系列",
    status: "negotiating",
    priceTwd: 120000,
    clientContext: {
      company: "C 公司",
      industry: "連鎖零售",
      goal: "區經理能用 AI 整理門市週報，並判斷哪些決策不能交給 AI。",
      scenarioId: "sc-manufacturing",
      itConstraints: [],
      brand: null,
    },
    clientDocuments: [
      { id: "doc-c-needs", kind: "requirements", title: "訓練需求初談紀錄", fileName: "初談紀錄.docx", receivedAt: "2026-09-30T15:00:00+08:00", respondsToOutlineId: null },
    ],
    requirements: [
      { id: "r-c-weekly", text: "用 AI 彙整十家門市的週報", sourceDocumentId: "doc-c-needs", keywords: ["週報"], minutes: null, courseId: null },
    ],
  },
  {
    id: "p-d-2026",
    title: "D 公司新人訓 AI 單元",
    status: "archived",
    priceTwd: 40000,
    clientContext: {
      company: "D 公司",
      industry: "物流",
      goal: "新人第一週就能用 AI 查詢內部作業手冊。",
      scenarioId: "sc-manufacturing",
      itConstraints: [],
      brand: null,
    },
    clientDocuments: [],
    requirements: [],
  },
  {
    id: "p-e-2026",
    title: "E 公司品保自動化兩天實戰營",
    status: "active",
    priceTwd: 168000,
    clientContext: {
      company: "E 公司",
      industry: "電子零件製造",
      goal: "品保與生管用 Google 表單與 Apps Script，把進料檢驗回報從紙本改成當天彙整、自動通知。",
      scenarioId: "sc-manufacturing",
      itConstraints: [],
      brand: null,
    },
    clientDocuments: [],
    requirements: [],
  },
];

/**
 * 需求條目是否被藍圖實質涵蓋：設計稿手動標註，真實版本交給 AI 判斷。
 * 「Claude 入門」的五條需求示範了 ✅、⚠️（擠在一起、時間偏短）、❌ 三種字面狀態。
 */
export const REQUIREMENT_REVIEWS: RequirementReview[] = [
  { requirementId: "r-a-8d", substantive: true, note: "「提示詞的四個零件」整段都拿客訴信練 8D 草稿。" },
  { requirementId: "r-a-project", substantive: true, note: "學員在課堂上建好自己部門的 Project，課後可直接用。" },
  { requirementId: "r-a-limits", substantive: true, note: "內容有講到，但只排了 60 分鐘，比客戶要求少半小時。" },
  { requirementId: "r-a-supplier", substantive: false, note: "只在 Project 練習裡順帶回覆一封供應商來信，沒有交期比對。" },
  { requirementId: "r-a-weekly", substantive: false, note: "週會只出現在受眾痛點，沒有任何單元處理它。" },
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
  format: { mode: "workshop", venue: "A 公司台中廠 3F 訓練教室" },
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
  days: [
    {
      theme: "從一封客訴信到自己的 Project",
      slots: [
        {
          label: "上午",
          minutes: 180,
          units: [
            { title: "AI 能做什麼、不能做什麼", minutes: 60, objective: "分辨哪些工作適合交給 AI", method: "講述＋案例", outcome: "一張「可交給 AI／不可上傳」對照表", keyPoints: ["生成、整理、比對三種用途", "哪些資料不能上傳"], activity: null, elements: ["theory", "story"], carriesFrom: null, source: { kind: "framework", id: "fw-claude-intro", version: 2, unit: "AI 能做什麼、不能做什麼" }, reuse: "reuse" },
            { title: "提示詞的四個零件", minutes: 120, objective: "寫出能穩定產出 8D 草稿的提示詞", method: "示範後個人實作", outcome: "一份可重複使用的 8D 草稿提示詞", keyPoints: ["格式要寫死", "給一個範例勝過十句說明"], activity: "拿一封客訴信改三次提示詞並比較", elements: ["theory", "handsOn"], carriesFrom: null, source: { kind: "framework", id: "fw-claude-intro", version: 2, unit: "提示詞的四個零件" }, reuse: "modify" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "用 Project 記住工作脈絡", minutes: 120, objective: "建立一個帶有部門規範與範本的 Project", method: "示範後個人實作", outcome: "自己部門的 Project", keyPoints: ["指示與知識檔的分工", "範本放在哪裡"], activity: "建立自己部門的 Project，用它回覆一封供應商來信", elements: ["handsOn", "takeaway"], carriesFrom: "提示詞的四個零件", source: { kind: "framework", id: "fw-claude-intro", version: 2, unit: "用 Project 記住工作脈絡" }, reuse: "reuse" },
            { title: "找出自己的三件事", minutes: 60, objective: "列出明天就能交給 AI 的三件工作", method: "個人填寫＋兩兩互評", outcome: "三件事清單", keyPoints: ["頻率 × 耗時 × 出錯成本", "先做最小的一個"], activity: "填三件事清單並兩兩互評", elements: ["takeaway"], carriesFrom: null, source: { kind: "framework", id: "fw-claude-intro", version: 2, unit: "找出自己的三件事" }, reuse: "reuse" },
          ],
        },
      ],
    },
  ],
  constraints: ["學員用公司筆電，需事先開通 Claude 帳號", "客訴信需去識別化"],
  tools: [{ name: "Claude", plan: "paid", confirmedWithClient: true }],
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
  format: { mode: "workshop", venue: null },
  narrative: { model: "PDCA", arc: ["盤點入門課後的用法", "挑一個流程擴大到部門", "寫成規則並試跑", "訂出維護方式"] },
  elements: {
    theory: ["流程交接的三個層次"],
    handsOn: ["把審核規則寫成提示詞並互測"],
    takeaway: ["部門流程交接範本"],
    quote: ["流程不是寫給 AI 看的，是寫給下一個同事看的"],
    story: [],
  },
  days: [
    {
      theme: "把個人用法擴大成部門流程",
      slots: [
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "從個人到部門", minutes: 40, objective: "盤點入門課後各自的用法", method: "分組分享", outcome: "部門用法盤點表", keyPoints: ["誰在用、用在哪"], activity: "分組分享一個成功與一個失敗", elements: ["theory"], carriesFrom: null, source: { kind: "framework", id: "fw-claude-advanced", version: 1, unit: "從個人到部門" }, reuse: "reuse" },
            { title: "審核規則寫成提示詞", minutes: 90, objective: "寫出部門共用的審核規則", method: "分組實作＋互測", outcome: "一份部門共用的審核規則提示詞", keyPoints: ["規則要能被驗證"], activity: "兩組互相測對方的規則", elements: ["handsOn", "quote"], carriesFrom: "從個人到部門", source: { kind: "framework", id: "fw-claude-advanced", version: 1, unit: "審核規則寫成提示詞" }, reuse: "modify" },
            { title: "流程上線與維護", minutes: 50, objective: "訂出流程的負責人與更新方式", method: "講述＋討論", outcome: "流程負責人與檢查週期", keyPoints: ["誰改規則、多久檢查一次"], activity: null, elements: ["takeaway"], carriesFrom: null, source: { kind: "framework", id: "fw-claude-advanced", version: 1, unit: "流程上線與維護" }, reuse: "reuse" },
          ],
        },
      ],
    },
  ],
  constraints: ["需在入門課所有場次結束後才能上"],
  tools: [{ name: "Claude", plan: "paid", confirmedWithClient: true }],
  openQuestions: [
    { text: "場地要在台中廠還是台北總部？", audience: "client", unit: null },
    { text: "要不要讓業務部一起來？", audience: "client", unit: "從個人到部門" },
    { text: "審核規則的範例用品保還是生管的案例", audience: "self", unit: "審核規則寫成提示詞" },
  ],
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
  format: { mode: "workshop", venue: "B 公司 8F 大會議室" },
  narrative: { model: "SCQA", arc: ["情境：月結前的對單地獄", "衝突：紙本卡在主管桌上", "提問：能不能讓主管在手機上核准", "解答：Teams 簽核流程"] },
  elements: {
    theory: ["觸發、動作、條件"],
    handsOn: ["建立差旅請款流程", "兩人一組互相送單核准"],
    takeaway: ["上線檢查表"],
    quote: ["簽核慢，從來不是主管懶，是單子找不到主管"],
    story: ["一張請款單在三個樓層之間走了九天"],
  },
  days: [
    {
      theme: "把差旅請款改成 Teams 一鍵核准",
      slots: [
        {
          label: "上午",
          minutes: 180,
          units: [
            { title: "雲端流程上手", minutes: 60, objective: "建立第一個雲端流程", method: "示範後跟做", outcome: "一個收信存附件的流程", keyPoints: ["觸發、動作、條件"], activity: "收到郵件就存附件", elements: ["theory", "handsOn"], carriesFrom: null, source: { kind: "framework", id: "fw-pa-basics", version: 2, unit: "雲端流程上手" }, reuse: "reuse" },
            { title: "核准與退回分支", minutes: 120, objective: "建立含退回原因的簽核流程", method: "兩人一組實作", outcome: "差旅請款簽核流程", keyPoints: ["Approvals 動作", "退回要帶原因"], activity: "兩人一組互相送單核准", elements: ["handsOn", "story"], carriesFrom: "雲端流程上手", source: { kind: "framework", id: "fw-pa-basics", version: 2, unit: "核准與退回分支" }, reuse: "reuse" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "逾期提醒", minutes: 90, objective: "逾期三天自動提醒主管", method: "個人實作＋假資料測試", outcome: "逾期提醒排程流程", keyPoints: ["排程流程"], activity: "設定提醒並用假資料測試", elements: ["handsOn"], carriesFrom: "核准與退回分支", source: { kind: "framework", id: "fw-pa-basics", version: 2, unit: "逾期提醒" }, reuse: "reuse" },
            { title: "上線檢查表", minutes: 90, objective: "確認流程可以正式上線", method: "講述＋逐項檢查", outcome: "填好的上線檢查表", keyPoints: ["權限、例外、負責人"], activity: null, elements: ["takeaway", "quote"], carriesFrom: null, source: { kind: "framework", id: "fw-pa-basics", version: 2, unit: "上線檢查表" }, reuse: "reuse" },
          ],
        },
      ],
    },
  ],
  constraints: ["需要 Power Automate 授權"],
  tools: [
    { name: "Power Automate", plan: "paid", confirmedWithClient: true },
    { name: "Microsoft Teams", plan: "enterprise", confirmedWithClient: true },
  ],
  openQuestions: [],
});

/** 多天課程的範例：兩天、每天上午下午各一個 180 分鐘時段，第二天承接第一天的成果。 */
const gasTwoDayBlueprint = BlueprintSchema.parse({
  title: "Apps Script 兩天實戰營：進料檢驗回報自動化",
  oneLiner: "讓品保與生管兩天內，把紙本進料檢驗單改成表單回報、自動彙整與異常通知。",
  audience: {
    who: "E 公司品保、生管與資材人員",
    size: 18,
    priorKnowledge: "熟悉 Google 試算表的篩選與樞紐分析，沒寫過程式",
    painPoints: ["進料檢驗單紙本傳遞，異常隔天才知道", "每週彙整檢驗結果要花半天"],
  },
  outcomes: ["建立一份進料檢驗回報表單並自動彙整到試算表", "寫出一支異常時自動寄信通知的 Apps Script", "把流程交接給同事並能自行維護"],
  format: { mode: "workshop", venue: "E 公司新竹廠 2F 會議室" },
  narrative: {
    model: "SCQA",
    arc: ["情境：異常隔天才知道", "衝突：表單有了，但還是要人去看", "提問：能不能一有異常就通知對的人", "解答：表單觸發器加上寄送前的安全網"],
  },
  elements: {
    theory: ["觸發器與執行權限", "寄送前的三道安全網"],
    handsOn: ["建立進料檢驗表單", "寫異常通知腳本", "互相送異常單測試"],
    takeaway: ["腳本範本與維護清單"],
    quote: ["自動化不是少做事，是讓對的人在對的時間知道"],
    story: ["一批不良電容在倉庫放了三天才被發現"],
  },
  days: [
    {
      theme: "從紙本到表單：讓檢驗結果當天就彙整",
      slots: [
        {
          label: "上午",
          minutes: 180,
          units: [
            { title: "為什麼異常總是晚一天", minutes: 40, objective: "說出目前檢驗流程的三個延遲點", method: "案例講述＋小組討論", outcome: "一張現況流程圖", keyPoints: ["紙本傳遞的延遲", "誰需要在什麼時候知道"], activity: null, elements: ["story", "theory"], carriesFrom: null, source: null, reuse: "new" },
            { title: "進料檢驗表單", minutes: 140, objective: "建立一份欄位完整、可驗證的檢驗回報表單", method: "示範後個人實作", outcome: "自己部門的進料檢驗表單", keyPoints: ["必填與驗證規則", "料號用下拉選單"], activity: "把一張紙本檢驗單改成表單並互填", elements: ["handsOn"], carriesFrom: "為什麼異常總是晚一天", source: null, reuse: "new" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "第一支 Apps Script", minutes: 90, objective: "讀懂並修改一支彙整腳本", method: "跟做＋改寫", outcome: "能每天彙整檢驗結果的腳本", keyPoints: ["編輯器與執行紀錄", "變數與迴圈只學用得到的"], activity: "改寫範例腳本，彙整自己表單的回覆", elements: ["theory", "handsOn"], carriesFrom: "進料檢驗表單", source: { kind: "framework", id: "fw-gas-forms", version: 1, unit: "第一支 Apps Script" }, reuse: "modify" },
            { title: "每日彙整報表", minutes: 90, objective: "產出一份每天自動更新的檢驗彙整表", method: "個人實作＋兩兩檢查", outcome: "每日檢驗彙整報表", keyPoints: ["時間觸發器", "樞紐分析接在彙整結果後面"], activity: "設定每天早上 8 點自動彙整", elements: ["handsOn", "takeaway"], carriesFrom: "第一支 Apps Script", source: null, reuse: "new" },
          ],
        },
      ],
    },
    {
      theme: "從彙整到通知：一有異常就讓對的人知道",
      slots: [
        {
          label: "上午",
          minutes: 180,
          units: [
            { title: "表單觸發器", minutes: 100, objective: "在表單送出時立即判斷是否異常", method: "示範後個人實作", outcome: "送出即判斷異常的觸發器", keyPoints: ["onFormSubmit", "執行權限與授權畫面"], activity: "接上第一天的表單，送出不良品時寫入異常分頁", elements: ["theory", "handsOn"], carriesFrom: "每日彙整報表", source: { kind: "framework", id: "fw-gas-forms", version: 1, unit: "表單觸發器" }, reuse: "reuse" },
            { title: "異常通知信", minutes: 80, objective: "異常時自動寄信給品保主管與供應商窗口", method: "個人實作", outcome: "異常通知信腳本", keyPoints: ["收件人從對照表取", "信件內容帶料號與照片連結"], activity: "寫通知信並寄給自己測試", elements: ["handsOn"], carriesFrom: "表單觸發器", source: null, reuse: "new" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "寄送前的安全網", minutes: 90, objective: "避免誤寄、重寄與額度用完", method: "講述＋找碴練習", outcome: "加上三道檢查的通知腳本", keyPoints: ["測試模式開關", "重複寄送檢查", "每日寄信額度"], activity: "互相送異常單，找出對方腳本會誤寄的情況", elements: ["theory", "handsOn", "quote"], carriesFrom: "異常通知信", source: { kind: "framework", id: "fw-gas-forms", version: 1, unit: "寄送前的安全網" }, reuse: "reuse" },
            { title: "交接與維護", minutes: 90, objective: "讓同事能接手維護這個流程", method: "分組撰寫＋互評", outcome: "流程交接說明與維護清單", keyPoints: ["誰改對照表", "腳本壞掉先看哪裡"], activity: "寫交接說明，讓隔壁組照著操作一次", elements: ["takeaway"], carriesFrom: "寄送前的安全網", source: null, reuse: "new" },
          ],
        },
      ],
    },
  ],
  constraints: ["學員用公司 Google Workspace 帳號，需事先開放 Apps Script", "檢驗資料需用去識別化的範例料號"],
  tools: [
    { name: "Google 表單", plan: "free", confirmedWithClient: true },
    { name: "Google Apps Script", plan: "enterprise", confirmedWithClient: false },
  ],
  openQuestions: [
    { text: "通知信可以寄給供應商窗口的真實信箱嗎？還是只寄內部？", audience: "client", unit: "異常通知信" },
    { text: "第二天下午要不要留 20 分鐘讓各組展示", audience: "self", unit: "交接與維護" },
  ],
});

/**
 * 變體課程的範例：以「Claude 入門」（同仁班）藍圖 v3 為底複製出主管班（ADR 0002）。
 * 單元來源都指向同仁班的 v3，沿用程度混合沿用、要改與新做。
 */
const fromStaffV3 = (unit: string) => ({ kind: "course" as const, id: "c-claude-intro", version: 3, unit });

const claudeIntroManagersBlueprint = BlueprintSchema.parse({
  title: "Claude 入門・主管班：帶團隊把文書交給 AI",
  oneLiner: "讓生管與品保主管一天之內學會審 AI 產出的文件，並帶自己的團隊開始用。",
  audience: {
    who: "A 公司生管、品保與業務部門的課長與組長",
    size: 10,
    priorKnowledge: "看過同仁用 ChatGPT，自己很少用；每天要審同仁交來的報告",
    painPoints: ["不確定 AI 寫的 8D 報告能不能信", "同仁各用各的，沒有共同規範"],
  },
  outcomes: ["用一份檢查清單審一份 AI 產出的 8D 草稿", "建立部門共用、帶審核規範的 Project", "訂出團隊導入的第一個流程與負責人"],
  format: { mode: "workshop", venue: "A 公司台中廠 3F 訓練教室" },
  narrative: {
    model: "SCQA",
    arc: ["情境：同仁開始用 AI 交報告", "衝突：主管不知道怎麼審、怎麼管", "提問：主管要會到什麼程度", "解答：審核清單加上部門共用 Project"],
  },
  elements: {
    theory: ["提示詞的四個零件：角色、任務、格式、範例", "審 AI 文件的三個檢查點"],
    handsOn: ["審一份 AI 寫的 8D 草稿", "建立部門共用 Project"],
    takeaway: ["主管審核清單", "團隊導入計畫"],
    quote: ["主管不用比同仁會寫提示詞，但要比同仁會挑錯"],
    story: ["品保課長把 8D 報告從兩小時縮到二十分鐘"],
  },
  days: [
    {
      theme: "從審得懂到帶得動",
      slots: [
        {
          label: "上午",
          minutes: 180,
          units: [
            { title: "AI 能做什麼、不能做什麼", minutes: 60, objective: "分辨哪些工作適合交給 AI", method: "講述＋案例", outcome: "一張「可交給 AI／不可上傳」對照表", keyPoints: ["生成、整理、比對三種用途", "哪些資料不能上傳"], activity: null, elements: ["theory", "story"], carriesFrom: null, source: fromStaffV3("AI 能做什麼、不能做什麼"), reuse: "reuse" },
            { title: "主管怎麼審 AI 的 8D 草稿", minutes: 120, objective: "用檢查清單找出 AI 草稿裡的錯誤與缺漏", method: "示範後個人實作", outcome: "一份主管審核清單", keyPoints: ["先看格式再看事實", "要求同仁附上提示詞"], activity: "審一份故意埋了三個錯的 8D 草稿", elements: ["theory", "handsOn", "quote"], carriesFrom: null, source: fromStaffV3("提示詞的四個零件"), reuse: "modify" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "部門共用的 Project", minutes: 90, objective: "建立一個帶部門審核規範的共用 Project", method: "示範後個人實作", outcome: "部門共用 Project", keyPoints: ["審核規範寫進指示", "誰能改知識檔"], activity: "把上午的審核清單放進部門共用 Project", elements: ["handsOn", "takeaway"], carriesFrom: "主管怎麼審 AI 的 8D 草稿", source: fromStaffV3("用 Project 記住工作脈絡"), reuse: "modify" },
            { title: "帶團隊導入的第一步", minutes: 90, objective: "訂出團隊第一個導入的流程與負責人", method: "分組討論＋互評", outcome: "團隊導入計畫", keyPoints: ["先挑一個每週都會發生的流程", "負責人與檢查週期"], activity: "寫團隊導入計畫並兩兩互評", elements: ["takeaway"], carriesFrom: null, source: null, reuse: "new" },
          ],
        },
      ],
    },
  ],
  constraints: ["主管班與同仁班分開上，避免同仁不敢發問", "客訴信需去識別化"],
  tools: [{ name: "Claude", plan: "paid", confirmedWithClient: true }],
  openQuestions: [],
});

export const COURSES: Course[] = [
  {
    id: "c-claude-intro",
    projectId: "p-a-2026",
    title: "Claude 入門",
    source: { frameworkId: "fw-claude-intro", frameworkVersion: 2, scenarioId: "sc-manufacturing" },
    copiedFrom: null,
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
    id: "c-claude-intro-managers",
    projectId: "p-a-2026",
    title: "Claude 入門・主管班",
    source: { frameworkId: "fw-claude-intro", frameworkVersion: 2, scenarioId: "sc-manufacturing" },
    copiedFrom: { courseId: "c-claude-intro", blueprintVersion: 3 },
    blueprint: claudeIntroManagersBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-10-08T09:30:00+08:00", note: "以「Claude 入門」藍圖 v3 為底複製，改成主管視角" },
    ],
    artifacts: [],
    materials: [],
  },
  {
    id: "c-claude-advanced",
    projectId: "p-a-2026",
    title: "Claude 進階",
    source: { frameworkId: "fw-claude-advanced", frameworkVersion: 1, scenarioId: "sc-manufacturing" },
    copiedFrom: null,
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
    copiedFrom: null,
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
  {
    id: "c-gas-two-day",
    projectId: "p-e-2026",
    title: "Apps Script 兩天實戰營",
    source: { frameworkId: "fw-gas-forms", frameworkVersion: 1, scenarioId: "sc-manufacturing" },
    copiedFrom: null,
    blueprint: gasTwoDayBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-09-22T10:00:00+08:00", note: "由框架 v1 與製造業情境談出初版，一天" },
      { version: 2, createdAt: "2026-10-01T15:30:00+08:00", note: "拆成兩天：第一天彙整、第二天通知，每天上午下午各 180 分鐘" },
    ],
    artifacts: [],
    materials: [],
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
