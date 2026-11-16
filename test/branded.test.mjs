// Offline tests for the Search Analytics API update of 2026-11: brandedClassification,
// filterLists for several devices/countries, and the branded_analysis aggregation.
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normaliseFilters,
  deviceCountryLists,
  brandedFilter,
  brandedWindowNote,
  assertValidDimensions,
} from "../dist/analytics.js";
import { bucketOf, buildSeries, splitTotals } from "../dist/tools/branded-analysis.js";

const row = (keys, clicks, impressions, position = 1) => ({
  keys,
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
});

test("brandedFilter: maps the choice to the API value", () => {
  assert.deepEqual(brandedFilter(), []);
  assert.deepEqual(brandedFilter("branded"), [
    { dimension: "brandedClassification", operator: "equals", expression: "BRANDED" },
  ]);
  assert.equal(brandedFilter("non_branded")[0].expression, "NON_BRANDED");
});

test("normaliseFilters: upper-cases brand values and accepts spellings", () => {
  const out = normaliseFilters([
    { dimension: "brandedClassification", operator: "equals", expression: "non-branded" },
    { dimension: "page", operator: "contains", expression: "/ratgeber/" },
  ]);
  assert.equal(out[0].expression, "NON_BRANDED");
  assert.equal(out[1].expression, "/ratgeber/");
});

test("normaliseFilters: enforces the API rules", () => {
  assert.throws(
    () => normaliseFilters([{ dimension: "brandedClassification", operator: "contains", expression: "BRANDED" }]),
    /equals/
  );
  assert.throws(
    () => normaliseFilters([{ dimension: "brandedClassification", operator: "equals", expression: "maybe" }]),
    /BRANDED or NON_BRANDED/
  );
  assert.throws(
    () =>
      normaliseFilters([
        { dimension: "brandedClassification", operator: "equals", expression: "BRANDED" },
        { dimension: "query", operator: "contains", expression: "x" },
      ]),
    /query filter/
  );
  assert.throws(
    () =>
      normaliseFilters(
        [{ dimension: "country", operator: "equals", expression: "deu" }],
        [{ dimension: "country", expressions: ["aut"] }]
      ),
    /both as a filter and as a list/
  );
  assert.throws(
    () => normaliseFilters([{ dimension: "brandedClassification", operator: "equals", expression: "BRANDED" }], [], "discover"),
    /no queries/
  );
});

test("deviceCountryLists: builds filterLists and validates codes", () => {
  assert.deepEqual(deviceCountryLists(["mobile", "TABLET", "MOBILE"], ["DEU", "aut", "che"]), [
    { dimension: "device", expressions: ["MOBILE", "TABLET"] },
    { dimension: "country", expressions: ["deu", "aut", "che"] },
  ]);
  assert.deepEqual(deviceCountryLists(), []);
  assert.throws(() => deviceCountryLists(["WATCH"]), /Unknown device/);
  assert.throws(() => deviceCountryLists([], ["de"]), /alpha-3/);
  assert.throws(() => deviceCountryLists(["MOBILE"], [], "discover"), /no device/);
});

test("assertValidDimensions: brandedClassification on query surfaces only", () => {
  assert.doesNotThrow(() => assertValidDimensions("web", ["brandedClassification", "device"]));
  assert.doesNotThrow(() => assertValidDimensions("webMultimodal", ["query", "brandedClassification"]));
  assert.throws(() => assertValidDimensions("discover", ["brandedClassification"]), /not supported/);
});

test("brandedWindowNote: warns only before 2026-02-21", () => {
  assert.match(brandedWindowNote("2026-02-01"), /2026-02-21/);
  assert.equal(brandedWindowNote("2026-02-21"), null);
});

test("bucketOf: day, ISO week (Monday) and month", () => {
  assert.equal(bucketOf("2026-11-15", "day"), "2026-11-15");
  assert.equal(bucketOf("2026-11-15", "week"), "2026-11-09"); // Sunday -> Monday before
  assert.equal(bucketOf("2026-11-09", "week"), "2026-11-09");
  assert.equal(bucketOf("2026-11-15", "month"), "2026-11");
});

test("splitTotals: shares over classified traffic, remainder as unclassified", () => {
  const t = splitTotals(
    [row([], 1000, 20000, 8)],
    [row(["BRANDED"], 300, 1000, 1.2), row(["NON_BRANDED"], 600, 18000, 9)]
  );
  assert.equal(t.branded.clickShare, 33.33);
  assert.equal(t.nonBranded.clickShare, 66.67);
  assert.equal(t.branded.ctr, 30);
  assert.deepEqual(t.unclassified, { clicks: 100, impressions: 1000 });
  assert.equal(t.property.position, 8);
});

test("splitTotals: an unclassified property yields zero shares, not NaN", () => {
  const t = splitTotals([row([], 50, 900)], []);
  assert.equal(t.branded.clickShare, 0);
  assert.equal(t.nonBranded.impressions, 0);
  assert.equal(t.unclassified.clicks, 50);
});

test("buildSeries: groups days into weeks with impression-weighted position", () => {
  const rows = [
    row(["2026-11-09", "BRANDED"], 10, 20, 1),
    row(["2026-11-10", "BRANDED"], 30, 60, 3),
    row(["2026-11-09", "NON_BRANDED"], 60, 1000, 10),
    row(["2026-11-16", "BRANDED"], 5, 10, 2),
  ];
  const s = buildSeries(rows, "week");
  assert.equal(s.length, 2);
  assert.equal(s[0].bucket, "2026-11-09");
  assert.equal(s[0].startDate, "2026-11-09");
  assert.equal(s[0].endDate, "2026-11-10");
  assert.equal(s[0].branded.clicks, 40);
  assert.equal(s[0].branded.position, 2.5); // (1*20 + 3*60) / 80
  assert.equal(s[0].brandedClickShare, 40);
  assert.equal(s[1].nonBranded.clicks, 0);
  assert.equal(s[1].brandedClickShare, 100);
});
