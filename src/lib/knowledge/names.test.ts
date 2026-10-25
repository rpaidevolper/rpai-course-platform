import { describe, expect, it } from "vitest";
import { INDUSTRIES } from "@/lib/mockup/types";
import { KNOWN_INDUSTRIES } from "./industries.ts";
import { buildNameTable, clientSegmentOf, parseAliases } from "./names.ts";

describe("clientSegmentOf 從配方 id 取客戶段", () => {
  it.each([
    ["202405_虛構精密_AI週報實戰", "虛構精密"],
    ["提案_虛構物流_AI入門", "虛構物流"],
    ["製造_202403_虛構電子_AI導入", "虛構電子"],
    ["製造_2024-2025_虛構甲_主題", "虛構甲"],
    ["AI入門_虛構丙_主題", null],
    ["202405", null],
    ["202405__課名", null],
  ])("%s → %j", (id, expected) => {
    expect(clientSegmentOf(id)).toBe(expected);
  });
});

describe("parseAliases 別名檔", () => {
  it("略過空行與 # 註解，! 開頭是例外", () => {
    expect(parseAliases("# 註解\n\n虛精\n  FakeLogi  \n!RPAI\n! 測試\n")).toEqual({
      names: ["虛精", "FakeLogi"],
      exceptions: ["RPAI", "測試"],
    });
    expect(parseAliases(null)).toEqual({ names: [], exceptions: [] });
  });
});

describe("buildNameTable 名稱表（只在記憶體裡）", () => {
  const table = buildNameTable({
    recipes: [
      { id: "202405_虛構精密_AI週報實戰", client: "虛構精密工業" },
      { id: "202406_虛工_AI小講", client: "虛工" },
      { id: "製造_202403_虛構電子_AI導入", client: null },
    ],
    aliasesText: "虛精\n!RPAI\n# 註解\nFakeLogi\n製造\n",
  });

  it("配方的 client、配方 id 的客戶段、別名檔都進名稱表", () => {
    expect(table.hits("虛構精密工業的週報")).toBe(true);
    expect(table.hits("虛構精密")).toBe(true);
    expect(table.hits("虛構電子")).toBe(true);
    expect(table.hits("虛精的例會")).toBe(true);
  });

  it("別名檔的名稱不分大小寫", () => {
    expect(table.hits("這堂 fakelogi 的客服課")).toBe(true);
    expect(table.hits("FAKELOGI")).toBe(true);
  });

  it("3 字（含）以下的配方名稱，別名檔沒列就不比對", () => {
    expect(table.hits("虛工的流程")).toBe(false);
  });

  it("內建例外（RPAI、產業名稱）與別名檔的 ! 例外不算客戶名稱", () => {
    expect(table.hits("RPAI 的課程")).toBe(false);
    expect(table.hits("rpai 的課程")).toBe(false);
    expect(table.hits("製造業的現場")).toBe(false);
  });

  it("統計只有數量：配方來源 3（只來自配方的）、別名檔 2", () => {
    expect(table.stats).toEqual({ total: 5, fromRecipes: 3, fromAliases: 2 });
  });

  it("mask 把命中的名稱換成遮罩字，不分大小寫；長的名稱先比對", () => {
    expect(table.mask("單元卡/虛構精密工業_週報.md")).toBe("單元卡/〔已遮蔽〕_週報.md");
    expect(table.mask("模組卡/B2 fakelogi 客服")).toBe("模組卡/B2 〔已遮蔽〕 客服");
    expect(table.mask("沒有名稱的文字")).toBe("沒有名稱的文字");
  });

  it("沒有任何名稱時 hits 永遠是 false，mask 原樣回傳", () => {
    const empty = buildNameTable({ recipes: [], aliasesText: null });
    expect(empty.hits("虛構精密")).toBe(false);
    expect(empty.mask("虛構精密")).toBe("虛構精密");
    expect(empty.stats).toEqual({ total: 0, fromRecipes: 0, fromAliases: 0 });
  });
});

describe("內建產業清單", () => {
  it("和 src/lib/mockup/types.ts 的 INDUSTRIES 相同（腳本不能 import 那個檔，所以抄一份）", () => {
    expect([...KNOWN_INDUSTRIES]).toEqual([...INDUSTRIES]);
  });
});
