---
name: "rpai-pptx-workflow"
description: "為 RPAI 數位優化器製作簡報（.pptx）。 當使用者說「幫我做簡報」、「製作投影片」、「RPAI 講座 deck」、「教學簡報」、「活動簡報」、 「RPAI Talks」、「超自動化簡報」、「RPA 教學投影片」時立即觸發此 skill。 本 skill 在生成前必做「敘事模型選擇」討論：根據主題主動推薦 2-3 個合適的敘事框架 （SWOT / AIDA / SCQA / 設計思維 / PDCA 等 25 種模型），附 3-5 頁骨架預覽讓使用者拍板。 本 skill 依賴 rpai-brand-guidelines 作為品牌規範基礎，並透過呼叫 Skill: anthropic-skills:pptx 產出 .pptx 檔案。"
---

<!-- 變更 2026-07-05：字級權威改為「brand-guidelines 媒介分層授權管轄」（非片面覆寫），並明確色彩／語氣／字型家族仍歸 brand-guidelines -->
<!-- 變更 2026-07-26：編號圓圈預設改為「Navy 描邊圈強調」；新增「淺色頁強調」章節與反面案例。 -->
<!-- 變更 2026-10-11（v2.1）：
  1. 視覺改為「課程簡報」版型：White 內容頁＋Ice 卡、頁眉 kicker＋標題＋短強調線、底部 Navy 結論條、Navy 編號方塊、Navy 漸層深色頁、左側大號章節編號、頁尾「品牌 · 課程名」＋「n / N」。取代舊版的 F8FAFC 網格背景、置中浮水印與純數字頁碼。
  2. 吸收 open-slide 概念：一頁一檔、元件庫、留言驅動修改、一鍵 QA。產出仍為 .pptx。元件庫程式碼內嵌於「附錄 A」。
  3. 新增畫面型元件：分割頁、圖示格、泳道流程圖、2×2 矩陣、決策樹、素材框、深色互動頁、階梯卡、關鍵句。
  4. 新增節奏規則：結論條 ≤ 1/3 頁、不連續三頁同元件、每 4–6 頁穿插深色頁。
  5. 素材規則：要放截圖、影片、照片的地方一律只拉素材框，由講師自行放入。
  6. 兩條硬規則、設計哲學、敘事模型選擇維持不變。 -->
<!-- 變更 2026-10-13（v2.2）：頁尾（左「RPAI 數位優化器 · 課程名」、右「n / N」）固定 12pt，是 16pt 下限的唯一例外；元件庫 footer() 與 qa.sh 同步更新（QA 只豁免頁尾這兩段文字）。 -->
<!-- 變更 2026-10-19（v2.3）：頁尾改為左下角「Copyright © RPAI 數位優化器」單一段文字，12pt；移除頁碼與課程名；淺色頁 Navy、深色頁與分割頁左半 White。元件庫 footer() 與 qa.sh 同步更新。 -->

# RPAI 簡報製作 Skill（v2.3）

## 依賴關係

- `rpai-brand-guidelines`：品牌色彩、語氣規範（色彩唯一源頭）；簡報專用的開放元件寫在其「簡報場景例外」段
- `pptx`：pptxgenjs 技術細節、`scripts/office/validate.py`、`scripts/office/soffice.py`（透過 `Skill: anthropic-skills:pptx` 取得）
- `rpai-talk-blueprint`：上游教學藍圖（有就讀，不重問）

> **字級與字重：簡報場景由本 skill 管轄（brand-guidelines「媒介分層」已明文授權）。** brand-guidelines 的 Type Scale 適用於網頁與社群；簡報一律依本 skill 的「兩條硬規則」與字級表。**色彩、語氣、字型家族仍以 brand-guidelines 為唯一源頭。**

---

# 第零層：兩條不可違反的硬規則（最高優先）

1. **全文粗體**：每一個文字元素都必須 `bold: true`，沒有例外（元件庫的 `txt()`／`R()` 已預設）。
2. **最小字級 16pt**：來源、表格、圖說、標籤全部 ≥ 16pt；弱化靠 `transparency`，不靠縮字。
   **唯一例外：頁尾**（左下角「Copyright © RPAI 數位優化器」）固定 **12pt**，不可放大也不可再縮；**不放頁碼**。

> **密度後果**：16pt 地板會讓每頁能放的字大幅變少——**寧可多拆一頁，也不要硬塞**。

產出後跑 `qa.sh`，「小於16pt（頁尾12pt除外）」與「非粗體」都必須是 0。

---

# 第一層：設計哲學

> 這五條原則的優先級高於所有技術規範，衝突時以原則為準。

1. **乾淨優先**：寧可少放一個元素。猶豫要不要加裝飾，答案是不加。簡潔 ≠ 空白——每個元素都有存在的理由。
2. **每頁一個視覺錨點**：觀眾 3 秒內知道重點。可以是一個大數字、一句關鍵句、一組對比、一張圖；不能是「六個並排的同樣大小卡片」。
3. **版型跟著內容走**：先想這頁的核心訊息，再挑最能傳達它的元件。能畫成流程圖、矩陣、決策樹的，不要寫成卡片條列。
4. **間距是設計的一部分**：標題與內容、項目之間、頁緣與內容的距離都要有意識地設定；太擠和太空都是問題。
5. **素材只拉框**：要放截圖、影片、照片的地方用 `mediaFrame` 拉框並寫清楚放什麼，由講師自行放入；不為了「有圖」硬放不相關的裝飾或假圖。

### 反面案例（過去被退回的問題）

- **版面單調**：❌ 每頁都是「頁眉＋一排卡片＋底部結論條」；❌ 結論條用在超過一半的頁面，重點反而被稀釋；❌ 連續三頁同一種元件。
- **間距失控**：❌ 內容只佔頁面 40%；❌ 間距忽大忽小。
- **封面過度設計**：封面只放主題、副標、最多三個主題 pill、講師資訊；不放網址 pill、日期 badge、Unit 列表。
- **字體層級錯誤**：❌ 標題跟說明文字差不多大；❌ 深色背景用灰色文字。
- **強調不足**：❌ 帶走頁、轉折句、關鍵數字只用 IceD 淡底 → 改用 `keyline`、`takeaway`、描邊或深色頁。
- **修改時過度補償**：修改是「調整已有的」，不是「加東西」。
- **資訊呈現不當**：❌ 一頁塞兩個主題；❌ 英文單字被拆行（如「Share/Point」）。

