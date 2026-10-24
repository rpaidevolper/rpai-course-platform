---
name: "rpai-course-content"
description: "為有學員動手實作的課程產出學員實作手冊（HTML）；使用者要學員手冊、實作手冊、課程素材包時使用。純講述或純示範的場次不產手冊也不產講義；逐頁講稿不另出文件，寫在簡報 speaker notes。"
---

<!-- 變更 2026-07-05：版型庫字級全面對齊 pptx-workflow 硬規則（全粗體、≥16pt；D1 主標 50→40pt、L 系列標題 25→26pt、L6 強調字 16→20pt） -->
<!-- 變更 2026-10-13：新增 Step 8「學員實作手冊（HTML）」，課程素材固定附一份可書寫、可複製提示詞的學員手冊 -->
<!-- 變更 2026-07-05：移除 Label #006A65，技術標籤統一改用 Body 色 #454650（透明度弱化） -->
<!-- 變更 2026-10-23：移除「課程內容腳本（MD）」產出（逐頁總表、逐頁精簡卡、投影片版型庫、講者腳本規則、MD 輸出格式）。逐頁講稿、互動提示與示範指令全文改寫在 PPTX 的 speaker notes（由 rpai-pptx-workflow 產出）。本 skill 只負責學員實作手冊；純講述場次不產手冊，也不以講義或 PDF 替代。 -->

# RPAI 學員實作手冊產生器

## 概述

本 skill 依據課綱（與教學藍圖），為**學員會動手實作**的課程產出「學員實作手冊」：單一 HTML 檔，放進當天的學員素材包。學員上課時開在瀏覽器裡，邊看、邊複製提示詞、邊寫筆記。範本來源：某金融業者同仁班手冊（2026-09）；第一份含書寫欄位的版本是某製造業者 D1（2026-10）。

本 skill **不再產出課程內容腳本（逐頁 MD）**：逐頁結構在簡報藍圖確認，講稿與示範指令全文直接寫在簡報 speaker notes。

## Step 0：先判斷這堂課要不要手冊

| 課程型態 | 產出 |
|------|------|
| 學員有動手實作（全部或部分時段） | 每天一份學員實作手冊（HTML），依下方 Step 1 製作 |
| 講師講述＋示範為主，學員不操作（線上短講、講座、純 Demo） | **不產手冊，也不產講義或 PDF 帶走物**；除非使用者明確要求 |
| 使用者要逐頁腳本、講師稿、逐字稿 | 不另出 MD 文件，寫進 PPTX speaker notes（交給 `rpai-pptx-workflow`） |

開工前先找上游文件：對話或 outputs 有教學藍圖（`*_教學藍圖.md`）就讀它的受眾、動手環節與時間骨架，不重問；藍圖第六節若寫明「不產手冊」，照做。討論中改動了藍圖層級的決策，先回寫藍圖再繼續。

## Step 1：學員實作手冊（HTML）

有學員實際操作的課程，**每天固定產出一份「學員實作手冊」**。

### 1-A 收錄規則（最重要）

| 收 | 不收 |
|---|---|
| 學員要動手的實作（照提示詞做、上傳檔案、建 Gem / Skill / 知識庫） | 純概念、框架講解頁 |
| 學習單、填空表、小組討論要寫下結論的地方 | Slido 投票 / 問答（學員在 Slido 上回答，手冊不重複） |
| 講師示範後學員要跟做的部分 | 只看不做的講師 Demo（可放進可折疊區當參考） |
| 選用加練（標示「選用」，放在最後） | 休息、QA、純過場頁 |

- **順序跟簡報走**：段落編號依簡報上的實作順序 ①②③…，側欄、課程地圖、素材表引用的編號要一致（改完任一處就全部對一次）。
- **學習單編號沿用簡報**：簡報刪過學習單就照簡報上的編號，不要自己重排。
- **以最新版簡報為準**：講師自行改過的 PPTX，先讀改過的版本（公司名、日期用語、刪掉的頁）再決定收什麼。

### 1-B 每個實作段落的固定結構

```
<section id="英文短代號">
  h2：<span class="n">編號</span>＋動詞開頭的標題（例：實作：把 TPRO 交給 AI，畫成泳道圖）
  p.lead：用檔：<code>素材包裡的確切檔名</code>＋一句做法
  （選）.steps 步驟方塊 ①②③④
  .cpbox 提示詞（📋 標題＋複製鈕＋pre.prompt），一段實作 1–4 個
  .fill 書寫區（✎ 你的筆記）或 table.ws 填空表
  （選）.box-key 提醒／.box-red 安全底線／.box-a 常見錯誤
  .gate 🎯 本段產出：一句話寫「做完手上會有什麼」
</section>
```

