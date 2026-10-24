import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/mockup/types";

/**
 * 設計稿（#22）共用元件。品牌：介面產品淺色 N5／深色 D1，色碼見 globals.css。
 * - 只用角色 token（card、layer、ink、accent…），不寫色名，深淺色模式才會一起換。
 * - 填色只有 card（卡片）與 layer（分區）；accent 只做連結、細線、描邊與小面積按鈕。
 * - 要被記住的東西用 accent 線性強調（左強調條 ≤3px、描邊、大字），不用 layer 硬撐。
 * - 語意色只做徽章與文字。
 */

export const CARD = "rounded-lg bg-card shadow-[0_3px_16px_rgba(1,20,85,0.06)]";

/**
 * 左強調條（#121）。用 inset shadow 畫，不像 border 會把內容往右推 3px 而跟旁邊對不齊；
 * 左側不圓角，條才是直的。可以跟 CARD 的陰影疊用。
 */
export const EMPHASIS = "rounded-l-none inset-shadow-[3px_0_0_var(--color-accent)]";

export function Card({ children, className = "", emphasis = false }: { children: ReactNode; className?: string; emphasis?: boolean }) {
  return (
    <div className={`${CARD} p-5 ${emphasis ? EMPHASIS : ""} ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-sm">{description}</div>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    // 說明放不下時換到標題下一行，不跟標題擠
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <h2 className="text-base font-bold text-ink">{children}</h2>
      {aside && <div className="text-xs text-body-muted">{aside}</div>}
    </div>
  );
}

/**
 * 長頁面的頁內區塊導覽（#121）：黏在頂部列下方，點了跳到該區塊；放不下就橫向捲動。
 * globals.css 看到 data-section-nav 會加大錨點跳轉的上方留白，標題才不會被它蓋住。
 */
export function SectionNav({ label, items }: { label: string; items: [id: string, text: string][] }) {
  return (
    <nav data-section-nav aria-label={label} className="sticky top-(--header-h) z-10 -mx-4 mb-8 bg-canvas/95 px-4 py-2 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <ul className="flex gap-1 overflow-x-auto whitespace-nowrap">
        {items.map(([id, text]) => (
          <li key={id}>
            <a href={`#${id}`} className="block rounded-md px-3 py-1.5 text-sm font-bold text-body hover:bg-layer hover:text-ink">
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** 小標：欄位名稱。不用全大寫、不加字距。 */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <dt className="text-xs font-bold text-body-muted">{children}</dt>;
}

type Tone = "neutral" | "warning" | "success" | "danger" | "outline";
const TONES: Record<Tone, string> = {
  neutral: "bg-layer text-ink",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  outline: "bg-card text-ink ring-[1.5px] ring-inset ring-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const PROJECT_STATUS_TONES: Record<ProjectStatus, Tone> = {
  negotiating: "warning",
  active: "outline",
  archived: "neutral",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={PROJECT_STATUS_TONES[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

export type Crumb ={ label: string; href?: string };

/** 專案 › 課程 › 場次 的層級路徑。 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="目前位置" className="mb-3 text-xs text-body-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>›</span>}
            {c.href ? (
              <Link href={c.href} className="underline-offset-2 hover:text-accent hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold text-ink">
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
const PRIMARY_FILL = "bg-accent text-on-accent";
const SECONDARY_FILL = "bg-accent-tint text-ink";
const PRIMARY = `${BTN} ${PRIMARY_FILL} hover:bg-accent-press`;
const SECONDARY = `${BTN} ${SECONDARY_FILL} hover:bg-accent-tint-hover`;

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? PRIMARY : SECONDARY}>
      {children}
    </Link>
  );
}

const DANGER = `${BTN} bg-card text-danger ring-[1.5px] ring-inset ring-danger hover:bg-danger-tint`;
const BUTTON_VARIANTS = { primary: PRIMARY, secondary: SECONDARY, danger: DANGER } as const;
const DISABLED = "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[inherit]";

/** 真的會動的按鈕（#48）。在 client component 裡用。 */
export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof BUTTON_VARIANTS;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${BUTTON_VARIANTS[variant]} ${DISABLED}`}>
      {children}
    </button>
  );
}

/** 文字樣式的小按鈕，用在清單項目旁邊（例如「移除」），或卡片裡不常用的次要動作。 */
export function TextButton({
  children,
  onClick,
  tone = "accent",
  disabled = false,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "accent" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-xs font-bold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${tone === "danger" ? "text-danger" : "text-accent"}`}
    >
      {children}
    </button>
  );
}

const INPUT = "mt-1 block w-full rounded-md bg-card px-3 py-2 text-sm text-ink ring-1 ring-inset ring-body-muted focus:ring-2 focus:ring-accent focus:outline-none";

/** 表單欄位：label 包住輸入框。hint 顯示在下方。 */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-body-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-body-muted">{hint}</span>}
    </label>
  );
}

