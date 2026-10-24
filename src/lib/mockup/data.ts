import { BlueprintSchema } from "@/lib/blueprint/schema";
import type {
  Artifact,
  Course,
  CourseRecipe,
  IndustryPack,
  KnowledgeDraft,
  ModuleCard,
  Project,
  RequirementReview,
  Session,
  UnitCard,
} from "./types";

/**
 * 設計稿（#22）的假資料。一個貫穿全部畫面的例子：
 * 專案「A 公司 2026 AI 培訓」→ 課程「Claude 入門」「Claude 入門・主管班」（從入門複製）「Claude 進階」→「Claude 入門」有 10/15、10/22 兩個場次。
 * 知識庫（模組卡、單元卡、課程配方、產業素材包）與課後草稿的假資料也放在這裡（#55）。
 * 不接資料庫、不接 AI。
 */

/** 設計稿的「現在」。所有時間判斷都以它為準，不在畫面上呼叫 new Date()。 */
export const MOCK_NOW = "2026-10-08T10:00:00+08:00";

/**
 * 知識庫的假資料（#55）：單元卡、模組卡、課程配方與產業素材包。全部是虛構內容，公司只用 F、G 這類代號。
 * 單元卡與藍圖單元同名的，目標、方法與成果沿用藍圖那一段的文字。
 */
export const UNIT_CARDS: UnitCard[] = [
  { id: "uc-a1-first-chat", moduleId: "A1", title: "第一次對話：把一份文件交給 AI", minutes: 60, objective: "第一次把自己的文件交給 AI 整理", method: "示範後個人實作", outcome: "一段整理過的文件摘要", audiences: ["行政", "業務"], tools: ["Claude"], scenarios: ["文書"] },
  { id: "uc-a1-limits", moduleId: "A1", title: "AI 能做什麼、不能做什麼", minutes: 60, objective: "分辨哪些工作適合交給 AI", method: "講述＋案例", outcome: "一張「可交給 AI／不可上傳」對照表", audiences: ["行政", "部門主管"], tools: ["Claude"], scenarios: ["知識整理"] },
  { id: "uc-a1-project", moduleId: "A1", title: "用 Project 記住工作脈絡", minutes: 120, objective: "建立一個帶有部門規範與範本的 Project", method: "示範後個人實作", outcome: "自己部門的 Project", audiences: ["行政", "業務"], tools: ["Claude", "Claude Project"], scenarios: ["文書"] },
  { id: "uc-a2-handbook", moduleId: "A2", title: "把部門手冊建成可查詢的知識庫", minutes: 90, objective: "把一本部門手冊切段、上傳並試著提問", method: "示範後分組實作", outcome: "能回答常見問題的知識庫", audiences: ["行政", "部門主管"], tools: ["Claude", "NotebookLM"], scenarios: ["知識整理"] },
  { id: "uc-a2-cited", moduleId: "A2", title: "只回答有出處的問答", minutes: 60, objective: "讓 AI 的回答一定附上文件出處", method: "講述＋現場測試", outcome: "附出處的問答設定", audiences: ["行政", "部門主管"], tools: ["Claude", "NotebookLM"], scenarios: ["知識整理"] },
  { id: "uc-a3-first-flow", moduleId: "A3", title: "第一個桌面流程：開檔、複製、存檔", minutes: 90, objective: "錄製並回放一段三步驟的桌面操作", method: "示範後跟做", outcome: "一個能重跑的桌面流程", audiences: ["生管資材", "行政"], tools: ["Power Automate Desktop"], scenarios: ["數據分析"] },
  { id: "uc-a3-merge", moduleId: "A3", title: "批次整併多份 Excel 報表", minutes: 120, objective: "用流程把多份報表合併成一份", method: "分組實作", outcome: "一份整併後的月報表", audiences: ["生管資材", "財務"], tools: ["Power Automate Desktop", "Excel"], scenarios: ["數據分析"] },
  { id: "uc-a4-cloud-first", moduleId: "A4", title: "雲端流程上手", minutes: 60, objective: "建立第一個雲端流程", method: "示範後跟做", outcome: "一個收信存附件的流程", audiences: ["行政", "財務"], tools: ["Power Automate"], scenarios: ["客服與信件"] },
  { id: "uc-a4-approval", moduleId: "A4", title: "核准與退回分支", minutes: 120, objective: "建立含退回原因的簽核流程", method: "兩人一組實作", outcome: "差旅請款簽核流程", audiences: ["財務", "行政"], tools: ["Power Automate", "Microsoft Teams"], scenarios: ["文書"] },
  { id: "uc-a4-overdue", moduleId: "A4", title: "逾期提醒", minutes: 90, objective: "逾期三天自動提醒主管", method: "個人實作＋假資料測試", outcome: "逾期提醒排程流程", audiences: ["財務", "部門主管"], tools: ["Power Automate", "Microsoft Teams"], scenarios: ["客服與信件"] },
  { id: "uc-a4-first-script", moduleId: "A4", title: "第一支 Apps Script", minutes: 90, objective: "讀懂並修改一支彙整腳本", method: "跟做＋改寫", outcome: "能每天彙整檢驗結果的腳本", audiences: ["人資", "行政"], tools: ["Google 試算表", "Google Apps Script"], scenarios: ["數據分析"] },
  { id: "uc-a4-form-trigger", moduleId: "A4", title: "表單觸發器", minutes: 100, objective: "在表單送出時立即判斷是否異常", method: "示範後個人實作", outcome: "送出即判斷異常的觸發器", audiences: ["人資", "品保"], tools: ["Google 試算表", "Google Apps Script"], scenarios: ["數據分析"] },
  { id: "uc-a4-safety-net", moduleId: "A4", title: "寄送前的安全網", minutes: 90, objective: "避免誤寄、重寄與額度用完", method: "講述＋找碴練習", outcome: "加上三道檢查的通知腳本", audiences: ["人資", "行政"], tools: ["Google Apps Script"], scenarios: ["客服與信件"] },
  { id: "uc-a5-skill", moduleId: "A5", title: "把重複工作寫成 Skill", minutes: 90, objective: "把一段固定的工作流程寫成可重複呼叫的 Skill", method: "示範後個人實作", outcome: "一個可以重複使用的 Skill", audiences: ["種子團隊"], tools: ["Claude Code", "Claude Skills"], scenarios: ["文書"] },
  { id: "uc-a5-tool", moduleId: "A5", title: "請 AI 寫一個部門小工具", minutes: 120, objective: "用自然語言描述需求，請 AI 寫出可用的小工具", method: "分組實作＋互測", outcome: "一個部門用的小工具", audiences: ["種子團隊"], tools: ["Claude Code"], scenarios: ["數據分析"] },
  { id: "uc-b1-inventory", moduleId: "B1", title: "流程盤點：找出重複、等待與抄寫", minutes: 90, objective: "畫出現在的流程，標出重複與等待", method: "個人盤點＋小組討論", outcome: "一張標示浪費的流程圖", audiences: ["行政", "生管資材", "人資"], tools: [], scenarios: ["會議與紀錄"] },
  { id: "uc-b1-three-things", moduleId: "B1", title: "找出自己的三件事", minutes: 60, objective: "列出明天就能交給 AI 的三件工作", method: "個人填寫＋兩兩互評", outcome: "三件事清單", audiences: ["行政", "業務"], tools: [], scenarios: ["會議與紀錄"] },
  { id: "uc-b1-dept", moduleId: "B1", title: "從個人到部門", minutes: 40, objective: "盤點入門課後各自的用法", method: "分組分享", outcome: "部門用法盤點表", audiences: ["部門主管", "種子團隊"], tools: [], scenarios: ["會議與紀錄"] },
  { id: "uc-b2-four-parts", moduleId: "B2", title: "提示詞的四個零件", minutes: 120, objective: "寫出能穩定產出 8D 草稿的提示詞", method: "示範後個人實作", outcome: "一份可重複使用的 8D 草稿提示詞", audiences: ["行政", "業務", "品保"], tools: ["Claude"], scenarios: ["文書"] },
  { id: "uc-b2-review-rules", moduleId: "B2", title: "審核規則寫成提示詞", minutes: 90, objective: "寫出部門共用的審核規則", method: "分組實作＋互測", outcome: "一份部門共用的審核規則提示詞", audiences: ["品保", "部門主管"], tools: ["Claude"], scenarios: ["文書"] },
  { id: "uc-b3-data-rules", moduleId: "B3", title: "哪些資料不能交給 AI", minutes: 60, objective: "訂出資料分級與不能上傳的清單", method: "講述＋案例", outcome: "一張資料分級表", audiences: ["部門主管", "行政"], tools: [], scenarios: ["知識整理"] },
  { id: "uc-b3-golive", moduleId: "B3", title: "上線檢查表", minutes: 90, objective: "確認流程可以正式上線", method: "講述＋逐項檢查", outcome: "填好的上線檢查表", audiences: ["財務", "人資", "部門主管"], tools: [], scenarios: ["文書"] },
  { id: "uc-b3-maintain", moduleId: "B3", title: "流程上線與維護", minutes: 50, objective: "訂出流程的負責人與更新方式", method: "講述＋討論", outcome: "流程負責人與檢查週期", audiences: ["部門主管"], tools: [], scenarios: ["會議與紀錄"] },
  { id: "uc-b4-monthly-cost", moduleId: "B4", title: "算出一個 AI 流程每月的成本", minutes: 60, objective: "把一個流程每月的費用與省下的時間算清楚", method: "示範後分組試算", outcome: "一張每月成本試算表", audiences: ["財務", "部門主管"], tools: ["Excel"], scenarios: ["數據分析"] },
];

