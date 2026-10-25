-- 0007_drop_conversations：移除對話表（#147）。破壞性：會刪除 messages、conversations 兩張表與其中的列，且不可逆。
-- 原因見 ADR 0008：後台不再呼叫 AI，藍圖對話改在講師自己的 AI 裡進行。#145 已移除程式碼，這是兩步移除的第二步。

-- messages 參照 conversations，所以先刪 messages。刻意不加 cascade：有預期外的相依時，這裡應該直接失敗。
drop table messages;
drop table conversations;
drop type conversation_purpose;