---

# 第二層：視覺系統

## 頁面骨架

| 區域 | 規格 |
|---|---|
| 畫布 | `LAYOUT_WIDE` 13.33 × 7.5 吋 |
| 內容頁底色 | White `#FFFFFF`，卡片用 Ice `#E9F3F5`／IceD `#DBEAEE`，小圓角 0.05 |
| 頁眉 kicker | y 0.4，16pt：編號 Navy ＋「 · 分類」Body 色 |
| 標題 | y 0.8，28pt Navy；下方短強調線 x 0.64、y 1.56、w 0.85、h 0.06 |
| 內容區 | y 1.95 起，底線 6.85 |
| 頁尾 | 左下角 x 0.5、y 7.0，**12pt**：「Copyright © RPAI 數位優化器」；淺色頁 Navy（transparency 30），深色頁與分割頁左半 White（transparency 50）；**不放頁碼、不放課程名**（每頁只放這一處品牌識別） |
| 深色頁 | 背景圖 `assets/bg-dark.jpg`（Navy 漸層＋十字座標＋同心圓，附錄 A 有產生腳本） |

## 元件詞彙——選版型就是選元件

**結構型**（框架、清單）

| 元件 | 用途 |
|---|---|
| `stepCards(items, {arrows, highlight, stairs})` | 步驟或並列概念 3–5 欄；`stairs` 變成階梯（成長路徑） |
| `compare(cols)` | 兩欄對照，含標題、副標、◆ 條列 |
| `rows(items)` | 示範步驟、清單，每列一張卡＋編號方塊 |
| `sideCard(title, items)` | 右側重點清單 |
| `table(head, body)` | Navy 表頭＋斑馬紋 |

**畫面型**（讓頁面有視覺重心，優先使用）

| 元件 | 用途 |
|---|---|
| `split({left, right})` | 半深半淺分割頁，做強烈的 A vs B 對比 |
| `iconGrid(items, {cols})` | 場景、工具、部門並列；`hl` 標記重點格，`tag` 放分類 |
| `flow(lanes)` | 泳道流程圖，節點依欄位對齊，跨泳道自動畫折線箭頭 |
| `matrix({quads, dots})` | 2×2 優先矩陣，標記點用白底描邊圈 |
| `tree({root, branches})` | 決策樹：問題 → 條件 → 結果 |
| `mediaFrame({x,y,w,h,label})` | 素材框：截圖、影片、照片的位置 |

**強調型**

| 元件 | 用途 |
|---|---|
| `takeaway(text, {label})` | 底部 Navy 結論條；只給最要被記住的那句話 |
| `keyline(text)` | 無底色關鍵句（Navy 左強調條＋大字），取代多數結論條 |

**深色頁**：`cover` 封面、`divider` 章節頁（左側 100pt Teal 編號）、`statement` 金句或數據、`darkPrompt` 深色互動頁；淺色互動頁用 `prompt`。

## 節奏規則（避免版面單調）

1. **結論條 ≤ 1/3 頁**：其餘頁面用 `keyline` 或不放。
2. **不連續三頁使用同一種元件**（同系列示範頁除外）。
3. **每 4–6 頁穿插一張深色頁**（章節、金句、數據、深色互動頁）。
4. **至少 1/4 的內容頁是畫面型元件**；藍圖摘要階段就標出每頁用哪個元件。

## 色彩應用

- 每頁填色不超過三種（含背景），文字色不計。
- 簡報開放的 Navy 實心元件只有：結論條、編號方塊（≤ 0.62 × 0.52 吋）、表格表頭、標題下短強調線、分割頁深色左半邊。Navy 卡片、banner、實心圓、整欄側邊仍禁止。
- Teal 只出現在深色頁、Navy 結論條內、分割頁深色半邊；不得直接出現在白底或 Ice 卡上。
- 功能色 `#CC3333` 只用於警示文字與【待填】佔位，不做色塊。
- 符號用 Unicode 幾何字（● ◆ ▶ ✓ → ›），不用 emoji。

---

# 第三層：工作流程

## Step 0：生成前確認（每次必做）

**先找上游文件**：對話或 outputs 有 `*_課程內容腳本.md` → 逐頁結構直接沿用；只有 `*_教學藍圖.md` → 受眾、目標、敘事主軸不重問；都沒有 → 照下方三區塊確認。製作中若改動藍圖層級決策，先回寫藍圖。

- **區塊 A 講者**：姓名職稱、要不要講者介紹頁、單一或多位講者。
- **區塊 B 受眾與目標**：受眾是誰；看完要知道什麼、感受什麼、採取什麼行動。
- **區塊 C 內容與格式**：大綱是否完整、頁數範圍（預設 15–25）、必放素材、**敘事模型選擇（不可跳過）**。

### 敘事模型推薦格式

主動從附錄 B 挑 2–3 個差異明顯的候選（例如一個分析型＋一個說服型），不要反問。每個候選：

```
【候選 1：<模型名稱>】
為什麼適合：<1–2 句>
敘事骨架預覽（3–5 頁）：P1. <標題> — <這頁要傳達什麼> …
適合的氛圍：<分析型／說服型／行動導向…>
```

### 確認閘門：簡報藍圖摘要

```
【簡報藍圖摘要】
受眾：___，目標：___
敘事模型：___　頁數：約 __ 張
| # | 頁面標題 | 目的（一句話） | 元件 |
敘事邏輯：___　閉環頁：P_ ↔ P_
```

產出前先檢查節奏規則。**使用者確認後才進入程式碼階段。**

## Step 1：建立 deck 工作區（一頁一檔）

把附錄 A 的 `theme.js`、`build.js`、`qa.sh` 寫進工作區，`mkdir -p assets slides` 後執行背景圖腳本，再建立：

```
<deck>/
├── deck.config.js   # { title, author, course, slidesDir: "slides", output }
├── theme.js / build.js / qa.sh
├── comments.md      # 修改留言
├── assets/bg-dark.jpg
└── slides/01-cover.js, 02-speaker.js, ...
```

slide 檔格式：

