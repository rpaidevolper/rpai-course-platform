import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVER_INSTRUCTIONS } from "./instructions";
import { registerPlatformTools, type PlatformStores } from "./tools";
import { createTestServer } from "./tools/testing";

const RUNNER_SKILL = readFileSync(
  new URL("../../../plugin/skills/rpai-platform-runner/SKILL.md", import.meta.url),
  "utf8",
);

/** 註冊時不會呼叫 store，給空物件就夠了。 */
function registeredTools(): string[] {
  const t = createTestServer();
  registerPlatformTools(t.server, {} as PlatformStores, { baseUrl: "http://localhost:3000" });
  return t.toolNames();
}

const mentioned = (text: string) => [...new Set(text.match(/rpai_platform_[a-z_]+/g) ?? [])];

describe("MCP 說明與 runner skill", () => {
  it("instructions 提到的工具都存在", () => {
    expect(registeredTools()).toEqual(expect.arrayContaining(mentioned(SERVER_INSTRUCTIONS)));
  });

  it("runner skill 提到的工具都存在", () => {
    expect(registeredTools()).toEqual(expect.arrayContaining(mentioned(RUNNER_SKILL)));
  });
});
