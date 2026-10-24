-- 模型清單改用最新一代（#108）：預設值跟著 DEFAULT_MODEL 改成 claude-opus-5-5，
-- 既有列換成同系列的最新版，讀出時才不會被 ModelIdSchema 拒絕。
-- 目前沒有程式讀 conversations.model，部署空窗裡的舊程式不受影響。
alter table conversations
  alter column model set default 'claude-opus-5-5';

update conversations set model = 'claude-opus-5-5' where model = 'claude-opus-5';
update conversations set model = 'claude-haiku-5-5' where model = 'claude-haiku-4-5';