/** 模組卡：一個模組一張，依 MODULES 的順序。 */
export const MODULE_CARDS: ModuleCard[] = [
  {
    moduleId: "A1",
    summary: "用一般的對話式 AI 完成日常文書：先分清楚能做與不能做，再用一份真實文件練出穩定的提示詞。",
    scope: "學員打開的是通用生成 AI 的對話介面，不接任何外部系統。",
    skeletonUnitIds: ["uc-a1-first-chat", "uc-a1-limits", "uc-a1-project"],
    combos: ["常接 B2 提問與指令，練提示詞的基本功", "新手班常先接 B3，講完資料界線再開放上傳"],
    versions: [
      { version: 1, createdAt: "2026-03-20T18:00:00+08:00", note: "由 2026-03 行政人員工作坊整理", fromCourseId: null },
      { version: 2, createdAt: "2026-06-02T18:00:00+08:00", note: "把 Project 單元的動手時間由 60 分加到 120 分", fromCourseId: null },
    ],
  },
  {
    moduleId: "A2",
    summary: "把部門的手冊、規範與案例整理成知識庫，讓 AI 只根據內部文件回答，並且附上出處。",
    scope: "學員打開的是帶有知識庫的 AI 助理，文件由學員自己上傳到指定的資料夾。",
    skeletonUnitIds: ["uc-a2-handbook", "uc-a2-cited"],
    combos: ["前面接 A1，先會寫提示詞再談知識庫", "常接 B3，先決定哪些文件可以進知識庫"],
    versions: [{ version: 1, createdAt: "2026-05-20T18:00:00+08:00", note: "由 2026-05 部門知識庫講座整理", fromCourseId: null }],
  },
  {
    moduleId: "A3",
    summary: "用錄製與回放讓電腦替你重複開檔、複製與整併，適合沒有開放介面的舊系統。",
    scope: "學員打開的是自己電腦上的桌面與 Excel，流程在本機執行。",
    skeletonUnitIds: ["uc-a3-first-flow", "uc-a3-merge"],
    combos: ["常以 B1 流程診斷定錨，先盤點再錄製", "報表類需求常接 B4，先算清楚人時與授權費"],
    versions: [{ version: 1, createdAt: "2026-04-25T18:00:00+08:00", note: "由 2026-04 報表自動化班整理", fromCourseId: null }],
  },
  {
    moduleId: "A4",
    summary: "用雲端流程把表單、郵件與簽核串起來，從第一個流程長到含逾期提醒與安全網的完整流程。",
    scope: "學員打開的是雲端表單、試算表與腳本編輯器，流程在雲端執行，不需要自己的電腦一直開著。",
    skeletonUnitIds: ["uc-a4-cloud-first", "uc-a4-form-trigger", "uc-a4-overdue", "uc-a4-safety-net"],
    combos: ["常以 B1 流程診斷定錨，先畫出現在的流程", "上線前一定接 B3，用上線檢查表收尾"],
    versions: [
      { version: 1, createdAt: "2026-01-22T18:00:00+08:00", note: "由 2026-01 財務部工作坊整理", fromCourseId: null },
      { version: 2, createdAt: "2026-04-30T18:00:00+08:00", note: "把寄送前的安全網拉進骨架，並補上逾期提醒的假資料測試", fromCourseId: null },
    ],
  },
  {
    moduleId: "A5",
    summary: "讓 AI 代理與編碼助理替你完成多步驟工作：把重複工作寫成可重用的 Skill，或請 AI 寫出部門用的小工具。",
    scope: "學員打開的是 AI 編碼助理或 Agent 的工作環境，產出的是可以被重複呼叫的 Skill 或小程式。",
    skeletonUnitIds: ["uc-a5-skill", "uc-a5-tool"],
    combos: ["導入提案裡常接 B1，先找出值得交給 Agent 的流程", "常接 B3，先訂好權限與審核的界線"],
    versions: [{ version: 1, createdAt: "2026-07-10T18:00:00+08:00", note: "首版，由 2026-07 種子團隊試講整理", fromCourseId: null }],
  },
  {
    moduleId: "B1",
    summary: "不綁工具的方法：先把現在的流程畫出來，找出重複、等待與抄寫，再決定要交給哪一種 AI。",
    scope: "學員帶走的是自己工作流程的盤點表，以及一張要優先處理的三件事清單。",
    skeletonUnitIds: ["uc-b1-inventory", "uc-b1-three-things"],
    combos: ["幾乎每門 A 類課程都以 B1 開場定錨", "部門導入時常疊加 B2 或 B3"],
    versions: [{ version: 1, createdAt: "2026-02-25T18:00:00+08:00", note: "由 2026-02 行政與人資班整理", fromCourseId: null }],
  },
  {
    moduleId: "B2",
    summary: "不綁工具的方法：把提示詞拆成可以檢查的零件，並把部門的審核規則寫成所有人都能照用的指令。",
    scope: "學員帶走的是一份可以重複使用的提示詞，以及部門共用的審核規則。",
    skeletonUnitIds: ["uc-b2-four-parts", "uc-b2-review-rules"],
    combos: ["常接 A1 通用生成 AI，練提示詞的基本功", "與 A2 並用時，提示詞要多一段出處要求"],
    versions: [{ version: 1, createdAt: "2026-03-20T18:00:00+08:00", note: "由 2026-03 行政人員工作坊整理", fromCourseId: null }],
  },
  {
    moduleId: "B3",
    summary: "不綁工具的方法：先訂出哪些資料不能交給 AI，再用上線檢查表與維護計畫，讓流程能長期安全地跑。",
    scope: "學員帶走的是一張資料分級表、一份上線檢查表與流程的維護計畫。",
    skeletonUnitIds: ["uc-b3-data-rules", "uc-b3-golive", "uc-b3-maintain"],
    combos: ["流程上線前幾乎都會接，常和 A4 一起出現", "主管班常以 B3 為主，搭配 B2 的審核規則"],
    versions: [{ version: 1, createdAt: "2026-04-30T18:00:00+08:00", note: "由 2026-04 流程上線工作坊整理", fromCourseId: null }],
  },
  {
    moduleId: "B4",
    summary: "不綁工具的方法：把一個 AI 流程每個月的費用算清楚，比較自動化省下的時間與花費是否划算。",
    scope: "學員帶走的是一張每月成本試算表，以及一句話的節費判斷。",
    skeletonUnitIds: ["uc-b4-monthly-cost"],
    combos: ["報表類自動化常接 A3，一起算人時與授權費", "導入提案裡常接 B1，先確定要省的是哪一段"],
    versions: [{ version: 1, createdAt: "2026-08-15T18:00:00+08:00", note: "首版，由 2026-08 報表班試算整理", fromCourseId: null }],
  },
];