全手冊另外固定有：
1. **今日課程地圖**（.rmap / .rrow）：時段 → 段落連結。
2. **開始前：你的素材檔**：表格列出素材包裡每個檔案與「什麼時候用」；檔名必須與壓縮檔內完全一致；附一個 .box-red 安全底線（不上傳真實資料、API Key 不寫進手冊）。
3. **PART 大卡**（.part）：每個單元一張，例「單元 03　PROCESS／流程盤點 × TPRO × 泳道流程圖」。
4. **你帶走的**：成品清單＋方法清單＋下一天預告＋「下課前請下載筆記」。

### 1-C 互動元件（書寫欄位版）

| 元件 | 用途 | 規則 |
|---|---|---|
| `textarea.note[data-k][data-label]` | 學員筆記 | data-k 全手冊唯一；data-label 是匯出時的題目名稱 |
| `table.ws` | 學習單填空表 | 第一欄 `td.k` 放題目，其餘格放 textarea；示範列直接寫死文字 |
| `.quad` | 四象限討論 | 四格各一個 textarea，「優先處理」那格加 `.star` |
| `label.chk` | 驗收清單、完成確認 | 內含 `input[type=checkbox][data-k]`，也會被保存 |
| `span.bind[data-from][data-ph]` | 提示詞即時組裝 | 放在 pre.prompt 裡；學員填了對應欄位就替換，沒填就顯示 data-ph 預設範例；該 .cpbox 標題旁加「● 會隨你上方填寫自動更新」 |
| `details.codebox` | 講師示範用的長提示詞、卡關才看的解答 | 預設收合，列印時自動展開 |
| `.gate` | 本段產出 | JS 自動插入勾選框並計入側欄「今日完成度」 |

**提示詞綁定**適合用在「先想清楚 → 再丟給 AI」的實作：TPRO 四格、CARE 需求單、助手的角色／能回答／不能回答／語氣。學員填完表，下方提示詞就是他自己的版本，直接複製。

**不放的欄位**：API Key、密碼、真實姓名電話等個資——只放「我已存好」的勾選框。

### 1-D 版型與技術骨架

- **單一 HTML**、不連外部 CDN、無圖片（要放截圖的地方用 `figure.shot` 拉框，素材由講師自己補）。
- **配色**：沿用 RPAI 品牌——左側 Navy 側欄、Teal 只出現在深色區（側欄、提示詞框、hero），內容區淺色、卡片白底、表頭 Navy。
- **版面**：左側固定目錄（.grp 分組、.ch 章節、.do ✏ 實作、.demo ▶ 選用）＋ hero ＋ `.inner` 內容區（最大寬 940px）；手機版目錄變成抽屜（.mbtn / .navmask）。
- **側欄底部**依序：今日完成度進度條（#pfill / #pnum）→「⬇ 下載我的筆記」（#dlnotes）＋儲存狀態（#savedtip）→「🖨 列印 / 存成 PDF」。
- **CSS / JS 來源**：直接沿用上一份 RPAI 手冊的 `<style>` 與 `<script>`（一鍵複製含 fallback、側欄高亮、回頂端、閱讀進度條、手機抽屜、gate 打勾、列印展開 details），只換 localStorage 的 key。再補上下面這段「書寫欄位」的 CSS 與 JS。
- **localStorage key** 每門課每天不同：`rpai_<客戶>_<d1>_notes`（筆記）、`rpai_<客戶>_<d1>_done`（打勾），避免同一台電腦上不同課程互相覆蓋。

書寫欄位的追加 CSS（精簡）：
```css
.fill{background:#fff;border:1px dashed #b9c6e8;border-radius:12px;padding:14px 16px;margin:12px 0}
.fill .fh{font-size:13px;font-weight:800;color:var(--blue)} .fill .fh::before{content:"✎ "}
.fill label{display:block;font-size:13.5px;font-weight:800;color:var(--navy);margin:10px 0 4px}
textarea.note,input.note{width:100%;font:inherit;font-size:14px;background:#fbfcff;border:1px solid #d5ddef;border-radius:8px;padding:8px 10px;resize:vertical}
.inner table.ws td.k{font-weight:700;color:var(--navy);background:#f5f7fc;width:30%}
.quad{display:grid;grid-template-columns:1fr 1fr;gap:10px} .quad .q.star{border:2px solid var(--blue)}
.chk{display:flex;gap:10px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:8px 0}
.bind{background:rgba(122,255,245,.14);border-bottom:1px dashed var(--teal)} .bind.empty{color:#8fa0c8}
@media(max-width:760px){.quad{grid-template-columns:1fr}}
```

