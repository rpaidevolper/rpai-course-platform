import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 設計稿（#22）共用元件。品牌：介面產品淺色模式 N5。
 * - 填色只有 White（卡片）與 IceD（分區）；Navy 只做文字、細線、描邊與小面積按鈕。
 * - 要被記住的東西用 Navy 線性強調（左強調條 ≤3px、描邊、大字），不用 IceD 硬撐。
 * - 語意色只做徽章與文字。
 */

export const CARD = "rounded-lg bg-white shadow-[0_3px_16px_rgba(1,20,85,0.06)]";

export function Card({ children, className = "", emphasis = false }: { children: ReactNode; className?: string; emphasis?: boolean }) {
  return (
    <div className={`${CARD} p-5 ${emphasis ? "border-l-[3px] border-navy" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-navy sm:text-[1.75rem]">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-sm">{description}</div>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.95rem] font-bold text-navy">{children}</h2>
      {aside && <div className="text-xs text-body-muted">{aside}</div>}
    </div>
  );
}

/** 小標：欄位名稱。不用全大寫、不加字距。 */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <dt className="text-xs font-bold text-body-muted">{children}</dt>;
}

type Tone = "neutral" | "warning" | "success" | "danger" | "outline";
const TONES: Record<Tone, string> = {
  neutral: "bg-iced text-navy",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  outline: "bg-white text-navy ring-[1.5px] ring-inset ring-navy",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export type Crumb = { label: string; href?: string };

/** 專案 › 課程 › 場次 的層級路徑。 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="目前位置" className="mb-3 text-xs text-body-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>›</span>}
            {c.href ? (
              <Link href={c.href} className="underline-offset-2 hover:text-navy hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold text-navy">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const BTN = "inline-flex items-center rounded-md px-4 py-2 text-sm font-bold";
const PRIMARY_FILL = "bg-navy text-white";
const SECONDARY_FILL = "bg-navy-tint text-navy";
const PRIMARY = `${BTN} ${PRIMARY_FILL} hover:bg-navy-press`;
const SECONDARY = `${BTN} ${SECONDARY_FILL} hover:bg-iced`;

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? PRIMARY : SECONDARY}>
      {children}
    </Link>
  );
}

/**
 * 設計稿裡還沒接上的動作：看得到、按不下去，滑過說明原因。
 * 用 aria-disabled 而不是 disabled，鍵盤仍可聚焦讀到說明。
 */
export function MockAction({ children, variant = "primary", reason = "設計稿：這個動作還沒接上" }: { children: ReactNode; variant?: "primary" | "secondary"; reason?: string }) {
  return (
    <button type="button" aria-disabled title={reason} className={`${BTN} ${variant === "primary" ? PRIMARY_FILL : SECONDARY_FILL} cursor-not-allowed opacity-60`}>
      {children}
    </button>
  );
}

/** 定義清單：label / value 成對。 */
export function Facts({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <FieldLabel>{label}</FieldLabel>
          <dd className="mt-0.5 text-sm text-navy">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-iced px-4 py-3 text-sm">{children}</p>;
}
