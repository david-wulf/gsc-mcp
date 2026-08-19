import {
  fetchAllRows,
  getDateRange,
  SearchType,
  assertValidDimensions,
  deviceCountryFilters,
  buildClickCurve,
  expectedCtr,
  CtrSource,
} from "../analytics.js";

interface CtrOpportunity {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  expectedCtr: number;
  ctrGap: number;
  potentialExtraClicks: number;
  /** Woher die Erwartung kam: aus der eigenen Kurve oder aus der Studientabelle. */
  expectedCtrSource: CtrSource;
}

export async function ctrOpportunities(
  days: number = 28,
  minImpressions: number = 500,
  searchType: SearchType = "web",
  device?: string,
  country?: string
): Promise<CtrOpportunity[]> {
  assertValidDimensions(searchType, ["page"]);
  const { startDate, endDate } = getDateRange(days);
  const extra = deviceCountryFilters(device, country, searchType);
  const dimensionFilterGroups = extra.length ? [{ filters: extra }] : undefined;

  const rows = await fetchAllRows({
    dimensionFilterGroups,
    startDate,
    endDate,
    dimensions: ["page"],
    searchType,
  });

  // Kurve auf den ungefilterten Zeilen bauen, sonst ist sie nach oben verzerrt.
  const curve = buildClickCurve(rows, "page rows of this request");

  const opportunities: CtrOpportunity[] = [];

  for (const row of rows) {
    if (row.impressions < minImpressions) continue;
    if (row.position > 20) continue; // only care about pages that rank somewhat

    const expectation = expectedCtr(row.position, curve);
    const expected = expectation.ctr;
    const gap = expected - row.ctr;

    if (gap <= 0.01) continue; // CTR is at or above benchmark

    opportunities.push({
      page: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100,
      position: Math.round(row.position * 10) / 10,
      expectedCtr: Math.round(expected * 10000) / 100,
      expectedCtrSource: expectation.source,
      ctrGap: Math.round(gap * 10000) / 100,
      potentialExtraClicks: Math.round(row.impressions * gap),
    });
  }

  opportunities.sort((a, b) => b.potentialExtraClicks - a.potentialExtraClicks);
  return opportunities.slice(0, 50);
}