書寫欄位的追加 JS（自動儲存＋即時綁定＋下載筆記）：
```js
(function(){
  var KEY='rpai_<客戶>_d1_notes', data={};
  try{ data=JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){}
  var fields=[].slice.call(document.querySelectorAll('[data-k]')), tip=document.getElementById('savedtip'), t;
  function save(){ try{ localStorage.setItem(KEY,JSON.stringify(data)); tip.textContent='已自動儲存 '+new Date().toLocaleTimeString(); }
                   catch(e){ tip.textContent='此瀏覽器無法自動儲存，請記得下載筆記'; } }
  function bindAll(){ document.querySelectorAll('.bind').forEach(function(s){
    var v=(data[s.dataset.from]||'').trim(); s.textContent=v||s.dataset.ph; s.classList.toggle('empty',!v); }); }
  fields.forEach(function(f){
    if(f.type==='checkbox') f.checked=!!data[f.dataset.k]; else if(data[f.dataset.k]) f.value=data[f.dataset.k];
    f.addEventListener(f.type==='checkbox'?'change':'input',function(){
      data[f.dataset.k]=f.type==='checkbox'?f.checked:f.value; bindAll(); clearTimeout(t); t=setTimeout(save,400); });
  });
  bindAll();
  document.getElementById('dlnotes').addEventListener('click',function(){
    var out=['<課程名稱> Day 1｜我的課堂筆記','匯出時間：'+new Date().toLocaleString()], last='';
    fields.forEach(function(f){
      var h=f.closest('section').querySelector('h2').innerText.replace(/\s+/g,' ');
      if(h!==last){ out.push('','■ '+h); last=h; }
      out.push('・'+(f.dataset.label||f.dataset.k)+'：'+(f.type==='checkbox'?(f.checked?'✓ 已完成':'□ 未完成'):(f.value||'（未填）')));
    });
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([out.join('\n')],{type:'text/plain;charset=utf-8'}));
    a.download='我的課堂筆記_Day1.txt'; document.body.appendChild(a); a.click();
    setTimeout(function(){ a.remove(); URL.revokeObjectURL(a.href); },1500);
  });
})();
```

**做法建議**：用 Python 產生器組 HTML（helper：`prompt()`、`fold()`、`fill()`、`wstable()`、`gate()`、`bind()`），提示詞內文一律 `html.escape`，`bind()` 產生的 span 不跳脫。提示詞內容從當天的「實作提示詞與練習包」直接取，不要另寫一套——兩份文件的提示詞必須一字不差。

### 1-E 驗收（交付前必跑）

用 playwright 開檔，逐項確認：
1. 無 console / page error。
2. 複製鈕能複製；綁定提示詞在填欄位後，複製出來的文字含學員填的內容。
3. 填寫、打勾後重新整理，內容仍在（localStorage）。
4. gate 勾選後完成度 +1。
5. 「下載我的筆記」能下載 .txt，按段落分組、未填顯示（未填）。
6. 桌機 1366 與手機 390 寬各截圖檢查：無橫向捲動、表格與四象限不破版。
7. 側欄、課程地圖、素材表的段落編號一致；素材檔名與壓縮檔內一致。

### 1-F 交付

- 檔名：`D1_學員實作手冊.html`（Day 2 依此類推），放在學員素材包**根目錄**，讓學員解壓後第一眼看到。
- 素材包壓縮一律用 Python `zipfile` 打包（會帶 UTF-8 檔名旗標），**不要用 Linux `zip`**——Windows 會讀不到中文檔名，看起來像空的壓縮檔。打包後用 `testzip()` 檢查。
- 另外單獨給講師一份 HTML，方便先開來預覽、投影。

### 1-G Gotchas

1. **手冊不是簡報的文字版**：概念頁、Slido 一律不收；只收「學員手上要動」的段落。
2. **每段都要有 🎯 本段產出**：學員靠它知道做完了沒有，講師靠完成度看進度。
3. **筆記只存在那台電腦的瀏覽器**：換電腦、清快取就沒了，手冊裡要提醒兩次（開頭的使用說明＋結尾「你帶走的」）下課前下載。
4. **書寫格要留夠空間**：一句話的題目用 1 列，要列步驟的用 3 列；填空表格內用 1 列並可拉高。
5. **選用加練放最後**，側欄用 ▶（.demo）標示，避免學員以為是必做。
6. **純講述場次不做手冊、不改做講義**：學員不操作就不產任何學員檔案，除非使用者明確要求。

---

## 相關產出放哪裡

| 內容 | 歸屬 |
|------|------|
| 逐頁講稿、互動提示、示範指令全文 | PPTX speaker notes（`rpai-pptx-workflow`） |
| Demo 準備清單、備案、帳號需求 | 講師準備單（`rpai-course-outline` 的內部文件）或素材包的素材說明 |
| 學員要動手的提示詞與書寫欄位 | 本 skill 的學員實作手冊 |