```javascript
module.exports = {
  section: "桌面機器人",          // PowerPoint 區段
  kicker: "01|講師示範",          // 「編號|分類」；無編號只寫分類
  title: "現場示範：104 職缺薪資行情調查",
  layout: "light",                // light｜dark（封面、章節、金句、數據、互動）｜split
  render(s, T) {
    T.mediaFrame(s, { x: 0.62, y: 1.95, w: 7.6, h: 4.6, label: "PAD 流程截圖／錄影放這裡" });
    T.rows(s, [{ t: "開啟 104 網站" }, { t: "輸入職稱搜尋" }], { x: 8.55, w: 4.16, rowH: 1.0 });
  },
  notes: `講稿：時間點、口白、互動預設回應、備案時機`,
};
```

規則：一個檔案只放一頁；插頁用 `12a-` 命名；需要新版型就加進 theme.js，不在 slide 檔重寫；講稿寫在 `notes`；佔位內容用 `T.PH()`（紅字【待填】）。

## Step 2：產出與 QA

```bash
node build.js && bash qa.sh "<output>.pptx" qa
```

逐張看 `qa/grid*.jpg`，重點檢查：
- 英文單字被拆行 → 用 `\n` 手動斷行或縮短文案
- 卡片與結論條、關鍵句重疊 → 調整卡片 `h` 或下方元件 `y`
- 圖示格說明超出卡片 → 加大 `cellH` 或拿掉說明
- 大字（≥ 60pt）溢出 → 降字級或加寬文字框
- LibreOffice 表格列高會比 `rowH` 略高，表格下方預留 0.2 吋以上

## Step 3：留言驅動修改（open-slide 的 apply-comments 概念）

使用者用「頁碼＋留言」提修改，可在對話裡說，或寫進 `comments.md`：

```markdown
- p11: 右側改成三個 HR 會在意的看點
- p12-13 之間: 插一頁 Demo 失敗時的備案說明
```

1. 依頁碼找到對應 slide 檔，**只改那幾個檔案**；全域性留言才改 theme.js。
2. 重建並跑 qa.sh，只回報有改的頁面。
3. 已處理的留言標記 `[done]` 或刪除。
4. 動到教學藍圖層級的決策，先回寫藍圖。

---

# 第四層：文字與技術防線

## 字級表（全粗體）

| 層級 | 字級 |
|---|---|
| 封面主標 | 44pt |
| 章節頁編號／標題 | 100pt／36pt |
| 金句 | 48pt；深色互動頁問題 36pt |
| 內容頁標題 | 28pt |
| 卡片標題 | 21–22pt |
| 正文、條列、表格 | 18pt |
| kicker、標籤 | 16pt |
| 頁尾（Copyright © RPAI 數位優化器） | 12pt（唯一例外） |

密度：條列每卡 ≤ 4 條、每條一行；卡片說明 2–3 行封頂；一頁只講一件事。字型統一 `Microsoft JhengHei`。

## 文字陷阱

- **中文標點掉行**：一個完整子句（含結尾標點）放在同一個 run，只在真正要分段處用 `breakLine: true`。
- **不要用空字串 breakLine 做間距**：用 `paraSpaceAfter`。
- **大字號寬度要給足**：≥ 150pt 時文字框寬至少 `字號 × 0.05 吋 × 字數`，再留 20% 緩衝。

## pptxgenjs 陷阱

- 背景用 `s.background = { color }` 或 `{ path }`；漸層靠背景圖。
- 形狀用 `pres.shapes.OVAL`（沒有 ELLIPSE）；`ROUNDED_RECTANGLE` 才有 `rectRadius`；箭頭線用 `line.endArrowType: "triangle"`。
- 色碼 6 位 hex、不加 `#`；陰影物件每次新建（元件庫 `shadow()` 已處理）。
- Section 必須在 addSlide 前宣告（build.js 已依 slide 檔的 `section` 自動處理）。
- 容器網路有白名單，scripts 不呼叫外部 API。

## 閉環頁視覺呼應

| 模型 | 閉環頁 | 呼應要求 |
|---|---|---|
| SCQA | Question ↔ Answer | 同元件、同字級、同強調處理 |
| AIDA | Attention ↔ Action | Attention 用的視覺記號，Action 頁要回呼 |
| PDCA | 四個階段標題頁 | 同構，只差文字 |
| 設計思維 | 共感 ↔ 測試 | 相同的使用者視角圖像語言 |

藍圖摘要就標註閉環頁，之後改其中一頁時同步改另一頁。

---
# 附錄 A：元件庫與工具（建立工作區時原樣寫入）

### theme.js

