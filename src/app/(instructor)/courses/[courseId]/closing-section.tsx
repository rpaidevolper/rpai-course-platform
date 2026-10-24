"use client";

import Link from "next/link";
import { closingGate, closingGateReasons, isCourseClosed } from "@/lib/mockup/closing";
import { formatDateTime } from "@/lib/mockup/logic";
import { dispatch } from "@/lib/mockup/store";
import type { DemoState } from "@/lib/mockup/state";
import type { Course } from "@/lib/mockup/types";
import { toast } from "../../../_components/demo-runtime";
import { Badge, Button, CARD, SectionTitle } from "../../../_components/ui";

/**
 * 結案：每天的最終版簡報（課後由講師上傳）都齊了、所有場次都已結束，才能按。
 * 缺哪一天、缺哪一種，以及還有沒有場次沒結束，都列在按鈕上方。
 * 結案時內容會拆成待審核的知識庫草稿（新單元卡、更新單元卡、新課程配方、模組卡新版本），到知識庫審核後才收進去。
 */
export function ClosingSection({ st, course }: { st: DemoState; course: Course }) {
  const closed = isCourseClosed(course);
  const gate = closingGate(st, course, st.now);
  const reasons = closingGateReasons(gate);

  const close = () => {
    dispatch({ type: "course/close", courseId: course.id });
    toast(`「${course.title}」已結案，內容已拆成知識庫草稿，等你審核`);
  };

  return (
    <section aria-labelledby="closing" className="mt-10">
      <SectionTitle aside="場次都上完、每天的最終版都上傳了，才能結案">
        <span id="closing">結案</span>
      </SectionTitle>
      <div className={`${CARD} p-4 text-sm`}>
        {closed ? (
          <>
            <Badge tone="success">已結案</Badge>
            <p className="mt-2 text-body-muted">
              {formatDateTime(course.closedAt!)} 結案。結案後不能再新增場次；要再開同樣的課，請複製這門課程。
            </p>
            <p className="mt-2">
              結案時內容已拆成待審核的知識庫草稿，
              <Link href="/knowledge" className="font-bold text-navy underline underline-offset-2">
                到知識庫審核
              </Link>
              ；審核時可以排除單元，也可以改寫含客戶機密的文字。
            </p>
          </>
        ) : (
          <>
            <p className="text-body-muted">最終版是課後由你上傳、代表實際上課內容的簡報（講稿在備忘稿裡）。AI 產的版本即使沒改，也要重新上傳一次才算。</p>
            <ul className="mt-3 space-y-1">
              {reasons.length === 0 ? (
                <li>每一天的最終版都齊了，所有場次都已結束，可以結案。</li>
              ) : (
                reasons.map((r) => (
                  <li key={r} className="text-danger">
                    {r}
                  </li>
                ))
              )}
            </ul>
            <div className="mt-3">
              <Button onClick={close} disabled={!gate.canClose} title={gate.canClose ? undefined : "上面列的事情都完成才能結案"}>
                結案
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
