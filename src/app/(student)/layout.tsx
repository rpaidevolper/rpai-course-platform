/** 學員端外框：單欄置中，沒有講師導覽。 */
export default function StudentLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:py-12">{children}</main>
  );
}