/** 課程配方：過去課程的骨架，依序列出用到的單元卡。 */
export const COURSE_RECIPES: CourseRecipe[] = [
  {
    id: "rc-f-claude-2603",
    title: "F 公司行政人員 Claude 工作坊",
    client: "F 公司",
    status: "delivered",
    heldOn: "2026-03",
    audiences: ["行政", "業務"],
    tools: ["Claude", "Claude Project"],
    industries: ["服務零售"],
    scenarios: ["文書"],
    unitIds: ["uc-a1-first-chat", "uc-a1-limits", "uc-b2-four-parts", "uc-a1-project", "uc-b1-three-things"],
  },
  {
    id: "rc-g-pa-2601",
    title: "G 公司財務部簽核自動化",
    client: "G 公司",
    status: "delivered",
    heldOn: "2026-01",
    audiences: ["財務", "行政"],
    tools: ["Power Automate", "Microsoft Teams"],
    industries: ["金融"],
    scenarios: ["文書", "客服與信件"],
    unitIds: ["uc-a4-cloud-first", "uc-a4-approval", "uc-a4-overdue", "uc-b3-golive"],
  },
  {
    id: "rc-h-gas-2602",
    title: "H 公司人資表單自動化",
    client: "H 公司",
    status: "delivered",
    heldOn: "2026-02",
    audiences: ["人資", "行政"],
    tools: ["Google 試算表", "Google Apps Script"],
    industries: ["HR"],
    scenarios: ["數據分析", "客服與信件"],
    unitIds: ["uc-b1-inventory", "uc-a4-first-script", "uc-a4-form-trigger", "uc-a4-safety-net"],
  },
  {
    id: "rc-l-rpa-2604",
    title: "L 公司報表自動化兩天班",
    client: "L 公司",
    status: "delivered",
    heldOn: "2026-04",
    audiences: ["生管資材"],
    tools: ["Power Automate Desktop", "Excel"],
    industries: ["製造"],
    scenarios: ["數據分析"],
    unitIds: ["uc-b1-inventory", "uc-a3-first-flow", "uc-a3-merge", "uc-b4-monthly-cost"],
  },
  {
    id: "rc-k-kb-2605",
    title: "K 公司部門知識庫講座",
    client: "K 公司",
    status: "delivered",
    heldOn: "2026-05",
    audiences: ["部門主管"],
    tools: ["Claude", "NotebookLM"],
    industries: ["通用"],
    scenarios: ["知識整理"],
    unitIds: ["uc-a2-handbook", "uc-a2-cited", "uc-b3-data-rules"],
  },
  {
    id: "rc-j-agent",
    title: "J 公司 AI Agent 導入提案",
    client: "J 公司",
    status: "proposal",
    heldOn: null,
    audiences: ["種子團隊"],
    tools: ["Claude Code", "Claude Skills"],
    industries: ["製造"],
    scenarios: ["文書", "數據分析"],
    unitIds: ["uc-b1-inventory", "uc-a5-skill", "uc-a5-tool", "uc-b1-dept"],
  },
  {
    id: "rc-m-governance",
    title: "M 公司主管 AI 治理半日課",
    client: "M 公司",
    status: "preparing",
    heldOn: null,
    audiences: ["部門主管"],
    tools: ["Claude"],
    industries: ["金融"],
    scenarios: ["知識整理"],
    unitIds: ["uc-a1-limits", "uc-b3-data-rules", "uc-b3-maintain"],
  },
];

