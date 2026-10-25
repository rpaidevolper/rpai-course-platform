"use client";

import { useState } from "react";
import { reopenWithdrawals } from "@/lib/mockup/closing";
import { moduleLabel } from "@/lib/mockup/logic";
import { dispatch } from "@/lib/mockup/store";
import type { DemoState } from "@/lib/mockup/state";
import type { Course } from "@/lib/mockup/types";
import { toast } from "@/app/_components/demo-runtime";
import { Dialog } from "@/app/_components/dialog";
import { Button } from "@/app/_components/ui";

/** 草稿的顯示名稱：新單元卡、課程配方看標題，其他種類看種類 */
function draftTitle(p: ReturnType<typeof reopenWithdrawals>[number]["proposal"], st: DemoState): string {
  switch (p.kind) {
    case "new_unit_card":
      return `新單元卡：${p.unitCard.title}`;
    case "new_course_recipe":
      return `課程配方：${p.recipe.title}`;
    case "update_unit_card":
      return `更新單元卡：${st.unitCards.find((u) => u.id === p.unitCardId)?.title ?? p.unitCardId}`;
    case "module_card_version":
      return `模組卡新版本：${moduleLabel(p.moduleId)}`;
  }
}

/**
 * 重新開啟已結案的課程。先確認：列出會被撤回的待審知識庫草稿（已收進知識庫的內容不受影響）。
 * 重新開啟後課程可以再修改，再次結案會重新產生草稿。
 */
export function ReopenCourseButton({ st, course }: { st: DemoState; course: Course }) {
  const [open, setOpen] = useState(false);
  const withdrawn = reopenWithdrawals(st, course.id);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        重新開啟
      </Button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={`重新開啟「${course.title}」？`}
          description={
            <p>
              重新開啟後，這門課程又可以修改場次、產物、藍圖和素材；再次結案時會重新產生知識庫草稿。已經收進知識庫的內容不受影響。
            </p>
          }
          submitLabel="重新開啟"
          onSubmit={() => {
            dispatch({ type: "course/reopen", courseId: course.id });
            setOpen(false);
            toast(withdrawn.length > 0 ? `「${course.title}」已重新開啟，撤回 ${withdrawn.length} 份待審草稿` : `「${course.title}」已重新開啟`);
          }}
        >
          {withdrawn.length > 0 ? (
            <div className="text-sm">
              <p className="font-bold text-ink">會撤回 {withdrawn.length} 份還在待審的知識庫草稿：</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {withdrawn.map((d) => (
                  <li key={d.id} className="break-words">
                    {draftTitle(d.proposal, st)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">這門課程結案產生的草稿都已審核完，沒有要撤回的草稿。</p>
          )}
        </Dialog>
      )}
    </>
  );
}
