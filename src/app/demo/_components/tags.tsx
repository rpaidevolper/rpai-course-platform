import { TAG_GROUPS, toggleTag, type Spec } from "@/lib/mockup/tags";
import { AUDIENCES, INDUSTRIES, SCENARIOS, TOOL_TAGS, type TagSet } from "@/lib/mockup/types";
import { Badge } from "@/app/_components/ui";

/** 每一組標籤可以挑的值 */
const OPTIONS: Record<keyof TagSet, readonly string[]> = {
  audiences: AUDIENCES,
  tools: TOOL_TAGS,
  industries: INDUSTRIES,
  scenarios: SCENARIOS,
};

/**
 * 顯示標籤：對象、工具、產業、應用場景四組，加上由總時數推得的規格（有 spec 才顯示）。
 * 沒有的組顯示「—」，讓講師看得到缺哪一格。單元卡沒有自己的產業，傳 tags 時省略那一組即可。
 */
export function TagList({ tags, spec }: { tags: Partial<TagSet>; spec?: Spec | null }) {
  const groups = TAG_GROUPS.filter((g) => tags[g.key] !== undefined);
  return (
    <ul aria-label="標籤" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {spec !== undefined && (
        <li className="flex items-center gap-1.5">
          <span className="font-bold text-body-muted">規格</span>
          {spec ? <Badge tone="outline">{spec}</Badge> : <span className="text-body-muted">—</span>}
        </li>
      )}
      {groups.map((g) => {
        const values = tags[g.key] ?? [];
        return (
          <li key={g.key} className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-body-muted">{g.label}</span>
            {values.length === 0 ? (
              <span className="text-body-muted">—</span>
            ) : (
              values.map((v) => (
                <Badge key={v} tone="neutral">
                  {v}
                </Badge>
              ))
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 標籤的多選：各組一排核取方塊，規格不在這裡挑（由總時數推得）。
 * 課程的標籤沒有「工具」（由藍圖推得），傳 groups 只列要挑的幾組，value 與 onChange 的型別就不含沒列的組。
 */
export function TagPicker<K extends keyof TagSet = keyof TagSet>({
  value,
  onChange,
  groups = Object.keys(OPTIONS) as K[],
}: {
  value: Pick<TagSet, K>;
  onChange: (next: Pick<TagSet, K>) => void;
  groups?: readonly K[];
}) {
  return (
    <div className="grid gap-3">
      {TAG_GROUPS.filter((g): g is { key: K; label: string } => (groups as readonly string[]).includes(g.key)).map((g) => (
        <fieldset key={g.key}>
          <legend className="text-xs font-bold text-body-muted">{g.label}（可多選）</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {OPTIONS[g.key].map((option) => (
              <label key={option} className="flex items-center gap-1.5 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={(value[g.key] as string[]).includes(option)}
                  onChange={() => onChange({ ...value, [g.key]: toggleTag(value[g.key] as string[], option) })}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
