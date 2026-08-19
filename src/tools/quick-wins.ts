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

interface QuickWin {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  opportunity: number;
  /** Woher die Ziel-CTR kam: aus der eigenen Kurve oder aus der Studientabelle. */
  targetCtrSource: CtrSource;
}

export async function quickWins(
  days: number = 28,
  minImpressions: number = 100,
  maxPosition: number = 15,
  searchType: SearchType = "web",
  device?: string,
  country?: string
): Promise<QuickWin[]> {
  assertValidDimensions(searchType, ["query"]);
  const { startDate, endDate } = getDateRange(days);
  const extra = deviceCountryFilters(device, country, searchType);
  const dimensionFilterGroups = extra.length ? [{ filters: extra }] : undefined;

  const rows = await fetchAllRows({
    dimensionFilterGroups,
    startDate,
    endDate,
    dimensions: ["query"],
    searchType,
  });

  // Kurve auf den ungefilterten Zeilen bauen, sonst ist sie nach oben verzerrt.
  const curve = buildClickCurve(rows, "query rows of this request");

  const wins: QuickWin[] = [];

  for (const row of rows) {
    const position = row.position;
    const impressions = row.impressions;

    if (position < 4 || position > maxPosition) continue;
    if (impressions < minImpressions) continue;

    // Opportunity = impressions * (CTR auf Position 3 - aktuelle CTR)
    const target = expectedCtr(3, curve);
    const currentCtr = row.ctr;
    const opportunity = Math.round(impressions * Math.max(0, target.ctr - currentCtr));

    wins.push({
      query: row.keys[0],
      clicks: row.clicks,
      impressions,
      ctr: Math.round(row.ctr * 10000) / 100,
      position: Math.round(position * 10) / 10,
      opportunity,
      targetCtrSource: target.source,
    });
  }

  wins.sort((a, b) => b.opportunity - a.opportunity);
  return wins.slice(0, 50);
}
