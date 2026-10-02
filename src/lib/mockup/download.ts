"use client";

/**
 * demo 用的「下載」（#48）：沒有真實檔案，產生一個說明用的文字檔讓瀏覽器下載，
 * 讓 demo 時點下載有實際反應。檔名保留原本的副檔名資訊，實際內容是 .txt。
 */
export function downloadPlaceholder(fileName: string, lines: string[]) {
  const body = ["這是 RPAI 講師後台 demo 產生的示意檔，不是真正的教材。", "", ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}（示意）.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
