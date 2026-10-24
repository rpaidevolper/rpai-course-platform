---
status: accepted
---

# PoC 階段雲端 session 直接共用正式環境資料庫

Claude Code on the web 的雲端 session 要用資料庫時，原本只能在容器裡手動啟動 Docker 與本機 Supabase。本機 Supabase 要下載約 7.5 GB 映像檔，雲端容器每個新 session 都可能要重新下載，下載來源也有額度限制（實測遇過 `Data limit exceeded`），所以自動啟動不可靠（#49 已關閉）。現在是 PoC 階段，使用者只有團隊自己，所以雲端 session 直接連正式環境的 Supabase，金鑰設在 claude.ai 的雲端環境設定，不進 repo。這推翻了部署設計（`docs/specs/2026-10-02-production-deployment-design.md`）裡「開發者預設不拿 production 金鑰」的部分；本機與 Dev Container 照舊用本機 Supabase。

## Considered Options

- **另開一個開發用的 Supabase 雲端專案**：不碰正式資料，但多一個專案要維護，migration 也要套兩次。PoC 階段不值得。
- **在雲端 session 裡跑本機 Supabase**：如上，每個 session 都可能要重新下載映像檔，不可靠。

## Consequences

- service role key 會繞過 RLS，雲端 session 裡的 Claude 對正式資料有完整讀寫權限，測試資料也會寫進正式資料庫。CLAUDE.md 規定雲端 session 不刪改既有資料、不手動套 migration。
- 新 migration 仍然是合併後才由 CI 套到正式環境，雲端 session 裡開發中的程式碼會面對還沒升級的 schema；要測新 migration 用本機或 Dev Container。
- 能編輯這個雲端環境設定的人，都拿得到正式環境的金鑰。
- 有團隊以外的使用者或真實客戶資料之後，改成另開開發用專案，並另立 ADR 取代這份。
