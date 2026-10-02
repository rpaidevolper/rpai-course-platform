"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "首頁", match: (p: string) => p === "/" || p.startsWith("/sessions") },
  { href: "/projects", label: "專案", match: (p: string) => p.startsWith("/projects") || p.startsWith("/courses") },
  { href: "/knowledge", label: "知識庫", match: (p: string) => p.startsWith("/knowledge") },
];

export function InstructorNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="主要導覽">
      <ul className="flex gap-1 lg:flex-col">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-bold ${
                  active ? "bg-navy-tint text-navy" : "text-body hover:bg-iced hover:text-navy"
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