```javascript
// RPAI Deck Theme v2 —— 元件庫（open-slide 概念：版型是元件，頁面是檔案）
// 硬規則：全文粗體、最小 16pt（頁尾 12pt 例外）、色彩只用 RPAI token。
const path = require("path");

const F = "Microsoft JhengHei";
const C = {
  navy: "011455", teal: "7AFFF5", white: "FFFFFF", ice: "E9F3F5",
  iced: "DBEAEE", body: "454650", navyD: "000D3A", red: "CC3333",
};
const W = 13.333;
const BG_DARK = path.join(__dirname, "assets", "bg-dark.jpg");

function createTheme(pres, meta) {
  const R = (text, o = {}) => ({ text, options: Object.assign({ bold: true, fontFace: F }, o) });
  const txt = (s, text, o) => s.addText(text, Object.assign({
    fontFace: F, bold: true, isTextBox: true, margin: 0, valign: "top", color: C.body, fontSize: 18,
  }, o));
  const shadow = () => ({ type: "outer", blur: 14, offset: 2, angle: 90, color: C.navy, opacity: 0.1 });
  const TONE = { ice: C.ice, iced: C.iced, white: C.white };

  // ---------- 基礎元件 ----------
  function card(s, x, y, w, h, { tone = "ice", outline = false, shadow: sh = true } = {}) {
    const o = { x, y, w, h, rectRadius: 0.05, fill: { color: TONE[tone] || tone }, line: outline ? { color: C.navy, width: 2 } : { type: "none" } };
    if (sh) o.shadow = shadow();
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, o);
  }
  function badge(s, x, y, label, { w = 0.62, h = 0.52, fs = 18 } = {}) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.05, fill: { color: C.navy }, line: { type: "none" } });
    txt(s, label, { x, y, w, h, fontSize: fs, color: C.white, align: "center", valign: "middle" });
  }
  function iconDot(s, x, y, d, label, fs = 20) {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.iced }, line: { type: "none" } });
    txt(s, label, { x, y, w: d, h: d, fontSize: fs, color: C.navy, align: "center", valign: "middle" });
  }
  function rule(s, x, y, w, color = C.iced, width = 1.5) {
    s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width } });
  }
  function bullets(s, items, { x, y, w, h, marker = "◆", fs = 18, gap = 8, color = C.body }) {
    const runs = [];
    items.forEach((t, i) => {
      runs.push(R(`${marker}  `, { color: C.navy }));
      runs.push(R(t, { color, breakLine: i < items.length - 1 }));
    });
    txt(s, runs, { x, y, w, h, fontSize: fs, paraSpaceAfter: gap });
  }
  function arrow(s, x, y, w, h) {
    txt(s, "›", { x, y, w, h, fontSize: 28, color: C.navy, align: "center", valign: "middle", transparency: 25 });
  }

  // ---------- 頁面框架 ----------
  function header(s, kicker, title) {
    if (kicker) {
      const [num, label] = kicker.includes("|") ? kicker.split("|") : ["", kicker];
      const runs = [];
      if (num) runs.push(R(num, { color: C.navy }));
      runs.push(R(`${num ? "  ·  " : "·  "}${label}`, { color: C.body, transparency: 15 }));
      txt(s, runs, { x: 0.62, y: 0.4, w: 11, h: 0.4, fontSize: 16, valign: "middle" });
    }
    if (title) {
      txt(s, title, { x: 0.6, y: 0.8, w: 12.1, h: 0.72, fontSize: 28, color: C.navy, valign: "middle" });
      s.addShape(pres.shapes.RECTANGLE, { x: 0.64, y: 1.56, w: 0.85, h: 0.06, fill: { color: C.navy }, line: { type: "none" } });
    }
  }
  function footer(s, i, total, mode) {
    // mode: "dark" | "light" | "split"（左半深色、右半淺色；頁尾在左下角，split 時落在深色半邊）
    // 頁尾固定 12pt，是 16pt 下限的唯一例外；不放頁碼、不放課程名
    const onDark = mode !== "light";
    txt(s, "Copyright © RPAI 數位優化器", { x: 0.5, y: 7.0, w: 6, h: 0.35, fontSize: 12, color: onDark ? C.white : C.navy, transparency: onDark ? 50 : 30, valign: "middle" });
  }
  function light(def) {
    const s = pres.addSlide({ sectionTitle: def.section });
    s.background = { color: C.white };
    if (def.layout !== "split") header(s, def.kicker, def.title);
    return s;
  }
  function dark(def) {
    const s = pres.addSlide({ sectionTitle: def.section });
    s.background = { path: BG_DARK };
    return s;
  }

  // ---------- 版型元件（附件母題） ----------
  // 結論條：頁面底部的全寬深色條（允許的 Navy 實心例外）
  function takeaway(s, text, { label, y = label ? 5.55 : 5.95, h = label ? 1.0 : 0.78 } = {}) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.62, y, w: 12.09, h, rectRadius: 0.05, fill: { color: C.navy }, line: { type: "none" } });
    if (label) {
      txt(s, label, { x: 1.0, y: y + 0.1, w: 11.3, h: 0.32, fontSize: 16, color: C.teal, valign: "middle" });
      txt(s, [R("›  ", { color: C.teal }), R(text, { color: C.white })], { x: 1.0, y: y + 0.42, w: 11.3, h: h - 0.5, fontSize: 18, valign: "middle" });
    } else {
      txt(s, [R("›  ", { color: C.teal }), R(text, { color: C.white })], { x: 1.0, y, w: 11.3, h, fontSize: 20, valign: "middle" });
    }
  }
  // 步驟卡：編號方塊＋標題＋說明，可帶箭頭
  function stepCards(s, items, { y = 1.95, h = 2.55, arrows = true, tone = "ice", x0 = 0.62, totalW = 12.09, highlight = -1, stairs = 0 } = {}) {
    const gap = arrows ? 0.3 : 0.2;
    const w = (totalW - gap * (items.length - 1)) / items.length;
    const n = items.length;
    items.forEach((it, i) => {
      const x = x0 + i * (w + gap);
      // stairs：階梯版，越後面越高（stairs = 每階抬升吋數）
      const yy = y + (n - 1 - i) * stairs, hh = h - (n - 1 - i) * stairs;
      card(s, x, yy, w, hh, { tone, outline: i === highlight });
      badge(s, x + 0.28, yy + 0.28, it.no || String(i + 1));
      txt(s, it.t, { x: x + 0.28, y: yy + 0.95, w: w - 0.5, h: 0.5, fontSize: 21, color: C.navy });
      if (it.d) txt(s, it.d, { x: x + 0.28, y: yy + 1.5, w: w - 0.5, h: hh - 1.65, fontSize: 18 });
      if (arrows && i < n - 1) arrow(s, x + w, yy + hh / 2 - 0.3 - stairs / 2, gap, 0.6);
    });
  }
  // 對比卡：兩欄（或多欄）＋標題＋分隔線＋◆ 條列
  function compare(s, cols, { y = 1.95, h = 3.6, gap = 0.6 } = {}) {
    const w = (12.09 - gap * (cols.length - 1)) / cols.length;
    cols.forEach((c, i) => {
      const x = 0.62 + i * (w + gap);
      card(s, x, y, w, h, { tone: c.tone || (i % 2 ? "iced" : "ice"), outline: !!c.outline });
      txt(s, c.title, { x: x + 0.38, y: y + 0.3, w: w - 0.7, h: 0.55, fontSize: 22, color: C.navy, valign: "middle" });
      if (c.sub) txt(s, c.sub, { x: x + 0.38, y: y + 0.85, w: w - 0.7, h: 0.45, fontSize: 18, color: C.navy, transparency: 25 });
      const ry = y + (c.sub ? 1.4 : 0.95);
      rule(s, x + 0.38, ry, w - 0.76, c.tone === "iced" || (i % 2 && !c.tone) ? C.white : C.iced, 2);
      if (c.items) bullets(s, c.items, { x: x + 0.38, y: ry + 0.18, w: w - 0.7, h: y + h - ry - 0.3 });
    });
  }
  // 列表卡：每列一張卡（編號方塊＋標題＋說明）
  function rows(s, items, { x = 0.62, y = 1.95, w = 12.09, rowH = 1.1, gap = 0.18, tone = "ice" } = {}) {
    items.forEach((it, i) => {
      const yy = y + i * (rowH + gap);
      card(s, x, yy, w, rowH, { tone, outline: !!it.outline });
      badge(s, x + 0.28, yy + (rowH - 0.52) / 2, it.no || String(i + 1));
      if (it.d) {
        txt(s, it.t, { x: x + 1.15, y: yy + 0.14, w: w - 1.4, h: 0.48, fontSize: 21, color: C.navy, valign: "middle" });
        txt(s, it.d, { x: x + 1.15, y: yy + 0.6, w: w - 1.4, h: rowH - 0.7, fontSize: 18 });
      } else {
        txt(s, it.t, { x: x + 1.15, y: yy, w: w - 1.4, h: rowH, fontSize: 21, color: C.navy, valign: "middle" });
      }
    });
  }
  // 側欄卡：右側重點清單
  function sideCard(s, title, items, { x = 8.55, y = 1.95, w = 4.16, h = 4.8, marker = "✓", tone = "iced", outline = false } = {}) {
    card(s, x, y, w, h, { tone, outline });
    txt(s, title, { x: x + 0.35, y: y + 0.28, w: w - 0.6, h: 0.55, fontSize: 21, color: C.navy, valign: "middle" });
    rule(s, x + 0.35, y + 0.95, w - 0.7, tone === "iced" ? C.white : C.iced, 2);
    bullets(s, items, { x: x + 0.35, y: y + 1.15, w: w - 0.6, h: h - 1.3, marker, gap: 14 });
  }
  // 表格：Navy 表頭＋Ice 斑馬紋
  function table(s, head, body, { y = 1.95, colW, rowH = 0.62, align } = {}) {
    const hc = (t) => ({ text: t, options: { bold: true, fontFace: F, fontSize: 18, color: C.white, fill: { color: C.navy }, valign: "middle", margin: [0, 0.18, 0, 0.18] } });
    const bc = (cell, r, c) => {
      const t = typeof cell === "string" ? cell : cell.t;
      const color = typeof cell === "string" ? C.body : (cell.color || C.body);
      return { text: t, options: { bold: true, fontFace: F, fontSize: 18, color, fill: { color: r % 2 ? C.ice : C.white }, valign: "middle", align: align ? align[c] : "left", margin: [0, 0.18, 0, 0.18] } };
    };
    s.addTable([head.map(hc), ...body.map((row, r) => row.map((cell, c) => bc(cell, r, c)))], {
      x: 0.62, y, w: 12.09, colW, rowH, border: { type: "solid", pt: 1, color: C.iced },
    });
  }
  // 互動頁：大卡片問題＋選項
  function prompt(s, question, chips, instruction, { y = 1.95 } = {}) {
    card(s, 0.62, y, 12.09, 2.3, { tone: "ice" });
    txt(s, question, { x: 1.0, y, w: 11.3, h: 2.3, fontSize: 30, color: C.navy, align: "center", valign: "middle" });
    if (chips && chips.length) {
      const gap = 0.25, cw = (12.09 - gap * (chips.length - 1)) / chips.length;
      chips.forEach((c, i) => {
        const x = 0.62 + i * (cw + gap);
        card(s, x, y + 2.6, cw, 0.95, { tone: "white", outline: true });
        txt(s, c, { x, y: y + 2.6, w: cw, h: 0.95, fontSize: 21, color: C.navy, align: "center", valign: "middle" });
      });
    }
    if (instruction) txt(s, instruction, { x: 0.62, y: y + 3.85, w: 12.09, h: 0.55, fontSize: 20, align: "center", valign: "middle" });
  }

  // ---------- 深色頁版型 ----------
  function cover(s, { kicker, title, sub, pills = [], info = [] }) {
    txt(s, kicker, { x: 0.75, y: 1.75, w: 11, h: 0.4, fontSize: 16, color: C.teal, valign: "middle" });
    txt(s, title, { x: 0.72, y: 2.2, w: 11.8, h: 1.0, fontSize: 44, color: C.white, valign: "middle", charSpacing: -1 });
    if (sub) txt(s, sub, { x: 0.74, y: 3.25, w: 11, h: 0.6, fontSize: 24, color: C.white, transparency: 15, valign: "middle" });
    pills.forEach((p, i) => {
      const x = 0.75 + i * 2.55;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.2, w: 2.35, h: 0.55, rectRadius: 0.27, fill: { color: C.navy }, line: { color: C.teal, width: 1.25 } });
      txt(s, p, { x, y: 4.2, w: 2.35, h: 0.55, fontSize: 16, color: C.white, align: "center", valign: "middle" });
    });
    if (info.length) txt(s, info.map((t, i) => R(t, { color: C.white, transparency: i ? 0 : 20, breakLine: i < info.length - 1 })), { x: 0.75, y: 5.3, w: 11, h: 0.9, fontSize: 18, paraSpaceAfter: 6 });
  }
  function divider(s, { num, label, title, sub }) {
    txt(s, num, { x: 0.6, y: 1.85, w: 4, h: 1.7, fontSize: 100, color: C.teal, valign: "middle" });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 3.72, w: 0.85, h: 0.06, fill: { color: C.teal }, line: { type: "none" } });
    txt(s, label, { x: 0.72, y: 3.9, w: 10, h: 0.4, fontSize: 18, color: C.teal, transparency: 15, valign: "middle" });
    txt(s, title, { x: 0.68, y: 4.3, w: 11.5, h: 0.9, fontSize: 36, color: C.white, valign: "middle" });
    if (sub) txt(s, sub, { x: 0.72, y: 5.2, w: 11, h: 0.5, fontSize: 18, color: C.white, transparency: 20, valign: "middle" });
  }
  // 金句／數據頁：置中大字，highlight 用 Teal
  function statement(s, { pre, lines, sub }) {
    if (pre) txt(s, pre, { x: 0.8, y: 1.7, w: 11.73, h: 0.7, fontSize: 24, color: C.white, align: "center", valign: "middle", transparency: 10 });
    txt(s, lines.map((l, i) => R(l.t, { color: l.hl ? C.teal : C.white, breakLine: i < lines.length - 1 })),
      { x: 0.8, y: 2.5, w: 11.73, h: 2.4, fontSize: 48, align: "center", valign: "middle", paraSpaceAfter: 8 });
    if (sub) txt(s, sub, { x: 0.8, y: 5.05, w: 11.73, h: 0.6, fontSize: 20, color: C.white, align: "center", valign: "middle", transparency: 20 });
  }

  // ---------- v2.1 新元件：讓版面有畫面感 ----------
  // 素材框：要放截圖／影片／照片的地方，只拉框、不放假圖，由講師自行放入
  function mediaFrame(s, { x, y, w, h, label = "截圖／影片放這裡", caption } = {}) {
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.ice }, line: { color: C.body, width: 1.25, dashType: "dash" } });
    const d = 0.7;
    iconDot(s, x + w / 2 - d / 2, y + h / 2 - 0.65, d, "▶", 20);
    txt(s, label, { x, y: y + h / 2 + 0.15, w, h: 0.45, fontSize: 18, color: C.navy, align: "center", valign: "middle", transparency: 20 });
    if (caption) txt(s, caption, { x, y: y + h + 0.1, w, h: 0.4, fontSize: 16, align: "center", transparency: 30 });
  }
  // 關鍵句：不用色塊，只用 Navy 左強調條＋大字（減少結論條使用）
  function keyline(s, text, { x = 0.62, y = 6.0, w = 12.09, h = 0.7, fs = 22 } = {}) {
    s.addShape(pres.shapes.RECTANGLE, { x, y: y + 0.08, w: 0.08, h: h - 0.16, fill: { color: C.navy }, line: { type: "none" } });
    txt(s, text, { x: x + 0.3, y, w: w - 0.3, h, fontSize: fs, color: C.navy, valign: "middle" });
  }
  // 圖示格：多個場景或工具並列，hl 標記重點格
  function iconGrid(s, items, { cols = 3, x0 = 0.62, y = 1.95, totalW = 12.09, cellH = 2.1, gap = 0.22 } = {}) {
    const w = (totalW - gap * (cols - 1)) / cols;
    items.forEach((it, i) => {
      const x = x0 + (i % cols) * (w + gap), yy = y + Math.floor(i / cols) * (cellH + gap);
      card(s, x, yy, w, cellH, { tone: it.hl ? "iced" : "ice", outline: !!it.hl });
      iconDot(s, x + 0.3, yy + 0.3, 0.7, it.icon || "◆", 20);
      if (it.tag) txt(s, it.tag, { x: x + 1.15, y: yy + 0.42, w: w - 1.4, h: 0.45, fontSize: 16, color: C.navy, transparency: 25, valign: "middle" });
      txt(s, it.t, { x: x + 0.3, y: yy + 1.1, w: w - 0.55, h: 0.5, fontSize: 21, color: C.navy, valign: "middle" });
      if (it.d) txt(s, it.d, { x: x + 0.3, y: yy + 1.6, w: w - 0.55, h: cellH - 1.7, fontSize: 18 });
    });
  }
  // 泳道流程圖：lanes = [{ label, nodes: [{ col, t, icon }] }]，依 col 對齊格線，節點依序以箭頭相連
  function flow(s, lanes, { y = 1.95, laneH = 1.55, gap = 0.3, cols = 6, labelW = 1.6, hl = [] } = {}) {
    const x0 = 0.62 + labelW + 0.2, areaW = 12.09 - labelW - 0.2;
    const cw = areaW / cols, nw = cw - 0.3, nh = laneH - 0.45;
    const pos = [];
    lanes.forEach((lane, li) => {
      const ly = y + li * (laneH + gap);
      card(s, 0.62, ly, 12.09, laneH, { tone: li % 2 ? "white" : "ice", shadow: false, outline: false });
      if (li % 2) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.62, y: ly, w: 12.09, h: laneH, rectRadius: 0.05, fill: { type: "none" }, line: { color: C.iced, width: 1.5 } });
      txt(s, lane.label, { x: 0.82, y: ly, w: labelW - 0.1, h: laneH, fontSize: 20, color: C.navy, valign: "middle" });
      lane.nodes.forEach((nd) => {
        const nx = x0 + nd.col * cw + 0.15, ny = ly + (laneH - nh) / 2;
        const k = pos.length;
        card(s, nx, ny, nw, nh, { tone: hl.includes(k) ? "iced" : "white", outline: hl.includes(k) });
        txt(s, nd.t, { x: nx + 0.05, y: ny, w: nw - 0.1, h: nh, fontSize: 17, color: C.navy, align: "center", valign: "middle" });
        pos.push({ x: nx, y: ny, w: nw, h: nh, lane: li });
      });
    });
    const ln = (x, y, w, h, arrowEnd) => s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: C.navy, width: 1.5, endArrowType: arrowEnd ? "triangle" : undefined } });
    for (let k = 1; k < pos.length; k++) {
      const a = pos[k - 1], b = pos[k];
      if (a.lane === b.lane) ln(a.x + a.w, a.y + a.h / 2, b.x - a.x - a.w, 0, true);
      else { // 跨泳道：先水平到目標中心，再垂直進入
        const cx = b.x + b.w / 2;
        ln(a.x + a.w, a.y + a.h / 2, cx - a.x - a.w, 0, false);
        ln(cx, a.y + a.h / 2, 0, b.y - a.y - a.h / 2, true);
      }
    }
    return pos;
  }
  // 2×2 矩陣：軸線＋四象限＋標記點（點用白底描邊圈，不用實心圓）
  function matrix(s, { x = 0.62, y = 1.95, w = 7.0, h = 4.7, xLabel, yLabel, quads = [], hl = 1, dots = [] } = {}) {
    const ax = x + 0.55, ay = y, aw = w - 0.55, ah = h - 0.55; // 軸內區域
    const qw = aw / 2, qh = ah / 2;
    // quads 順序：左上、右上、左下、右下
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cx, cy], i) => {
      const qx = ax + cx * qw, qy = ay + cy * qh;
      s.addShape(pres.shapes.RECTANGLE, { x: qx + 0.04, y: qy + 0.04, w: qw - 0.08, h: qh - 0.08, fill: { color: i === hl ? C.iced : C.ice }, line: i === hl ? { color: C.navy, width: 2 } : { type: "none" } });
      if (quads[i]) txt(s, quads[i], { x: qx + 0.2, y: qy + 0.15, w: qw - 0.4, h: 0.45, fontSize: 18, color: C.navy, transparency: i === hl ? 0 : 30 });
    });
    s.addShape(pres.shapes.LINE, { x: ax, y: ay + ah, w: aw, h: 0, line: { color: C.navy, width: 2, endArrowType: "triangle" } });
    s.addShape(pres.shapes.LINE, { x: ax, y: ay + ah, w: 0, h: -ah, line: { color: C.navy, width: 2, endArrowType: "triangle" } });
    if (xLabel) txt(s, xLabel, { x: ax, y: ay + ah + 0.08, w: aw, h: 0.42, fontSize: 16, color: C.navy, align: "right" });
    if (yLabel) txt(s, yLabel, { x, y: ay, w: 0.45, h: ah, fontSize: 16, color: C.navy, align: "center", valign: "middle", vert: "eaVert" });
    dots.forEach((d) => {
      const px = ax + d.x * aw, py = ay + (1 - d.y) * ah, r = 0.18;
      s.addShape(pres.shapes.OVAL, { x: px - r, y: py - r, w: 2 * r, h: 2 * r, fill: { color: C.white }, line: { color: C.navy, width: 2 } });
      txt(s, d.label, { x: px + 0.25, y: py - 0.22, w: 2.6, h: 0.44, fontSize: 16, color: C.body, valign: "middle" });
    });
  }
  // 決策樹：root 問題 → 分支（條件）→ 結果
  function tree(s, { root, branches, y = 1.95 } = {}) {
    const rw = 4.2, rh = 0.8, rx = 0.62 + (12.09 - rw) / 2;
    card(s, rx, y, rw, rh, { tone: "iced" });
    txt(s, root, { x: rx, y, w: rw, h: rh, fontSize: 22, color: C.navy, align: "center", valign: "middle" });
    const n = branches.length, bw = (12.09 - 0.4 * (n - 1)) / n;
    const by = y + rh + 0.55, rby = by + 1.35;
    const midY = y + rh + 0.27;
    s.addShape(pres.shapes.LINE, { x: rx + rw / 2, y: y + rh, w: 0, h: 0.27, line: { color: C.navy, width: 1.5 } });
    const first = 0.62 + bw / 2, last = 0.62 + (n - 1) * (bw + 0.4) + bw / 2;
    s.addShape(pres.shapes.LINE, { x: first, y: midY, w: last - first, h: 0, line: { color: C.navy, width: 1.5 } });
    branches.forEach((b, i) => {
      const bx = 0.62 + i * (bw + 0.4), cx = bx + bw / 2;
      s.addShape(pres.shapes.LINE, { x: cx, y: midY, w: 0, h: by - midY, line: { color: C.navy, width: 1.5, endArrowType: "triangle" } });
      card(s, bx, by, bw, 1.0, { tone: "ice" });
      txt(s, b.cond, { x: bx + 0.15, y: by, w: bw - 0.3, h: 1.0, fontSize: 18, align: "center", valign: "middle" });
      s.addShape(pres.shapes.LINE, { x: cx, y: by + 1.0, w: 0, h: rby - by - 1.0, line: { color: C.navy, width: 1.5, endArrowType: "triangle" } });
      card(s, bx, rby, bw, 1.0, { tone: b.hl ? "iced" : "white", outline: true });
      txt(s, b.result, { x: bx + 0.1, y: rby, w: bw - 0.2, h: 1.0, fontSize: 22, color: C.navy, align: "center", valign: "middle" });
    });
    return rby + 1.0;
  }
  // 分割頁：左半 Navy（視為深色區塊）、右半白底，做強烈對比
  function split(s, { kicker, title, left, right }) {
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W / 2, h: 7.5, fill: { color: C.navy }, line: { type: "none" } });
    if (kicker) txt(s, kicker, { x: 0.62, y: 0.4, w: 5.8, h: 0.4, fontSize: 16, color: C.teal, valign: "middle" });
    if (title) txt(s, title, { x: 0.6, y: 0.8, w: 5.9, h: 0.72, fontSize: 28, color: C.white, valign: "middle" });
    if (title) s.addShape(pres.shapes.RECTANGLE, { x: 0.64, y: 1.56, w: 0.85, h: 0.06, fill: { color: C.teal }, line: { type: "none" } });
    const block = (b, x, darkSide) => {
      const main = darkSide ? C.white : C.navy, acc = darkSide ? C.teal : C.navy;
      txt(s, b.title, { x, y: 2.3, w: 5.4, h: 0.9, fontSize: 40, color: main, valign: "middle" });
      txt(s, b.sub, { x, y: 3.2, w: 5.4, h: 0.5, fontSize: 22, color: acc, valign: "middle" });
      const runs = [];
      b.items.forEach((t, i) => { runs.push(R("◆  ", { color: acc })); runs.push(R(t, { color: darkSide ? C.white : C.body, breakLine: i < b.items.length - 1 })); });
      txt(s, runs, { x, y: 4.0, w: 5.4, h: 2.2, fontSize: 20, paraSpaceAfter: 12 });
    };
    block(left, 0.9, true);
    block(right, W / 2 + 0.75, false);
  }
  // 深色互動頁：深色背景上的大問題＋Teal 描邊選項
  function darkPrompt(s, { tag, question, chips = [], instruction }) {
    if (tag) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: W / 2 - 1.4, y: 1.35, w: 2.8, h: 0.5, rectRadius: 0.25, fill: { color: C.navy }, line: { color: C.teal, width: 1.25 } });
      txt(s, tag, { x: W / 2 - 1.4, y: 1.35, w: 2.8, h: 0.5, fontSize: 16, color: C.teal, align: "center", valign: "middle" });
    }
    txt(s, question, { x: 0.8, y: 2.1, w: 11.73, h: 1.6, fontSize: 36, color: C.white, align: "center", valign: "middle" });
    const gap = 0.3, cw = 2.6, tw = chips.length * cw + (chips.length - 1) * gap, sx = (W - tw) / 2;
    chips.forEach((c, i) => {
      const x = sx + i * (cw + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.1, w: cw, h: 0.85, rectRadius: 0.05, fill: { color: C.navyD }, line: { color: C.teal, width: 1.25 } });
      txt(s, c, { x, y: 4.1, w: cw, h: 0.85, fontSize: 22, color: C.white, align: "center", valign: "middle" });
    });
    if (instruction) txt(s, instruction, { x: 0.8, y: 5.35, w: 11.73, h: 0.55, fontSize: 20, color: C.teal, align: "center", valign: "middle" });
  }

  return {
    C, F, W, R, txt, card, badge, iconDot, rule, bullets, arrow,
    header, footer, light, dark, takeaway, stepCards, compare, rows, sideCard, table, prompt,
    cover, divider, statement,
    mediaFrame, keyline, iconGrid, flow, matrix, tree, split, darkPrompt,
    PH: (t = "【待填】") => R(t, { color: C.red }),
  };
}

module.exports = { createTheme, C, F };
```

