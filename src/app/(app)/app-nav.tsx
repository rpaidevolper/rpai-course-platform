"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "首頁", match: (p: string) => p === "/" },
  { href: "/settings", label: "設定", match: (p: string) => p.startsWith("/settings") },
  { href: "/demo", label: "設計稿", match: () => false },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    // 手機上自成一行、放不下就橫向捲動，不折行（同設計稿的 InstructorNav）
    <nav aria-label="主要導覽" className="-mx-4 basis-full overflow-x-auto px-4 pb-2 sm:mx-0 sm:basis-auto sm:overflow-visible sm:p-0">
      <ul className="flex gap-1 whitespace-nowrap">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-bold ${
                  active ? "bg-accent-tint text-ink" : "text-body hover:bg-layer hover:text-accent"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
