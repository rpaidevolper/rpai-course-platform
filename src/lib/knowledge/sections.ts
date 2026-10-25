/**
 * 本文的整理：拿掉大標題（# ，標題另外存在 title 欄位）、刪掉指定的章節（## ，連同底下的 ### 一起刪），
 * 最後 trim，並把三個以上的連續換行壓成兩個。
 * 第一個 ## 之前的前言不屬於任何章節，會保留。
 */
export function cleanBody(body: string, dropSection: (title: string) => boolean): string {
  const kept: string[] = [];
  let dropping = false;
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) dropping = dropSection(line.slice(3).trim());
    if (!dropping) kept.push(line);
  }
  return kept.join("\n").trim().replace(/\n{3,}/g, "\n\n");
}
