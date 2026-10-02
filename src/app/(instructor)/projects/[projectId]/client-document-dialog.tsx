"use client";

import { useState } from "react";
import { CLIENT_DOCUMENT_KINDS, CLIENT_DOCUMENT_LABELS, type ClientDocumentKind } from "@/lib/mockup/types";
import { Dialog } from "../../../_components/dialog";
import { Field, Select, TextInput } from "../../../_components/ui";

export type ClientDocumentValues = { kind: ClientDocumentKind; title: string; fileName: string };

/** 新增客戶文件（#48）。demo 只記下檔名，不真的上傳檔案內容。只在要開的時候掛上。 */
export function ClientDocumentDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (values: ClientDocumentValues) => void }) {
  const [kind, setKind] = useState<ClientDocumentKind>("requirements");
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");

  const valid = title.trim() !== "" && fileName !== "";

  return (
    <Dialog
      open
      onClose={onClose}
      title="新增客戶文件"
      description="只傳一次，之後每次藍圖對話都讀得到；學員永遠看不到。"
      submitLabel="加入客戶文件"
      submitDisabled={!valid}
      onSubmit={() => onSubmit({ kind, title: title.trim(), fileName })}
    >
      <Field label="檔案" hint="Demo 只記下檔名，不會真的上傳。">
        <input
          type="file"
          required
          onChange={(e) => {
            const name = e.target.files?.[0]?.name ?? "";
            setFileName(name);
            // 標題還沒填時，先用去掉副檔名的檔名
            if (name && title.trim() === "") setTitle(name.replace(/\.[^.]+$/, ""));
          }}
          className="mt-1 block w-full text-sm text-navy file:mr-3 file:rounded-md file:border-0 file:bg-navy-tint file:px-4 file:py-2 file:text-sm file:font-bold file:text-navy hover:file:bg-iced"
        />
      </Field>
      <Field label="種類">
        <Select value={kind} onChange={(e) => setKind(e.target.value as ClientDocumentKind)}>
          {CLIENT_DOCUMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {CLIENT_DOCUMENT_LABELS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="標題">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="例如：客戶需求訪談紀錄" />
      </Field>
    </Dialog>
  );
}