### build.js

```javascript
// RPAI Deck builder —— 讀取 slides/ 下每個檔案（一頁一檔），依檔名順序組裝成 .pptx
// 用法：node build.js [deck.config.js]
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { createTheme } = require("./theme");

const cfgPath = path.resolve(process.argv[2] || "./deck.config.js");
const cfg = require(cfgPath);
const slideDir = path.resolve(path.dirname(cfgPath), cfg.slidesDir || "slides");

const files = fs.readdirSync(slideDir).filter((f) => /^\d+.*\.js$/.test(f)).sort();
const defs = files.map((f) => Object.assign({ file: f }, require(path.join(slideDir, f))));

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = cfg.title;
pres.author = cfg.author;
[...new Set(defs.map((d) => d.section))].forEach((t) => pres.addSection({ title: t }));

const T = createTheme(pres, { course: cfg.course });
defs.forEach((d, i) => {
  const s = d.layout === "dark" ? T.dark(d) : T.light(d);
  d.render(s, T);
  T.footer(s, i + 1, defs.length, d.layout === "dark" ? "dark" : d.layout === "split" ? "split" : "light");
  if (d.notes) s.addNotes(d.notes.trim());
});

pres.writeFile({ fileName: cfg.output }).then(() => console.log(`done: ${defs.length} slides -> ${cfg.output}`));
```

