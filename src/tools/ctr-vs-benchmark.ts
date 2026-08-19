import {
  fetchAllRows,
  getDateRange,
  SearchType,
  assertValidDimensions,
  buildClickCurve,
  expectedCtr,
  CtrSource,
} from "../analytics.js";

interface CtrBenchmarkResult {
  page: string;
  clicks: number;
  impressions: number;
  actualCtr: number;
  position: number;
  benchmarkCtr: number;
  /** Woher der Vergleichswert kam: aus der eigenen Kurve oder aus der Studientabelle. */
  benchmarkSource: CtrSource;
  gap: number;
  verdict: string;
}

export async function ctrVsBenchmark(
  days: number = 28,
  minImpressions: number = 200,
  searchType: SearchType = "web"
): Promise<CtrBenchmarkResult[]> {
  assertValidDimensions(searchType, ["page"]);
  const { startDate, endDate } = getDateRange(days);

  const rows = await fetchAllRows({
    startDate,
    endDate,
    dimensions: ["page"],
    searchType,
  });

  // Kurve auf den ungefilterten Zeilen bauen, sonst ist sie nach oben verzerrt.
  const curve = buildClickCurve(rows, "page rows of this request");

  const results: CtrBenchmarkResult[] = [];

  for (const row of rows) {
    if (row.impressions < minImpressions) continue;
    if (row.position > 20) continue;

    const expectation = expectedCtr(row.position, curve);
    const benchmark = expectation.ctr;
    const gap = row.ctr - benchmark;
    const gapPercent = Math.round(gap * 10000) / 100;

    let verdict: string;
    if (gap >= 0.02) {
      verdict = "Above benchmark";
    } else if (gap >= -0.02) {
      verdict = "At benchmark";
    } else if (gap >= -0.05) {
      verdict = "Below benchmark — review title and meta description";
    } else {
      verdict = "Significantly below benchmark — likely needs title/description rewrite or rich snippet work";
    }

    results.push({
      page: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      actualCtr: Math.round(row.ctr * 10000) / 100,
      position: Math.round(row.position * 10) / 10,
      benchmarkCtr: Math.round(benchmark * 10000) / 100,
      benchmarkSource: expectation.source,
      gap: gapPercent,
      verdict,
    });
  }

  // Sort by gap ascending (worst performers first)
  results.sort((a, b) => a.gap - b.gap);
  return results.slice(0, 50);
}
