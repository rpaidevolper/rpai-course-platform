import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { collectOutputFileIds } from "./generate-artifact";

const blocks = [
  { type: "text", text: "做好了" },
  {
    type: "bash_code_execution_tool_result",
    tool_use_id: "toolu_1",
    content: {
      type: "bash_code_execution_result",
      stdout: "",
      stderr: "",
      return_code: 0,
      content: [
        { type: "bash_code_execution_output", file_id: "file_a" },
        { type: "bash_code_execution_output", file_id: "file_b" },
      ],
    },
  },
  {
    type: "bash_code_execution_tool_result",
    tool_use_id: "toolu_2",
    content: { type: "bash_code_execution_tool_result_error", error_code: "unavailable" },
  },
] as unknown as Anthropic.Beta.BetaContentBlock[];

describe("collectOutputFileIds", () => {
  it("只撈成功執行的輸出檔案", () => {
    expect(collectOutputFileIds(blocks)).toEqual(["file_a", "file_b"]);
  });

  it("沒有工具輸出時回傳空陣列", () => {
    expect(collectOutputFileIds([{ type: "text", text: "x" } as Anthropic.Beta.BetaContentBlock])).toEqual([]);
  });
});
