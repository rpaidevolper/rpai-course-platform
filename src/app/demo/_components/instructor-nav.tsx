"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/demo", label: "首頁", match: (p: string) => p === "/demo" || p.startsWith("/demo/sessions") },
  { href: "/demo/projects", label: "專案", match: (p: string) => p.startsWith("/demo/projects") || p.startsWith("/demo/courses") },
  { href: "/demo/knowledge", label: "知識庫", match: (p: string) => p.startsWith("/demo/knowledge") },
  { href: "/demo/settings", label: "講師偏好", match: (p: string) => p.startsWith("/demo/settings") },
];

export function InstructorNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="主要導覽">
      <ul className="flex flex-wrap gap-1">
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