/** 產業素材包：套在模組上的案例、練習與資料檔。 */
export const INDUSTRY_PACKS: IndustryPack[] = [
  {
    id: "ip-manufacturing",
    title: "製造業：生管與品保的日常文書",
    audiences: ["生管資材", "品保", "業務"],
    tools: ["Claude", "Excel"],
    industries: ["製造"],
    scenarios: ["文書", "會議與紀錄"],
    cases: ["把客訴信整理成 8D 報告草稿", "週會記錄變成跨部門待辦", "供應商來信的交期比對"],
    materialNames: ["客訴信範例（去識別化）.docx", "生產週報範本.xlsx"],
  },
  {
    id: "ip-finance-approval",
    title: "金融業：請款與費用簽核",
    audiences: ["財務", "行政"],
    tools: ["Power Automate", "Microsoft Teams"],
    industries: ["金融"],
    scenarios: ["文書", "客服與信件"],
    cases: ["差旅費請款從紙本到 Teams", "金額門檻決定簽核層級"],
    materialNames: ["請款單欄位對照.xlsx"],
  },
  {
    id: "ip-retail",
    title: "服務零售：門市週報與排班",
    audiences: ["門市店長", "部門主管"],
    tools: ["Claude", "Excel"],
    industries: ["服務零售"],
    scenarios: ["數據分析", "簡報"],
    cases: ["把十家門市的週報彙整成一頁摘要", "依客流量與假期調整下週排班草案"],
    materialNames: ["門市週報範本（去識別化）.xlsx"],
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
      industryPackId: "ip-manufacturing",
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
      industryPackId: "ip-finance-approval",
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
      industryPackId: "ip-retail",
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
      industryPackId: "ip-manufacturing",
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
      industryPackId: "ip-manufacturing",
      itConstraints: [],
      brand: null,
    },
    clientDocuments: [],
    requirements: [],
  },
  {
    id: "p-f-2026",
    title: "F 公司請款簽核先導班",
    status: "active",
    priceTwd: 52000,
    clientContext: {
      company: "F 公司",
      industry: "批發零售",
      goal: "財務部先用一天試辦請款簽核自動化，確認可行再推到其他部門。",
      industryPackId: "ip-finance-approval",
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
            { title: "AI 能做什麼、不能做什麼", minutes: 60, module: "A1", level: "L1", objective: "分辨哪些工作適合交給 AI", method: "講述＋案例", outcome: "一張「可交給 AI／不可上傳」對照表", keyPoints: ["生成、整理、比對三種用途", "哪些資料不能上傳"], activity: null, elements: ["theory", "story"], carriesFrom: null, source: { kind: "unit_card", id: "uc-a1-limits", version: null, unit: "AI 能做什麼、不能做什麼" }, reuse: "reuse" },
            { title: "提示詞的四個零件", minutes: 120, module: "B2", level: "L2", objective: "寫出能穩定產出 8D 草稿的提示詞", method: "示範後個人實作", outcome: "一份可重複使用的 8D 草稿提示詞", keyPoints: ["格式要寫死", "給一個範例勝過十句說明"], activity: "拿一封客訴信改三次提示詞並比較", elements: ["theory", "handsOn"], carriesFrom: null, source: { kind: "unit_card", id: "uc-b2-four-parts", version: null, unit: "提示詞的四個零件" }, reuse: "modify" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "用 Project 記住工作脈絡", minutes: 120, module: "A1", level: "L3", objective: "建立一個帶有部門規範與範本的 Project", method: "示範後個人實作", outcome: "自己部門的 Project", keyPoints: ["指示與知識檔的分工", "範本放在哪裡"], activity: "建立自己部門的 Project，用它回覆一封供應商來信", elements: ["handsOn", "takeaway"], carriesFrom: "提示詞的四個零件", source: { kind: "unit_card", id: "uc-a1-project", version: null, unit: "用 Project 記住工作脈絡" }, reuse: "reuse" },
            { title: "找出自己的三件事", minutes: 60, module: "B1", level: null, objective: "列出明天就能交給 AI 的三件工作", method: "個人填寫＋兩兩互評", outcome: "三件事清單", keyPoints: ["頻率 × 耗時 × 出錯成本", "先做最小的一個"], activity: "填三件事清單並兩兩互評", elements: ["takeaway"], carriesFrom: null, source: { kind: "unit_card", id: "uc-b1-three-things", version: null, unit: "找出自己的三件事" }, reuse: "reuse" },
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
            { title: "從個人到部門", minutes: 40, module: "B1", level: null, objective: "盤點入門課後各自的用法", method: "分組分享", outcome: "部門用法盤點表", keyPoints: ["誰在用、用在哪"], activity: "分組分享一個成功與一個失敗", elements: ["theory"], carriesFrom: null, source: { kind: "unit_card", id: "uc-b1-dept", version: null, unit: "從個人到部門" }, reuse: "reuse" },
            { title: "審核規則寫成提示詞", minutes: 90, module: "B2", level: "L3", objective: "寫出部門共用的審核規則", method: "分組實作＋互測", outcome: "一份部門共用的審核規則提示詞", keyPoints: ["規則要能被驗證"], activity: "兩組互相測對方的規則", elements: ["handsOn", "quote"], carriesFrom: "從個人到部門", source: { kind: "unit_card", id: "uc-b2-review-rules", version: null, unit: "審核規則寫成提示詞" }, reuse: "modify" },
            { title: "流程上線與維護", minutes: 50, module: "B3", level: null, objective: "訂出流程的負責人與更新方式", method: "講述＋討論", outcome: "流程負責人與檢查週期", keyPoints: ["誰改規則、多久檢查一次"], activity: null, elements: ["takeaway"], carriesFrom: null, source: { kind: "unit_card", id: "uc-b3-maintain", version: null, unit: "流程上線與維護" }, reuse: "reuse" },
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
            { title: "雲端流程上手", minutes: 60, module: "A4", level: "L3", objective: "建立第一個雲端流程", method: "示範後跟做", outcome: "一個收信存附件的流程", keyPoints: ["觸發、動作、條件"], activity: "收到郵件就存附件", elements: ["theory", "handsOn"], carriesFrom: null, source: { kind: "unit_card", id: "uc-a4-cloud-first", version: null, unit: "雲端流程上手" }, reuse: "reuse" },
            { title: "核准與退回分支", minutes: 120, module: "A4", level: "L3", objective: "建立含退回原因的簽核流程", method: "兩人一組實作", outcome: "差旅請款簽核流程", keyPoints: ["Approvals 動作", "退回要帶原因"], activity: "兩人一組互相送單核准", elements: ["handsOn", "story"], carriesFrom: "雲端流程上手", source: { kind: "unit_card", id: "uc-a4-approval", version: null, unit: "核准與退回分支" }, reuse: "reuse" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "逾期提醒", minutes: 90, module: "A4", level: "L5", objective: "逾期三天自動提醒主管", method: "個人實作＋假資料測試", outcome: "逾期提醒排程流程", keyPoints: ["排程流程"], activity: "設定提醒並用假資料測試", elements: ["handsOn"], carriesFrom: "核准與退回分支", source: { kind: "unit_card", id: "uc-a4-overdue", version: null, unit: "逾期提醒" }, reuse: "reuse" },
            { title: "上線檢查表", minutes: 90, module: "B3", level: null, objective: "確認流程可以正式上線", method: "講述＋逐項檢查", outcome: "填好的上線檢查表", keyPoints: ["權限、例外、負責人"], activity: null, elements: ["takeaway", "quote"], carriesFrom: null, source: { kind: "unit_card", id: "uc-b3-golive", version: null, unit: "上線檢查表" }, reuse: "reuse" },
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

/**
 * 先導班的藍圖（#60）：從請款簽核工作坊改來，示範結案草稿的四種情況——
 * 骨架單元「雲端流程上手」改過（要改）、「核准與退回分支」與「上線檢查表」照用（沿用）、
 * 「逾期提醒」換成新做的單元，而且標題與目標帶著客戶代號（審核時要改寫）。
 */
const paPilotBlueprint = (() => {
  const bp = structuredClone(paFinanceBlueprint);
  const [morning, afternoon] = bp.days[0].slots;
  morning.units[0] = { ...morning.units[0], title: "雲端流程上手（請款版）", reuse: "modify", objective: "建立第一個收請款單的雲端流程" };
  morning.units[1] = { ...morning.units[1], carriesFrom: "雲端流程上手（請款版）" };
  afternoon.units[0] = {
    title: "F 公司請款單逾期對帳",
    minutes: 90,
    module: "A4",
    level: "L5",
    objective: "把 F 公司財務部逾期三天的請款單自動對帳並提醒",
    method: "個人實作＋假資料測試",
    outcome: "F 公司財務部的逾期對帳流程",
    keyPoints: ["排程流程", "對帳欄位"],
    activity: "用假資料跑一次對帳",
    elements: ["handsOn"],
    carriesFrom: "核准與退回分支",
    source: null,
    reuse: "new",
  };
  return BlueprintSchema.parse(bp);
})();

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
            { title: "為什麼異常總是晚一天", minutes: 40, module: "B1", level: null, objective: "說出目前檢驗流程的三個延遲點", method: "案例講述＋小組討論", outcome: "一張現況流程圖", keyPoints: ["紙本傳遞的延遲", "誰需要在什麼時候知道"], activity: null, elements: ["story", "theory"], carriesFrom: null, source: null, reuse: "new" },
            { title: "進料檢驗表單", minutes: 140, module: "A4", level: "L3", objective: "建立一份欄位完整、可驗證的檢驗回報表單", method: "示範後個人實作", outcome: "自己部門的進料檢驗表單", keyPoints: ["必填與驗證規則", "料號用下拉選單"], activity: "把一張紙本檢驗單改成表單並互填", elements: ["handsOn"], carriesFrom: "為什麼異常總是晚一天", source: null, reuse: "new" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "第一支 Apps Script", minutes: 90, module: "A4", level: "L4", objective: "讀懂並修改一支彙整腳本", method: "跟做＋改寫", outcome: "能每天彙整檢驗結果的腳本", keyPoints: ["編輯器與執行紀錄", "變數與迴圈只學用得到的"], activity: "改寫範例腳本，彙整自己表單的回覆", elements: ["theory", "handsOn"], carriesFrom: "進料檢驗表單", source: { kind: "unit_card", id: "uc-a4-first-script", version: null, unit: "第一支 Apps Script" }, reuse: "modify" },
            { title: "每日彙整報表", minutes: 90, module: "A4", level: "L5", objective: "產出一份每天自動更新的檢驗彙整表", method: "個人實作＋兩兩檢查", outcome: "每日檢驗彙整報表", keyPoints: ["時間觸發器", "樞紐分析接在彙整結果後面"], activity: "設定每天早上 8 點自動彙整", elements: ["handsOn", "takeaway"], carriesFrom: "第一支 Apps Script", source: null, reuse: "new" },
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
            { title: "表單觸發器", minutes: 100, module: "A4", level: "L5", objective: "在表單送出時立即判斷是否異常", method: "示範後個人實作", outcome: "送出即判斷異常的觸發器", keyPoints: ["onFormSubmit", "執行權限與授權畫面"], activity: "接上第一天的表單，送出不良品時寫入異常分頁", elements: ["theory", "handsOn"], carriesFrom: "每日彙整報表", source: { kind: "unit_card", id: "uc-a4-form-trigger", version: null, unit: "表單觸發器" }, reuse: "reuse" },
            { title: "異常通知信", minutes: 80, module: "A4", level: "L5", objective: "異常時自動寄信給品保主管與供應商窗口", method: "個人實作", outcome: "異常通知信腳本", keyPoints: ["收件人從對照表取", "信件內容帶料號與照片連結"], activity: "寫通知信並寄給自己測試", elements: ["handsOn"], carriesFrom: "表單觸發器", source: null, reuse: "new" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "寄送前的安全網", minutes: 90, module: "A4", level: "L5", objective: "避免誤寄、重寄與額度用完", method: "講述＋找碴練習", outcome: "加上三道檢查的通知腳本", keyPoints: ["測試模式開關", "重複寄送檢查", "每日寄信額度"], activity: "互相送異常單，找出對方腳本會誤寄的情況", elements: ["theory", "handsOn", "quote"], carriesFrom: "異常通知信", source: { kind: "unit_card", id: "uc-a4-safety-net", version: null, unit: "寄送前的安全網" }, reuse: "reuse" },
            { title: "交接與維護", minutes: 90, module: "B3", level: null, objective: "讓同事能接手維護這個流程", method: "分組撰寫＋互評", outcome: "流程交接說明與維護清單", keyPoints: ["誰改對照表", "腳本壞掉先看哪裡"], activity: "寫交接說明，讓隔壁組照著操作一次", elements: ["takeaway"], carriesFrom: "寄送前的安全網", source: null, reuse: "new" },
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
            { title: "AI 能做什麼、不能做什麼", minutes: 60, module: "A1", level: "L1", objective: "分辨哪些工作適合交給 AI", method: "講述＋案例", outcome: "一張「可交給 AI／不可上傳」對照表", keyPoints: ["生成、整理、比對三種用途", "哪些資料不能上傳"], activity: null, elements: ["theory", "story"], carriesFrom: null, source: fromStaffV3("AI 能做什麼、不能做什麼"), reuse: "reuse" },
            { title: "主管怎麼審 AI 的 8D 草稿", minutes: 120, module: "B2", level: "L2", objective: "用檢查清單找出 AI 草稿裡的錯誤與缺漏", method: "示範後個人實作", outcome: "一份主管審核清單", keyPoints: ["先看格式再看事實", "要求同仁附上提示詞"], activity: "審一份故意埋了三個錯的 8D 草稿", elements: ["theory", "handsOn", "quote"], carriesFrom: null, source: fromStaffV3("提示詞的四個零件"), reuse: "modify" },
          ],
        },
        {
          label: "下午",
          minutes: 180,
          units: [
            { title: "部門共用的 Project", minutes: 90, module: "A1", level: "L3", objective: "建立一個帶部門審核規範的共用 Project", method: "示範後個人實作", outcome: "部門共用 Project", keyPoints: ["審核規範寫進指示", "誰能改知識檔"], activity: "把上午的審核清單放進部門共用 Project", elements: ["handsOn", "takeaway"], carriesFrom: "主管怎麼審 AI 的 8D 草稿", source: fromStaffV3("用 Project 記住工作脈絡"), reuse: "modify" },
            { title: "帶團隊導入的第一步", minutes: 90, module: "B1", level: null, objective: "訂出團隊第一個導入的流程與負責人", method: "分組討論＋互評", outcome: "團隊導入計畫", keyPoints: ["先挑一個每週都會發生的流程", "負責人與檢查週期"], activity: "寫團隊導入計畫並兩兩互評", elements: ["takeaway"], carriesFrom: null, source: null, reuse: "new" },
          ],
        },
      ],
    },
  ],
  constraints: ["主管班與同仁班分開上，避免同仁不敢發問", "客訴信需去識別化"],
  tools: [{ name: "Claude", plan: "paid", confirmedWithClient: true }],
  openQuestions: [],
});

