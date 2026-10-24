import { getInstructor } from "@/lib/mockup/instructor";
import { dayTimeText, VENUE_UNSET } from "@/lib/mockup/logic";
import type { Session } from "@/lib/mockup/types";

/** 場次的每一天：第幾天、日期時間、地點、授課講師。手機寬度下每一天自動換行堆疊。 */
export function SessionDays({ session }: { session: Session }) {
  const multi = session.days.length > 1;
  return (
    <ol className="space-y-2 text-sm">
      {session.days.map((d, i) => (
        <li key={d.startsAt} className="flex flex-wrap gap-x-4 gap-y-0.5">
          {multi && <span className="shrink-0 font-bold text-navy">第 {i + 1} 天</span>}
          <span className="text-navy">{dayTimeText(d)}</span>
          <span className={d.venue === null ? "font-bold text-warning" : "text-navy"}>{d.venue ?? VENUE_UNSET}</span>
          <span>
            <span className="text-body-muted">授課</span>{" "}
            <span className="font-bold text-navy">{getInstructor(d.instructorId)?.name ?? d.instructorId}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
