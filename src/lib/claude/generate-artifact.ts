import type Anthropic from "@anthropic-ai/sdk";
import type { Blueprint } from "@/lib/blueprint/schema";
import { getAnthropic, MODEL } from "./client";

import type { ArtifactKind } from "@/lib/artifacts";
export type { ArtifactKind };

export interface GeneratedFile {
  fileId: string;
  filename: string;
  bytes: Buffer;
}

export interface GenerateArtifactInput {
  kind: ArtifactKind;
  blueprint: Blueprint;
  /** 品牌規範全文；固定內容，放 system 最前面吃快取。 */
  brandGuidelines: string;
  /** 講師這次的額外要求，例如「簡報壓在 20 頁內」。 */
  extraInstructions?: string;
}

const KIND_INSTRUCTIONS: Record<ArtifactKind, string> = {
  outline:
    "產出客戶版課程大綱（.docx）：課程資訊、學習成果、單元表（單元／分鐘／目標／內容／活動）、講師準備事項。",
  slides:
    "產出教學簡報（.pptx）：依藍圖的敘事模型分段；每個單元至少一頁重點、一頁動手或案例；金句獨立成頁。",
  handbook:
    "產出學員手冊（.docx）：課前準備、每單元的重點整理與練習欄位、帶走工具清單、延伸資源。",
};

/** 該產物要載入哪些 skill：Anthropic 內建的產檔 skill + 有設定的話再加自訂 rpai skill。 */
function skillsFor(kind: ArtifactKind): Anthropic.Beta.BetaSkillParams[] {
  const skills: Anthropic.Beta.BetaSkillParams[] = [
    {
      type: "anthropic",
      skill_id: kind === "slides" ? "pptx" : "docx",
      version: "latest",
    },
  ];
  const customIds = [
    process.env.ANTHROPIC_SKILL_ID_BRAND_GUIDELINES,
    kind === "slides" ? process.env.ANTHROPIC_SKILL_ID_PPTX_WORKFLOW : undefined,
  ];
  for (const id of customIds) {
    if (id) skills.push({ type: "custom", skill_id: id, version: "latest" });
  }
  return skills;
}

/** 從回應內容撈出沙箱寫出的檔案 id。 */
export function collectOutputFileIds(
  content: Anthropic.Beta.BetaContentBlock[],
): string[] {
  const ids: string[] = [];
  for (const block of content) {
    if (block.type !== "bash_code_execution_tool_result") continue;
    const result = block.content;
    if (result.type !== "bash_code_execution_result") continue;
    for (const output of result.content) {
      if (output.type === "bash_code_execution_output") ids.push(output.file_id);
    }
  }
  return ids;
}

/**
 * 用藍圖生成一份產物。在 Anthropic 沙箱裡跑 skill 產檔，再用 Files API 把檔案抓回來。
 * 這個呼叫可能跑好幾分鐘，只能在背景工作裡用，不要放在請求路徑上同步等。
 */
export async function generateArtifact({
  kind,
  blueprint,
  brandGuidelines,
  extraInstructions,
}: GenerateArtifactInput): Promise<GeneratedFile[]> {
  const client = getAnthropic();

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["code-execution-2025-08-25"],
    container: { skills: skillsFor(kind) },
    tools: [{ type: "code_execution_20260521", name: "code_execution" }],
    system: [
      { type: "text", text: brandGuidelines, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: `教學藍圖：\n${JSON.stringify(blueprint, null, 2)}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [KIND_INSTRUCTIONS[kind], extraInstructions]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(`生成被拒絕：${message.stop_details?.explanation ?? "無說明"}`);
  }

  const fileIds = collectOutputFileIds(message.content);
  if (fileIds.length === 0) {
    throw new Error(`沙箱沒有產出任何檔案（stop_reason=${message.stop_reason}）`);
  }

  return Promise.all(
    fileIds.map(async (fileId) => {
      const [meta, download] = await Promise.all([
        client.files.retrieveMetadata(fileId),
        client.files.download(fileId),
      ]);
      return {
        fileId,
        filename: meta.filename,
        bytes: Buffer.from(await download.arrayBuffer()),
      };
    }),
  );
}