/** 產物版本的簡寫：沒寫的欄位用「整門課一份、AI 產出、沒有上游、沒寄給客戶、沒定稿、可用」。 */
function artifact(a: Pick<Artifact, "id" | "kind" | "version" | "blueprintVersion" | "createdAt"> & Partial<Artifact>): Artifact {
  return { day: null, upstreamIds: [], editedFromId: null, sentToClientAt: null, finalizedAt: null, status: "ready", ...a };
}

export const COURSES: Course[] = [
  {
    id: "c-claude-intro",
    projectId: "p-a-2026",
    title: "Claude 入門",
    audiences: ["生管資材", "品保", "業務"],
    tools: ["Claude", "Claude Project"],
    industries: ["製造"],
    scenarios: ["文書", "會議與紀錄"],
    source: { moduleIds: ["A1", "B1", "B2"], industryPackId: "ip-manufacturing" },
    copiedFrom: null,
    closedAt: null,
    blueprint: claudeIntroBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-09-12T15:20:00+08:00", note: "由模組卡與製造業的產業素材包談出初版", finalizedAt: null },
      { version: 2, createdAt: "2026-09-26T11:05:00+08:00", note: "加入供應商來信案例", finalizedAt: "2026-09-28T10:00:00+08:00" },
      { version: 3, createdAt: "2026-10-07T16:40:00+08:00", note: "Project 單元延長到 120 分鐘", finalizedAt: "2026-10-07T18:00:00+08:00" },
    ],
    artifacts: [
      artifact({ id: "a-ci-outline-1", kind: "outline", version: 1, blueprintVersion: 2, sentToClientAt: "2026-09-28T09:30:00+08:00", createdAt: "2026-09-27T10:00:00+08:00" }),
      artifact({ id: "a-ci-prep-1", kind: "prep_sheet", version: 1, blueprintVersion: 2, createdAt: "2026-09-27T10:05:00+08:00" }),
      artifact({ id: "a-ci-script-d1-1", kind: "page_script", day: 1, version: 1, blueprintVersion: 2, finalizedAt: "2026-09-28T18:00:00+08:00", createdAt: "2026-09-28T15:00:00+08:00" }),
      artifact({ id: "a-ci-slides-1", kind: "slides", day: 1, version: 1, blueprintVersion: 2, upstreamIds: ["a-ci-script-d1-1"], createdAt: "2026-09-28T21:30:00+08:00" }),
      artifact({ id: "a-ci-handbook-1", kind: "handbook", version: 1, blueprintVersion: 2, upstreamIds: ["a-ci-script-d1-1"], createdAt: "2026-09-29T20:10:00+08:00" }),
      artifact({ id: "a-ci-outline-2", kind: "outline", version: 2, blueprintVersion: 3, createdAt: "2026-10-07T17:00:00+08:00" }),
      artifact({ id: "a-ci-prep-2", kind: "prep_sheet", version: 2, blueprintVersion: 3, createdAt: "2026-10-07T17:05:00+08:00" }),
      artifact({ id: "a-ci-script-d1-2", kind: "page_script", day: 1, version: 2, blueprintVersion: 3, finalizedAt: "2026-10-07T21:00:00+08:00", createdAt: "2026-10-07T19:00:00+08:00" }),
      artifact({ id: "a-ci-slides-2", kind: "slides", day: 1, version: 2, blueprintVersion: 3, upstreamIds: ["a-ci-script-d1-2"], createdAt: "2026-10-07T22:15:00+08:00" }),
      // 講師把 v2 改過再上傳：沿用 v2 的藍圖與上游綁定
      artifact({ id: "a-ci-slides-3", kind: "slides", day: 1, version: 3, blueprintVersion: 3, upstreamIds: ["a-ci-script-d1-2"], editedFromId: "a-ci-slides-2", createdAt: "2026-10-08T08:30:00+08:00" }),
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
    audiences: ["部門主管"],
    tools: ["Claude"],
    industries: ["製造"],
    scenarios: ["文書", "知識整理"],
    source: { moduleIds: ["A1", "B2", "B3"], industryPackId: "ip-manufacturing" },
    copiedFrom: { courseId: "c-claude-intro", blueprintVersion: 3 },
    closedAt: null,
    blueprint: claudeIntroManagersBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-10-08T09:30:00+08:00", note: "以「Claude 入門」藍圖 v3 為底複製，改成主管視角", finalizedAt: null },
    ],
    artifacts: [],
    materials: [],
  },
  {
    id: "c-claude-advanced",
    projectId: "p-a-2026",
    title: "Claude 進階",
    audiences: ["生管資材", "品保"],
    tools: ["Claude", "Claude Project"],
    industries: ["製造"],
    scenarios: ["文書", "數據分析"],
    source: { moduleIds: ["B1", "B2", "B3"], industryPackId: "ip-manufacturing" },
    copiedFrom: null,
    closedAt: null,
    blueprint: claudeAdvancedBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-10-05T14:00:00+08:00", note: "由模組卡談出初版，帶入專案的客戶背景", finalizedAt: null },
    ],
    artifacts: [],
    materials: [],
  },
  {
    id: "c-pa-finance",
    projectId: "p-b-2026",
    title: "請款簽核工作坊",
    audiences: ["財務", "行政"],
    tools: ["Power Automate", "Microsoft Teams"],
    industries: ["金融"],
    scenarios: ["文書", "客服與信件"],
    source: { moduleIds: ["A4", "B3"], industryPackId: "ip-finance-approval" },
    copiedFrom: null,
    closedAt: null,
    blueprint: paFinanceBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-08-28T10:00:00+08:00", note: "由模組卡與金融業的產業素材包談出初版", finalizedAt: null },
      { version: 2, createdAt: "2026-09-10T09:30:00+08:00", note: "逾期提醒獨立成一個單元", finalizedAt: "2026-09-11T09:00:00+08:00" },
    ],
    artifacts: [
      artifact({ id: "a-pa-outline-1", kind: "outline", version: 1, blueprintVersion: 2, sentToClientAt: "2026-09-10T15:00:00+08:00", createdAt: "2026-09-10T12:00:00+08:00" }),
      artifact({ id: "a-pa-prep-1", kind: "prep_sheet", version: 1, blueprintVersion: 2, createdAt: "2026-09-10T12:05:00+08:00" }),
      artifact({ id: "a-pa-script-d1-1", kind: "page_script", day: 1, version: 1, blueprintVersion: 2, finalizedAt: "2026-09-12T10:00:00+08:00", createdAt: "2026-09-11T20:00:00+08:00" }),
      artifact({ id: "a-pa-slides-1", kind: "slides", day: 1, version: 1, blueprintVersion: 2, upstreamIds: ["a-pa-script-d1-1"], createdAt: "2026-09-12T22:00:00+08:00" }),
      artifact({ id: "a-pa-handbook-1", kind: "handbook", version: 1, blueprintVersion: 2, upstreamIds: ["a-pa-script-d1-1"], createdAt: "2026-09-13T20:00:00+08:00" }),
    ],
    materials: [{ id: "m-pa-fields", name: "請款單欄位對照.xlsx", sizeKb: 36 }],
  },
  {
    id: "c-gas-two-day",
    projectId: "p-e-2026",
    title: "Apps Script 兩天實戰營",
    audiences: ["生管資材", "品保"],
    tools: ["Google 試算表", "Google Apps Script"],
    industries: ["製造"],
    scenarios: ["數據分析", "客服與信件"],
    source: { moduleIds: ["A4", "B1"], industryPackId: "ip-manufacturing" },
    copiedFrom: null,
    closedAt: null,
    blueprint: gasTwoDayBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-09-22T10:00:00+08:00", note: "由模組卡與製造業的產業素材包談出初版，一天", finalizedAt: null },
      { version: 2, createdAt: "2026-10-01T15:30:00+08:00", note: "拆成兩天：第一天彙整、第二天通知，每天上午下午各 180 分鐘", finalizedAt: "2026-10-02T12:00:00+08:00" },
    ],
    // 示範只改第一天逐頁腳本：第一天簡報與學員手冊過期，第二天簡報不受影響
    artifacts: [
      artifact({ id: "a-gas-outline-1", kind: "outline", version: 1, blueprintVersion: 2, sentToClientAt: "2026-10-02T11:00:00+08:00", createdAt: "2026-10-01T17:00:00+08:00" }),
      artifact({ id: "a-gas-prep-1", kind: "prep_sheet", version: 1, blueprintVersion: 2, createdAt: "2026-10-01T17:05:00+08:00" }),
      artifact({ id: "a-gas-script-d1-1", kind: "page_script", day: 1, version: 1, blueprintVersion: 2, finalizedAt: "2026-10-04T10:00:00+08:00", createdAt: "2026-10-03T14:00:00+08:00" }),
      artifact({ id: "a-gas-script-d2-1", kind: "page_script", day: 2, version: 1, blueprintVersion: 2, finalizedAt: "2026-10-04T11:00:00+08:00", createdAt: "2026-10-03T16:00:00+08:00" }),
      artifact({ id: "a-gas-slides-d1-1", kind: "slides", day: 1, version: 1, blueprintVersion: 2, upstreamIds: ["a-gas-script-d1-1"], createdAt: "2026-10-04T20:00:00+08:00" }),
      artifact({ id: "a-gas-slides-d2-1", kind: "slides", day: 2, version: 1, blueprintVersion: 2, upstreamIds: ["a-gas-script-d2-1"], createdAt: "2026-10-04T22:00:00+08:00" }),
      artifact({ id: "a-gas-handbook-1", kind: "handbook", version: 1, blueprintVersion: 2, upstreamIds: ["a-gas-script-d1-1", "a-gas-script-d2-1"], createdAt: "2026-10-05T10:00:00+08:00" }),
      artifact({ id: "a-gas-script-d1-2", kind: "page_script", day: 1, version: 2, blueprintVersion: 2, editedFromId: "a-gas-script-d1-1", createdAt: "2026-10-06T21:00:00+08:00" }),
    ],
    materials: [],
  },
  {
    // 示範「可以結案」：場次已上完、每天的逐頁腳本與簡報都有講師上傳的最終版，結案閘全過
    id: "c-pa-pilot",
    projectId: "p-f-2026",
    title: "請款簽核先導班",
    audiences: ["財務", "行政"],
    tools: ["Power Automate", "Microsoft Teams"],
    industries: ["金融"],
    scenarios: ["文書", "客服與信件"],
    source: { moduleIds: ["A4", "B3"], industryPackId: "ip-finance-approval" },
    copiedFrom: null,
    closedAt: null,
    blueprint: paPilotBlueprint,
    blueprintHistory: [
      { version: 1, createdAt: "2026-08-10T10:00:00+08:00", note: "由模組卡與金融業的產業素材包談出初版", finalizedAt: null },
      { version: 2, createdAt: "2026-08-18T09:30:00+08:00", note: "先導班只留差旅請款一條流程", finalizedAt: "2026-08-19T09:00:00+08:00" },
    ],
    artifacts: [
      artifact({ id: "a-pp-outline-1", kind: "outline", version: 1, blueprintVersion: 2, sentToClientAt: "2026-08-19T15:00:00+08:00", createdAt: "2026-08-19T12:00:00+08:00" }),
      artifact({ id: "a-pp-prep-1", kind: "prep_sheet", version: 1, blueprintVersion: 2, createdAt: "2026-08-19T12:05:00+08:00" }),
      artifact({ id: "a-pp-script-d1-1", kind: "page_script", day: 1, version: 1, blueprintVersion: 2, finalizedAt: "2026-08-21T10:00:00+08:00", createdAt: "2026-08-20T20:00:00+08:00" }),
      artifact({ id: "a-pp-slides-1", kind: "slides", day: 1, version: 1, blueprintVersion: 2, upstreamIds: ["a-pp-script-d1-1"], createdAt: "2026-08-21T22:00:00+08:00" }),
      // 課後講師上傳實際上課用的版本：兩個都是最終版
      artifact({ id: "a-pp-script-d1-2", kind: "page_script", day: 1, version: 2, blueprintVersion: 2, upstreamIds: [], editedFromId: "a-pp-script-d1-1", createdAt: "2026-09-05T20:00:00+08:00" }),
      artifact({ id: "a-pp-slides-2", kind: "slides", day: 1, version: 2, blueprintVersion: 2, upstreamIds: ["a-pp-script-d1-1"], editedFromId: "a-pp-slides-1", createdAt: "2026-09-05T20:30:00+08:00" }),
    ],
    materials: [],
  },
];

