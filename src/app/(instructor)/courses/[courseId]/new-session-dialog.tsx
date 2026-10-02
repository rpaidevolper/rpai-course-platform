"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addMs, makeId, makePortalCode, newSessionDay } from "@/lib/mockup/actions";
import { dispatch } from "@/lib/mockup/store";
import type { Course, IsoTime } from "@/lib/mockup/types";
import { toast } from "../../../_components/demo-runtime";
import { Dialog } from "../../../_components/dialog";
import { Button, Field, TextInput } from "../../../_components/ui";

const DAY_MS = 24 * 60 * 60 * 1000;

interface DayRow {
  date: string;
  start: string;
  end: string;
  venue: string;
}

/** 預設：demo 時鐘兩週後起，每天一天，09:00–16:00 */
const defaultRows = (now: IsoTime, dayCount: number): DayRow[] =>
  Array.from({ length: dayCount }, (_, i) => ({
    date: addMs(now, (14 + i) * DAY_MS).slice(0, 10),
    start: "09:00",
    end: "16:00",
    venue: "",
  }));

const iso = (date: string, time: string): IsoTime => `${date}T${time}:00+08:00`;

function rowProblem(rows: DayRow[]): string | null {
  for (const [i, r] of rows.entries()) {
    const label = rows.length > 1 ? `第 ${i + 1} 天` : "這一天";
    if (!r.date || !r.start || !r.end) return `${label}的日期與時間要填完整`;
    if (r.end <= r.start) return `${label}的結束時間要晚於開始時間`;
    if (i > 0 && r.date <= rows[i - 1].date) return `第 ${i + 1} 天的日期要晚於第 ${i} 天`;
  }
  return null;
}

/**
 * 新增場次：場次的天數必須等於藍圖的天數，所以藍圖有幾天就填幾列。
 * 授課講師預設是自己，之後在場次頁可以改。
 */
export function NewSessionButton({ course, now }: { course: Course; now: IsoTime }) {
  const router = useRouter();
  const dayCount = course.blueprint.days.length;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DayRow[]>([]);
  const problem = rowProblem(rows);

  const update = (i: number, patch: Partial<DayRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    if (problem) return;
    const id = makeId("s");
    dispatch({
      type: "session/create",
      id,
      courseId: course.id,
      portalCode: makePortalCode(),
      days: rows.map((r) => newSessionDay(iso(r.date, r.start), iso(r.date, r.end), r.venue.trim() || null)),
    });
    setOpen(false);
    toast(`已新增「${course.title}」的場次，還沒發布給學員`);
    router.push(`/sessions/${id}`);
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setRows(defaultRows(now, dayCount));
          setOpen(true);
        }}
      >
        新增場次
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="新增場次"
        description={
          <p>
            藍圖有 {dayCount} 天，場次就有 {dayCount} 天，每一天各自的日期、時間與地點。授課講師預設是你，之後可以在場次頁改。
          </p>
        }
        submitLabel="建立場次"
        onSubmit={submit}
        submitDisabled={problem !== null}
      >
        {rows.map((r, i) => (
          <fieldset key={i} className="space-y-3 border-t-2 border-iced pt-3 first:border-t-0 first:pt-0">
            <legend className="text-sm font-bold text-navy">
              第 {i + 1} 天<span className="font-normal">・{course.blueprint.days[i]?.theme}</span>
            </legend>
            <Field label="日期">
              <TextInput type="date" required value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="開始">
                <TextInput type="time" required value={r.start} onChange={(e) => update(i, { start: e.target.value })} />
              </Field>
              <Field label="結束">
                <TextInput type="time" required value={r.end} onChange={(e) => update(i, { end: e.target.value })} />
              </Field>
            </div>
            <Field label="地點（可之後再填）">
              <TextInput value={r.venue} placeholder="地點未定" onChange={(e) => update(i, { venue: e.target.value })} />
            </Field>
          </fieldset>
        ))}
        {problem && <p className="text-xs font-bold text-warning">{problem}</p>}
      </Dialog>
    </>
  );
}