### qa.sh

```bash
#!/usr/bin/env bash
# RPAI Deck QA：結構驗證 → 16pt／粗體掃描（頁尾 12pt 豁免） → 轉 PDF 與截圖網格
set -e
DECK="$1"; OUT="${2:-qa}"
SK=/mnt/skills/public/pptx
python "$SK/scripts/office/validate.py" "$DECK" | tail -1
rm -rf "$OUT" && mkdir -p "$OUT/unpacked"
python3 -c "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$DECK" "$OUT/unpacked"
python3 - "$OUT" <<'PY'
import re,glob,sys
bs=bb=0
for f in glob.glob(sys.argv[1]+'/unpacked/ppt/slides/slide*.xml'):
    x=open(f,encoding='utf-8').read()
    for r,t in re.findall(r'<a:r>\s*(<a:rPr\b[^>]*>).*?<a:t>([^<]*)</a:t>',x,re.S):
        m=re.search(r'sz="(\d+)"',r)
        foot = m and m.group(1)=="1200" and t.startswith("Copyright © RPAI")
        if m and int(m.group(1))<1600 and not foot: bs+=1
        if 'b="1"' not in r: bb+=1
print(f"小於16pt（頁尾12pt除外）: {bs}｜非粗體: {bb}")
PY
python "$SK/scripts/office/soffice.py" --headless --convert-to pdf "$DECK" --outdir "$OUT" >/dev/null 2>&1
pdftoppm -jpeg -r 50 "$OUT"/*.pdf "$OUT/s" 2>/dev/null
python3 - "$OUT" <<'PY'
import glob,sys
from PIL import Image
fs=sorted(glob.glob(sys.argv[1]+'/s-*.jpg')); ims=[Image.open(f) for f in fs]; w,h=ims[0].size
for k in range(0,len(ims),9):
    g=Image.new('RGB',(w*3,h*3),'white')
    for i,im in enumerate(ims[k:k+9]): g.paste(im,((i%3)*w,(i//3)*h))
    g.save(f'{sys.argv[1]}/grid{k//9+1}.jpg')
print(len(fs),"pages")
PY
```

