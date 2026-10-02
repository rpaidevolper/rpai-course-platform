import { describe, expect, it } from "vitest";
import { checkBlueprint, missingElements } from "@/lib/blueprint/schema";
import {
  CatalogModuleSchema,
  modulesForTopic,
  TOPICS,
  type TopicId,
} from "./catalog";
import { openingMessage, prototypeBlueprint, scriptedReply } from "./script";

const topicIds = TOPICS.map((t) => t.id) as TopicId[];

describe("模組目錄 fixture", () => {
  it.each(topicIds)("%s 至少有一個模組且符合 schema", (topic) => {
    const mods = modulesForTopic(topic);
    expect(mods.length).toBeGreaterThan(0);
    for (const m of mods) CatalogModuleSchema.parse(m);
  });

  it("不同主題推薦的模組不同", () => {
    const titles = topicIds.map((t) => modulesForTopic(t).map((m) => m.title));
    expect(new Set(titles.flat()).size).toBe(titles.flat().length);
  });
});

describe("腳本式對話", () => {
  it.each(topicIds)("%s 的開場白提到主題名稱", (topic) => {
    expect(openingMessage(topic).text).toContain(
      TOPICS.find((t) => t.id === topic)!.label,
    );
  });

  it("第一次回覆引用該主題的模組，不含其他主題的模組", () => {
    const reply = scriptedReply("gas", 0).text;
    for (const m of modulesForTopic("gas")) expect(reply).toContain(m.title);
    for (const m of modulesForTopic("claude")) {
      expect(reply).not.toContain(m.title);
    }
  });

  it("腳本講完後仍有回覆", () => {
    expect(scriptedReply("claude", 99).role).toBe("assistant");
  });
});

describe("藍圖 fixture", () => {
  it.each(topicIds)("%s 通過 BlueprintSchema 且只缺金句", (topic) => {
    const bp = prototypeBlueprint(topic);
    expect(missingElements(bp)).toEqual(["quote"]);
  });

  it.each(topicIds)("%s 的單元分鐘數加總等於課程長度", (topic) => {
    const issues = checkBlueprint(prototypeBlueprint(topic));
    expect(issues.some((i) => i.kind === "duration_mismatch")).toBe(false);
  });
});
