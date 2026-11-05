// Offline tests for explicit date windows (start_date/end_date) and for paging
// advanced_search_analytics results with start_row. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveDateRange, precedingDateRange } from "../dist/analytics.js";
import { sortAndPage, MAX_PAGE_SIZE } from "../dist/tools/advanced-search-analytics.js";

test("resolveDateRange: an explicit pair wins over days and counts inclusive days", () => {
  assert.deepEqual(resolveDateRange(28, "2026-10-01", "2026-10-31"), {
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    days: 31,
  });
  assert.equal(resolveDateRange(7, "2026-02-01", "2026-02-28").days, 28);
  assert.equal(resolveDateRange(7, "2026-10-05", "2026-10-05").days, 1);
  // Daylight-saving change inside the window must not shift the count.
  assert.equal(resolveDateRange(7, "2026-03-01", "2026-03-31").days, 31);
});

test("resolveDateRange: without dates it falls back to the last N days", () => {
  const r = resolveDateRange(28);
  assert.equal(r.days, 28);
  assert.match(r.startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(r.endDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(resolveDateRange(28, "", ""), r);
});

test("resolveDateRange: rejects half pairs, bad formats, impossible dates and reversed ranges", () => {
  assert.throws(() => resolveDateRange(28, "2026-10-01"), /together/);
  assert.throws(() => resolveDateRange(28, undefined, "2026-10-31"), /together/);
  assert.throws(() => resolveDateRange(28, "2026-10-1", "2026-10-31"), /YYYY-MM-DD/);
  assert.throws(() => resolveDateRange(28, "2026-02-30", "2026-03-31"), /not a valid calendar date/);
  assert.throws(() => resolveDateRange(28, "2026-10-31", "2026-10-01"), /after/);
});

test("precedingDateRange: same length, ending the day before", () => {
  assert.deepEqual(precedingDateRange(resolveDateRange(28, "2026-10-01", "2026-10-31")), {
    startDate: "2026-08-31",
    endDate: "2026-09-30",
    days: 31,
  });
  assert.deepEqual(precedingDateRange(resolveDateRange(28, "2026-03-01", "2026-03-07")), {
    startDate: "2026-02-22",
    endDate: "2026-02-28",
    days: 7,
  });
});

function makeRows(n) {
  // Many ties on clicks on purpose: paging must still be stable.
  return Array.from({ length: n }, (_, i) => ({
    keys: [`q${String(i).padStart(5, "0")}`],
    clicks: i % 7,
    impressions: (i * 37) % 1000,
    ctr: 0,
    position: 1 + (i % 50),
  }));
}

test("sortAndPage: pages cover every row exactly once, in sort order", () => {
  const rows = makeRows(1234);
  for (const orderBy of ["clicks", "impressions"]) {
    const seen = [];
    let startRow = 0;
    let pages = 0;
    while (startRow !== null) {
      // Shuffle the input each call: the API's order is not something to rely on.
      const shuffled = [...rows].sort(() => Math.random() - 0.5);
      const page = sortAndPage(shuffled, orderBy, "descending", startRow, 500);
      assert.equal(page.totalRows, 1234);
      seen.push(...page.rows);
      startRow = page.nextStartRow;
      pages += 1;
      assert.equal(page.hasMore, startRow !== null);
    }
    assert.equal(pages, 3);
    assert.equal(seen.length, 1234);
    assert.equal(new Set(seen.map((r) => r.keys[0])).size, 1234);
    for (let i = 1; i < seen.length; i++) {
      assert.ok(seen[i - 1][orderBy] >= seen[i][orderBy], `${orderBy} out of order at ${i}`);
    }
  }
});

test("sortAndPage: row_limit above the cap is lowered and reported, never silently cut", () => {
  const page = sortAndPage(makeRows(2000), "clicks", "descending", 0, 5000);
  assert.equal(page.rows.length, MAX_PAGE_SIZE);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextStartRow, MAX_PAGE_SIZE);
  assert.match(page.rowLimitCapped, /lowered to 500/);
  assert.equal(sortAndPage(makeRows(10), "clicks", "descending", 0, 100).rowLimitCapped, null);
});

test("sortAndPage: last page and offsets past the end", () => {
  const last = sortAndPage(makeRows(600), "clicks", "descending", 500, 500);
  assert.equal(last.rows.length, 100);
  assert.equal(last.hasMore, false);
  assert.equal(last.nextStartRow, null);
  const past = sortAndPage(makeRows(600), "clicks", "descending", 900, 500);
  assert.equal(past.rows.length, 0);
  assert.equal(past.hasMore, false);
});

test("sortAndPage: ascending order", () => {
  const page = sortAndPage(makeRows(50), "position", "ascending", 0, 10);
  assert.equal(page.rows[0].position, 1);
  assert.ok(page.rows.every((r, i, a) => i === 0 || a[i - 1].position <= r.position));
});