### 背景圖產生腳本（mkdir -p assets 後執行）

```python
from PIL import Image, ImageDraw
W,H=1920,1080
def grad(c1,c2,c3):
    img=Image.new('RGB',(W,H)); px=img.load()
    for y in range(H):
        for x in range(W):
            t=(x/W*0.65+y/H*0.35)
            a,b,k=(c1,c2,t/0.6) if t<0.6 else (c2,c3,(t-0.6)/0.4)
            px[x,y]=tuple(int(a[i]+(b[i]-a[i])*k) for i in range(3))
    return img
base=grad((1,20,85),(4,40,120),(10,78,128))
ov=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov); teal=(122,255,245)
d.line([(130,40),(130,250)],fill=teal+(70,),width=2); d.line([(40,140),(250,140)],fill=teal+(70,),width=2)
for k in range(1,4):
    d.line([(124,140-k*30),(136,140-k*30)],fill=teal+(50,),width=2)
    d.line([(130+k*30,134),(130+k*30,146)],fill=teal+(50,),width=2)
for r in range(160,900,110): d.ellipse([1650-r,620-r,1650+r,620+r],outline=(255,255,255,18),width=2)
for x in range(1480,1880,40):
    for y in range(820,1040,40): d.ellipse([x-2,y-2,x+2,y+2],fill=(255,255,255,28))
Image.alpha_composite(base.convert('RGBA'),ov).convert('RGB').save('assets/bg-dark.jpg',quality=90)
```

---

# 附錄 B：敘事模型清單

- **分析型**（拆解現況、診斷問題）：SWOT、PEST、波特五力、麥肯錫 7S、帕雷托、SIPOC、MOST
- **規劃型**（目標設定、行動設計）：SMART、5W2H、PDCA、安索夫矩陣、商業模式畫布、市場細分
- **說服型**（推廣、銷售、提案）：AIDA、FABE、價值主張、SCQA、影響力模型
- **思考型**（觀念轉換、創新啟發）：六頂思考帽、設計思維、KISS、馬斯洛需求層次
- **評估型**（成效衡量、優先排序）：KANO、HEART

使用細則：不列整份清單給使用者；依主題挑 2–3 個差異明顯的候選（不要「SWOT＋PEST＋五力」這種重疊組合）；每個附 3–5 頁骨架預覽；確認後在藍圖摘要記錄所選模型。