const SLIDO_CI_1015: { label: string; url: string } = { label: "Slido 互動", url: "https://app.sli.do/event/demo-a1015" };
const SLIDO_PA_0918 = { label: "Slido 互動", url: "https://app.sli.do/event/demo-b0918" };
const SLIDO_PA_1029 = { label: "Slido 互動", url: "https://app.sli.do/event/demo-b1029" };
const SLIDO_CA_1105 = { label: "Slido 互動", url: "https://app.sli.do/event/demo-a1105" };
const SLIDO_GAS_1020 = { label: "Slido 互動", url: "https://app.sli.do/event/demo-e1020" };

export const SESSIONS: Session[] = [
  {
    id: "s-ci-1015",
    courseId: "c-claude-intro",
    days: [{ startsAt: "2026-10-15T09:00:00+08:00", endsAt: "2026-10-15T16:00:00+08:00", venue: "A 公司台中廠 3F 訓練教室", instructorId: "inst-lin" }],
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
    days: [{ startsAt: "2026-10-22T09:00:00+08:00", endsAt: "2026-10-22T16:00:00+08:00", venue: "A 公司台中廠 3F 訓練教室", instructorId: "inst-lin" }],
    links: [],
    publication: null,
    portal: { code: "a1022", closedAt: null, expiresAtOverride: null },
  },
  {
    id: "s-ca-1105",
    courseId: "c-claude-advanced",
    days: [{ startsAt: "2026-11-05T13:30:00+08:00", endsAt: "2026-11-05T16:30:00+08:00", venue: null, instructorId: "inst-chou" }],
    links: [SLIDO_CA_1105],
    publication: null,
    portal: { code: "a1105", closedAt: null, expiresAtOverride: null },
  },
  {
    id: "s-pa-0918",
    courseId: "c-pa-finance",
    days: [{ startsAt: "2026-09-18T09:30:00+08:00", endsAt: "2026-09-18T16:30:00+08:00", venue: "B 公司 8F 大會議室", instructorId: "inst-lin" }],
    links: [SLIDO_PA_0918],
    publication: {
      publishedAt: "2026-09-16T17:00:00+08:00",
      artifactIds: ["a-pa-outline-1", "a-pa-slides-1", "a-pa-handbook-1"],
      materialIds: ["m-pa-fields"],
      links: [SLIDO_PA_0918],
    },
    portal: { code: "b0918", closedAt: null, expiresAtOverride: null },
  },
  {
    // 同一門課的第二梯：產物都定稿、沒過期，素材、連結、發布都齊了，示範「準備好了」
    id: "s-pa-1029",
    courseId: "c-pa-finance",
    days: [{ startsAt: "2026-10-29T09:30:00+08:00", endsAt: "2026-10-29T16:30:00+08:00", venue: "B 公司 8F 大會議室", instructorId: "inst-lin" }],
    links: [SLIDO_PA_1029],
    publication: {
      publishedAt: "2026-10-07T17:00:00+08:00",
      artifactIds: ["a-pa-outline-1", "a-pa-slides-1", "a-pa-handbook-1"],
      materialIds: ["m-pa-fields"],
      links: [SLIDO_PA_1029],
    },
    portal: { code: "b1029", closedAt: null, expiresAtOverride: null },
  },
  {
    // 兩天課程一個場次：每一天各有日期、地點與授課講師
    id: "s-gas-1020",
    courseId: "c-gas-two-day",
    days: [
      { startsAt: "2026-10-20T09:00:00+08:00", endsAt: "2026-10-20T16:00:00+08:00", venue: "E 公司新竹廠 2F 會議室", instructorId: "inst-lin" },
      { startsAt: "2026-10-27T09:00:00+08:00", endsAt: "2026-10-27T16:00:00+08:00", venue: "E 公司新竹廠 2F 會議室", instructorId: "inst-chou" },
    ],
    links: [SLIDO_GAS_1020],
    // 一次發布可以包含每一天的簡報；學員入口只顯示當天那份與整門課的學員手冊
    publication: {
      publishedAt: "2026-10-05T18:00:00+08:00",
      artifactIds: ["a-gas-slides-d1-1", "a-gas-slides-d2-1", "a-gas-handbook-1"],
      materialIds: [],
      links: [SLIDO_GAS_1020],
    },
    portal: { code: "e1020", closedAt: null, expiresAtOverride: null },
  },
  {
    id: "s-pp-0904",
    courseId: "c-pa-pilot",
    days: [{ startsAt: "2026-09-04T09:30:00+08:00", endsAt: "2026-09-04T16:30:00+08:00", venue: "F 公司財務部會議室", instructorId: "inst-lin" }],
    links: [],
    publication: null,
    portal: { code: "f0904", closedAt: null, expiresAtOverride: null },
  },
];

/** 知識庫草稿：一開始沒有，課程結案時才會產生（closing-drafts.ts）。 */
export const KNOWLEDGE_DRAFTS: KnowledgeDraft[] = [];
