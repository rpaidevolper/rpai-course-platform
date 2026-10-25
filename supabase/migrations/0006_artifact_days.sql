-- 0006_artifact_days：產物分天、記錄上游與改自哪一份（#135）。向下相容：只新增欄位、放寬唯一性。

alter table artifacts
  add column day             integer check (day >= 1),     -- 第幾天，從 1 起算；課程大綱沒有
  add column upstream_id     uuid references artifacts (id) on delete set null,  -- 學員手冊的上游簡報
  add column edited_from_id  uuid references artifacts (id) on delete set null;  -- 講師改過再上傳時，原本那一份

alter table artifacts
  add constraint artifacts_outline_has_no_day check (day is null or kind <> 'outline');

-- 版本改在「課程＋種類＋第幾天」裡遞增；課程大綱沒有天，以 0 計。
alter table artifacts drop constraint if exists artifacts_course_id_kind_version_key;
create unique index artifacts_course_kind_day_version_key
  on artifacts (course_id, kind, coalesce(day, 0), version);
