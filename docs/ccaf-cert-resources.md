# CCAF（Claude Certified Architect – Foundations）考照資源總整理

> 研究日期：2026-07-07。CCAF 是 Anthropic 於 **2026 年 3 月 12 日**推出的第一張官方技術認證，正式名稱 **Claude Certified Architect – Foundations**（常縮寫 CCA-F 或 CCAF）。因為證照很新，網路心得數量仍有限，本文彙整目前找得到的所有經驗分享、官方資源與題庫，並區分「✅ 已交叉查證」與「⚠️ 未完全查證」兩級可信度。

---

## 一、官方考試資訊

| 項目 | 內容 | 可信度 |
|---|---|---|
| 主辦單位 | Anthropic Academy（[anthropic.skilljar.com](https://anthropic.skilljar.com/)），認證頁：[claude-certified-architect-foundations-certification](https://anthropic.skilljar.com/claude-certified-architect-foundations-certification/444989) | ✅ |
| 考試範圍 | Claude Code、Claude Agent SDK、Claude API、MCP（Model Context Protocol）四大核心技術 | ✅ |
| 題數／時間 | 60 題單選、120 分鐘 | ✅ |
| 及格分數 | 720 / 1000（量尺分數 100–1000） | ✅ |
| 費用 | 每次 US$99 | ✅（多來源一致，官方頁為準） |
| 監考方式 | 線上全程監考（webcam＋螢幕分享、閉卷、禁用 AI 工具） | ⚠️ |
| 報名資格 | 目前**限 Claude Partner Network 成員**；前 5,000 名合作夥伴員工免費 | ⚠️（多個中英文來源一致，但未完成 3 票查證） |

### 五大考試領域（Blueprint 配分）✅

1. **Agentic Architecture & Orchestration** — 27%
2. **Claude Code Configuration & Workflows** — 20%
3. **Prompt Engineering & Structured Output** — 20%
4. **Tool Design & MCP Integration** — 18%
5. **Context Management & Reliability** — 15%

> 多篇文章宣稱「題目錨定在 6 個生產情境，每人隨機抽 4 個」——此說法在交叉查證中**被否決（1-2）**，請以官方 Exam Guide 為準。

### 官方資源（免費，最優先使用）

- **官方 Exam Guide PDF**：認證頁可下載（另附 Certification Terms & Conditions、Exam Policy）✅
- **官方樣題 12 題＋官方 60 題模擬考**：多位考生提到報名後可取得 ⚠️
- **Anthropic Academy 免費課程**（對應各領域）⚠️：Claude 101、Claude Code 101、Claude Code in Action、Building with the Claude API（約 8 小時）、Intro to MCP、MCP Advanced Topics、AI Fluency、Claude Partner Network Learning Path
- 官方文件（docs.anthropic.com）與 Anthropic Cookbook

---

## 二、考照經驗分享／備考指南

### 英文（第一手心得）

| 來源 | 重點 |
|---|---|
| [How I Passed the CCA-F Exam in 2 Weeks — Hong Chu, Medium (2026/6)](https://medium.com/@yeesun.chu/how-i-passed-the-claude-certified-architect-foundations-cca-f-exam-in-2-weeks-6b967e6effb4) | **目前訊號最強的第一手心得**：兩週約 60 小時、843/1000 通過。重點考 Claude Code 設定層級（project files、rules、skills、commands、settings、hooks 各放哪裡）；建議用 Reddit 找易混淆主題；有買約 $19.99 的付費模擬題 |
| [The CCA Exam, Explained by Someone Who Passed It — Udacity Blog](https://www.udacity.com/blog/the-claude-certified-architect-exam-explained-by-someone-who-passed-it/) | 第一手：在家監考（webcam＋螢幕分享、單螢幕）約 90 分鐘寫完。難點在「每題好幾個選項都行得通，要選『該上 production 的那個』」；建議**實際動手做專案**，考的是判斷力不是背誦 |
| [Complete Guide to Passing the CCA-F (2026 Master Edition) — Rick Hightower, Medium](https://medium.com/@richardhightower/the-complete-guide-to-passing-the-cca-f-foundations-exam-and-becoming-an-anthropic-claude-certified-c452ee065049) | 作者 2026/5 考過。**八篇系列備考指南**第一篇（另有 [Towards AI 版](https://pub.towardsai.net/claude-certified-architect-the-complete-guide-to-passing-the-cca-foundations-exam-9665ce7342a8)）：把五大領域對應到 13 門免費 Academy 課程＋週計畫。作者稱官方模擬考只涵蓋約 60% 實考內容，其餘 40% 要靠 Academy 課程、Cookbook 與實戰經驗（⚠️ 未查證） |
| [Preparation Guide — Balaji Ashok Kumar, Medium](https://dynamicbalaji.medium.com/claude-certified-architect-foundations-certification-preparation-guide-c70546b51f51) | 考生心得：建議「讀→做→測」循環：先 Academy＋官方文件，再做小專案（API/Agent SDK/MCP），最後寫官方 12 樣題＋60 題官方模擬考 |
| [5 Domains, 6 Scenarios — dev.to (AWS Builders)](https://dev.to/aws-builders/the-claude-certified-architect-exam-5-domains-6-scenarios-and-everything-you-need-to-know-4le3) | 官方 blueprint 的完整拆解（本文配分數字即出自此文，✅ 已查證） |
| [Claude Code Guide for the CCA-F — Roan Brasil Monteiro, Medium](https://medium.com/@roanmonteiro/a-detailed-claude-code-guide-for-the-anthropic-certified-architect-foundations-exam-cca-f-bd916130d8ec) | 針對 Claude Code 領域的深讀：hooks、subagents、專案級 `.mcp.json`、權限設定 |
| [Tutorials Dojo CCA-F Study Guide](https://tutorialsdojo.com/cca-f-claude-certified-architect-foundations-study-guide/) | 老牌考證出版商的免費 study guide＋報名流程教學 |

### 中文

| 來源 | 重點 |
|---|---|
| [知乎：Anthropic 的 Claude 架构师认证考试，有人把它拆碎了免费给你](https://zhuanlan.zhihu.com/p/2017008303121642620) | **目前最接近中文備考指南**：拆解五大領域配分，並指向 X 上開發者 **@hooeem** 的免費萬字讀書路線圖（含每個領域讓 Claude 當講師的 prompt）（⚠️） |
| [CSDN：Claude 官方 AI 架构师认证发布（附题库思路）](https://gitcode.csdn.net/69cf18270a2f6a37c59ca869.html) | 彙整考試事實；提醒官方建議 6 個月以上 Claude 實戰經驗 |
| [CSDN 智能体社区：5 个领域、6 个场景](https://adg.csdn.net/6a2b601810ee7a33f27b6ee9.html) | Blueprint 中文轉述 |
| [博客园：不是考 Prompt，而是考你能不能造一个生产级 Agent](https://www.cnblogs.com/itech/p/20655708) | 定位分析＋報名資格（目前限合作夥伴網絡） |
| [LINUX DO 論壇討論串](https://linux.do/t/topic/1776162)、[腾讯云开发者社区](https://cloud.tencent.com/developer/article/2646850) | 社群討論與新聞轉述 |

> 截至研究日，**尚未找到 PTT／Dcard／掘金的真實考過心得**——證照太新，中文圈目前只有拆解文與新聞，第一手心得以英文 Medium 為主。

---

## 三、題庫／模擬考

### 官方（最推薦）
- 報名後可取得**官方 12 題樣題＋官方 60 題模擬考**（多位考生心得提及；⚠️ 以認證頁實際內容為準）。注意：有考生稱官方模擬考只覆蓋約六成實考範圍，考到 90+% 再上場。

### 非官方（合法模擬題，考生有提及／較多人用）
| 資源 | 說明 |
|---|---|
| [Udemy：Anthropic Claude Certified Architect – 6 Full Practice Exams](https://www.udemy.com/course/anthropic-claude-certified-architect-3-full-practice-exams/) | 6 回合計 360 題情境題，對應五大領域、解析對照官方 Exam Guide；目前最顯眼的商業題庫 |
| [Udemy：CLAUDE Certified Architect Foundations [CCAF] EXAMS v2](https://www.udemy.com/course/new-claude-certified-architect-foundations-cca-f-exams/) | 2026 更新版模擬題組（Agent SDK／Claude Code／MCP） |
| [Udemy：CCA-F Practice Exams](https://www.udemy.com/course/claude-certified-architect-foundations-cca-f-practice-exams/) | 情境式而非背誦式，2026 更新 |
| [claudecertificationguide.com 免費模擬考](https://claudecertificationguide.com/mock-exam) | 免費、免註冊：宣稱 30 課＋150+ 練習題＋完整模擬考（⚠️ 未查證），適合買付費題庫前先自測 |
| [GitHub：paullarionov/claude-certified-architect](https://github.com/paullarionov/claude-certified-architect) | 免費社群讀書筆記（agent loop、stop_reason、tool use、MCP、subagents），非題庫但可當補充 |

> Udemy 題庫在這張新證照上還沒有累積出「大量考生一致推薦」的口碑；Hong Chu 的心得確實提到用了約 $19.99 的付費模擬題。建議挑評分與評論數高的，並善用 Udemy 常態折扣。

### ❌ 不建議：Braindump／「真題」網站（違反 NDA）
- **SkillCertPro**（宣稱 720 題「real exam questions」）、**CertSafari**（614 題）等以「真題」為賣點的網站，屬 braindump 性質——使用真實考題**違反 Anthropic Certification 考試協議（NDA）**，可能導致成績作廢、證照吊銷，且內容品質無保證。列出僅供辨識避雷。

---

## 四、備考策略摘要（綜合多位考生）

1. **先讀官方 Exam Guide PDF**，照五大領域配分安排時間（Agentic Architecture 占 27% 最重）。
2. **上 Anthropic Academy 免費課程**：Claude Code in Action、Building with the Claude API、MCP 兩門課是共識必修。
3. **動手做**：官方建議約 6 個月實戰經驗；至少用 Claude API＋Agent SDK＋MCP 做過小專案、把 Claude Code 的 settings/hooks/subagents/`.mcp.json` 實際設定過一輪——考題是生產情境判斷題，光看書難通過。
4. **官方樣題與模擬考**打到 90% 以上，再用 1–2 套 Udemy 模擬題補情境題手感。
5. 考試當天：單螢幕、線上監考，平均一題 2 分鐘，先做有把握的題。

---

## 附錄：查證方法說明

本報告由 103 個research agents 對 21 個來源做五路搜尋（官方資訊／英文心得／中文社群／題庫／備考策略），44 條關鍵資訊中 25 條進入三票交叉查證：10 條全數通過（✅）、1 條被否決（「6 情境抽 4」說法）、14 條因查證中斷標為 ⚠️。⚠️ 項目多為多來源一致但未完成三票確認，使用前請以 [Anthropic 官方認證頁](https://anthropic.skilljar.com/)為準。
