-- 每場對話各自選用的 Claude 模型。
-- 可選清單由程式端（src/lib/claude/models.ts 的 ModelIdSchema）驗證，不寫進 DB constraint，
-- 之後增減模型不用再開 migration。預設值要跟 DEFAULT_MODEL 一致。
alter table conversations
  add column model text not null default 'claude-opus-5';
