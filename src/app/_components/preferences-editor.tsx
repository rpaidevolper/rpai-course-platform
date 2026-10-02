"use client";

import { useState } from "react";
import {
  addPreference,
  editPreference,
  removePreference,
  type InstructorPreference,
} from "@/lib/mockup/instructor";

const INPUT =
  "min-w-0 flex-1 rounded-md bg-white px-3 py-2 text-sm text-navy ring-[1.5px] ring-inset ring-body-muted placeholder:text-body-muted focus:ring-navy";
const BTN = "inline-flex shrink-0 items-center justify-center rounded-md px-3 py-2 text-sm font-bold";
const PRIMARY = `${BTN} bg-navy text-white hover:bg-navy-press disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-navy`;
const SECONDARY = `${BTN} bg-navy-tint text-navy hover:bg-iced`;
const DANGER = `${BTN} bg-white text-danger ring-[1.5px] ring-inset ring-danger-tint hover:bg-danger-tint`;

/** 講師偏好清單：檢視、新增、編輯、刪除。設計稿只存在記憶體，重新整理就還原。 */
export function PreferencesEditor({ initial }: { initial: InstructorPreference[] }) {
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setList((l) => addPreference(l, draft));
    setDraft("");
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setList((l) => editPreference(l, editing.id, editing.text));
    setEditing(null);
  }

  return (
    <div>
      {list.length === 0 ? (
        <p className="rounded-md bg-iced px-4 py-3 text-sm">還沒有講師偏好。在下面寫下你每門課都會交代的習慣。</p>
      ) : (
        <ol className="space-y-2">
          {list.map((p, i) => (
            <li key={p.id} className="rounded-md bg-white px-4 py-3 ring-[1.5px] ring-inset ring-iced">
              {editing?.id === p.id ? (
                <form onSubmit={submitEdit} className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`edit-${p.id}`} className="sr-only">
                    編輯第 {i + 1} 條講師偏好
                  </label>
                  <input
                    id={`edit-${p.id}`}
                    autoFocus
                    value={editing.text}
                    onChange={(e) => setEditing({ id: p.id, text: e.target.value })}
                    className={`${INPUT} basis-full sm:basis-auto`}
                  />
                  <button type="submit" className={PRIMARY} disabled={!editing.text.trim()}>
                    儲存
                  </button>
                  <button type="button" className={SECONDARY} onClick={() => setEditing(null)}>
                    取消
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <span className="w-5 shrink-0 pt-2 text-right text-sm font-bold text-navy">{i + 1}</span>
                  <p className="min-w-0 flex-1 basis-40 break-words pt-2 text-sm text-navy">{p.text}</p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className={SECONDARY}
                      aria-label={`編輯「${p.text}」`}
                      onClick={() => setEditing({ id: p.id, text: p.text })}
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      className={DANGER}
                      aria-label={`刪除「${p.text}」`}
                      onClick={() => {
                        setList((l) => removePreference(l, p.id));
                        if (editing?.id === p.id) setEditing(null);
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submitNew} className="mt-5 flex flex-wrap gap-2">
        <label htmlFor="new-preference" className="w-full text-xs font-bold text-body-muted">
          新增一條講師偏好
        </label>
        <input
          id="new-preference"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="例如：每個動手環節前先示範一次"
          className={`${INPUT} basis-full sm:basis-auto`}
        />
        <button type="submit" className={PRIMARY} disabled={!draft.trim()}>
          新增
        </button>
      </form>
    </div>
  );
}
