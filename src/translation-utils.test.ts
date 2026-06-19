import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  BIBLE_READER_INLINE_UTILS,
  isRtlContent,
  isRtlTranslation,
  parseTranslationsList,
  readerStructuredContent,
} from "./translation-utils.ts";

const LIST_TRANSLATIONS_SAMPLE = `📚 AVAILABLE TRANSLATIONS
────────────────────────────────────────

• WEB - World English Bible
  Modern English translation
  Language: en | License: Public Domain

• WLC - Westminster Leningrad Codex
  Hebrew Old Testament text
  Language: he | License: Public Domain

• asv.bsb - Berean Standard Bible
  Language: en | License: Public Domain
`;

function loadInlineUtils(currentTranslation = "web") {
  const ctx: Record<string, unknown> = { currentTranslation };
  vm.runInNewContext(BIBLE_READER_INLINE_UTILS, ctx);
  return ctx as {
    isRtlContent: typeof isRtlContent;
    parseTranslationsList: typeof parseTranslationsList;
  };
}

describe("isRtlTranslation", () => {
  it("detects WLC by translation id", () => {
    assert.equal(isRtlTranslation({ id: "wlc", name: "WLC" }), true);
  });

  it("detects Hebrew by language code he", () => {
    assert.equal(
      isRtlTranslation({ id: "custom-hebrew", name: "Custom", language: "he" }),
      true
    );
  });

  it("detects Hebrew by language code heb", () => {
    assert.equal(
      isRtlTranslation({ id: "custom", name: "Custom", language: "heb" }),
      true
    );
  });

  it("detects Hebrew by BCP-47 subtag he-*", () => {
    assert.equal(
      isRtlTranslation({ id: "custom", name: "Custom", language: "he-IL" }),
      true
    );
  });

  it("returns false for English translations", () => {
    assert.equal(
      isRtlTranslation({ id: "web", name: "WEB", language: "en" }),
      false
    );
    assert.equal(
      isRtlTranslation({ id: "kjv", name: "KJV", language: "en" }),
      false
    );
  });
});

describe("isRtlContent", () => {
  it("treats server direction rtl as authoritative", () => {
    assert.equal(
      isRtlContent({
        direction: "rtl",
        translation: { id: "web", name: "WEB", language: "en" },
      }),
      true
    );
  });

  it("treats server direction ltr as authoritative over wlc id", () => {
    assert.equal(
      isRtlContent({
        direction: "ltr",
        translation: { id: "wlc", name: "WLC", language: "he" },
      }),
      false
    );
  });

  it("falls back to language code when direction is absent", () => {
    assert.equal(
      isRtlContent({
        language: "he",
        translation: { id: "hebrew-text", name: "Hebrew" },
      }),
      true
    );
  });
});

describe("parseTranslationsList", () => {
  it("parses standard list_translations output", () => {
    const result = parseTranslationsList(LIST_TRANSLATIONS_SAMPLE);
    assert.deepEqual(result.map((t) => t.id), ["web", "wlc", "asv.bsb"]);
    assert.equal(result[2].name, "Berean Standard Bible");
    assert.equal(result[2].shortName, "asv.bsb");
  });

  it("returns empty array for unparseable text", () => {
    assert.deepEqual(parseTranslationsList("no translations here"), []);
  });
});

describe("readerStructuredContent", () => {
  it("includes rtl direction and Hebrew language for WLC", () => {
    const result = readerStructuredContent(
      { viewType: "verses" },
      { id: "wlc", name: "WLC", language: "he" }
    );
    assert.equal(result.direction, "rtl");
    assert.equal(result.language, "he");
  });

  it("includes ltr direction for WEB", () => {
    const result = readerStructuredContent(
      { viewType: "verses" },
      { id: "web", name: "WEB", language: "en" }
    );
    assert.equal(result.direction, "ltr");
    assert.equal(result.language, "en");
  });
});

describe("BIBLE_READER_INLINE_UTILS parity", () => {
  it("inline isRtlContent matches module implementation", () => {
    const inline = loadInlineUtils("web");
    const cases: Array<Parameters<typeof isRtlContent>> = [
      [{ direction: "rtl", translation: { id: "web", name: "WEB" } }],
      [{ direction: "ltr", translation: { id: "wlc", name: "WLC" } }],
      [{ language: "he", translation: { id: "hebrew", name: "Hebrew" } }],
      [null],
    ];

    for (const args of cases) {
      assert.equal(
        inline.isRtlContent(args[0], args[1]),
        isRtlContent(args[0], args[1])
      );
    }
  });

  it("inline parseTranslationsList matches module implementation", () => {
    const inline = loadInlineUtils();
    assert.equal(
      JSON.stringify(inline.parseTranslationsList(LIST_TRANSLATIONS_SAMPLE)),
      JSON.stringify(parseTranslationsList(LIST_TRANSLATIONS_SAMPLE))
    );
  });
});
