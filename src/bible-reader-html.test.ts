import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { BIBLE_READER_HTML } from "./bible-reader-html.ts";
import {
  BIBLE_READER_INLINE_UTILS,
  hasReaderVerses,
} from "./translation-utils.ts";

function loadInlineHasReaderVerses() {
  const context: Record<string, unknown> = {};
  vm.runInNewContext(BIBLE_READER_INLINE_UTILS, context);
  return context.hasReaderVerses as typeof hasReaderVerses;
}

describe("hasReaderVerses", () => {
  const validContent = { verses: [{ verse: 1, text: "In the beginning" }] };

  it("accepts renderable verse payloads", () => {
    assert.equal(hasReaderVerses(validContent), true);
    assert.equal(hasReaderVerses({ verses: [] }), true);
  });

  for (const malformedContent of [
    null,
    "not an object",
    {},
    { verses: null },
    { verses: "not an array" },
    { verses: [null] },
    { verses: [{ verse: "1", text: "wrong verse type" }] },
    { verses: [{ verse: 1, text: null }] },
  ]) {
    it(`rejects malformed reader payload: ${JSON.stringify(malformedContent)}`, () => {
      assert.equal(hasReaderVerses(malformedContent), false);
    });
  }

  it("keeps the inline UI payload guard in sync", () => {
    const inlineHasReaderVerses = loadInlineHasReaderVerses();
    const cases = [validContent, { verses: [] }, {}, { verses: null }, { verses: [null] }];

    for (const data of cases) {
      assert.equal(inlineHasReaderVerses(data), hasReaderVerses(data));
    }
  });
});

describe("Bible reader accessibility markup", () => {
  it("labels the book search field and uses semantic browse controls", () => {
    assert.match(BIBLE_READER_HTML, /<label class="visually-hidden" for="bookSearch">Search books<\/label>/);
    assert.match(BIBLE_READER_HTML, /<button type="button" class="testament-header"[\s\S]*?aria-expanded="true" aria-controls=/);
    assert.match(BIBLE_READER_HTML, /<button type="button" class="book-row[\s\S]*?aria-label="Show chapters for [\s\S]*?aria-expanded=/);
    assert.match(BIBLE_READER_HTML, /expandedBookEl\?\.setAttribute\("aria-expanded", "false"\)/);
  });

  it("renders a clear error instead of iterating malformed verses", () => {
    assert.match(BIBLE_READER_HTML, /if \(!hasReaderVerses\(currentData\)\)/);
    assert.match(BIBLE_READER_HTML, /No verses were returned for this passage\./);
  });
});