/**
 * 多選的選取膠囊（#121）：外觀是膠囊，底下仍是原生 checkbox，鍵盤、讀屏與表單行為照舊。
 * 選取時除了底色，還有描邊、粗體與勾號，不只靠顏色區分。
 */
export function CheckChip({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="group inline-flex cursor-pointer select-none items-center gap-1 rounded-full bg-layer px-3 py-1 text-sm text-ink ring-[1.5px] ring-inset ring-transparent hover:ring-body-muted has-[:checked]:bg-accent-tint has-[:checked]:font-bold has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span aria-hidden className="hidden group-has-[:checked]:inline">
        ✓
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={INPUT} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={INPUT} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={INPUT} />;
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

/**
 * 受定稿閘管的產檔按鈕。blocks 為空時可以按（onClick）；
 * 被擋時變暗、aria-disabled，原因用看得到的文字列在按鈕下方（手機沒有 hover），並以 aria-describedby 綁定。
 * onClick 只能在 client component 裡傳。
 */
export function GatedAction({
  id,
  children,
  blocks,
  variant = "primary",
  onClick,
  busy = false,
}: {
  id: string;
  children: ReactNode;
  blocks: string[];
  variant?: "primary" | "secondary";
  onClick?: () => void;
  /** 這份產物正在排隊或產出中：暫時不能再排 */
  busy?: boolean;
}) {
  const fill = variant === "primary" ? PRIMARY : SECONDARY;
  if (blocks.length === 0) {
    return (
      <button type="button" onClick={onClick} disabled={busy} title={busy ? "這一版還在產出中" : undefined} className={`${fill} ${DISABLED}`}>
        {children}
      </button>
    );
  }
  const reasonId = `${id}-blocked`;
  return (
    <div className="flex min-w-0 basis-full flex-col items-start gap-1.5">
      <button
        type="button"
        aria-disabled
        aria-describedby={reasonId}
        className={`${BTN} ${variant === "primary" ? PRIMARY_FILL : SECONDARY_FILL} cursor-not-allowed opacity-60`}
      >
        {children}
      </button>
      <p id={reasonId} className="text-xs font-bold text-warning">
        還不能排：{blocks.join("；")}
      </p>
    </div>
  );
}

/** 定義清單：label / value 成對。 */
export function Facts({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <FieldLabel>{label}</FieldLabel>
          <dd className="mt-0.5 text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-layer px-4 py-3 text-sm">{children}</p>;
}

/**
 * demo 中找不到資料時的畫面（#48）。用法：hydration 前（useHydrated() 為 false）傳 loading，
 * 之後仍找不到才顯示「找不到」，避免 demo 中新建的頁面閃一下 404。
 */
export function DemoMissing({ what, loading, backHref = "/demo", backLabel = "回首頁" }: { what: string; loading: boolean; backHref?: string; backLabel?: string }) {
  if (loading) return <p className="text-sm text-body-muted">載入中…</p>;
  return (
    <div className={`${CARD} p-6`}>
      <h1 className="text-lg font-bold text-ink">找不到這個{what}</h1>
      <p className="mt-2 text-sm">可能是 demo 已經重置，或連結打錯了。</p>
      <div className="mt-4">
        <ButtonLink href={backHref} variant="secondary">
          {backLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
