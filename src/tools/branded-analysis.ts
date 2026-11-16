import {
  fetchAllRows,
  resolveDateRange,
  precedingDateRange,
  SearchAnalyticsRow,
  SearchType,
  DataState,
  DateRange,
  ALLOWED_DIMENSIONS,
  BRANDED_CAVEAT,
  BRANDED_DATA_START,
  brandedFilter,
  brandedWindowNote,
  deviceCountryLists,
  DimensionFilter,
  FilterList,
  normaliseFilters,
} from "../analytics.js";

/**
 * Branded vs. non-branded split of a property (Search Analytics API update
 * 2026-11, dimension brandedClassification).
 *
 * Google classifies each query itself; this tool only reads that split. It
 * answers: how much of the search traffic comes from people who already know
 * the brand, how that share moves over time, and which queries sit on each
 * side. The property total is fetched separately, so the part no query row
 * explains (anonymized queries) stays visible instead of silently vanishing.
 */

export type BrandedGranularity = "none" | "day" | "week" | "month";

interface Metrics {
  clicks: number;
  impressions: number;
  /** Percent, two decimals. */
  ctr: number;
  /** Impression-weighted average position, one decimal. */
  position: number;
}

interface SplitTotals {
  property: Metrics;
  branded: Metrics & { clickShare: number; impressionShare: number };
  nonBranded: Metrics & { clickShare: number; impressionShare: number };
  /** Property total minus both classes: queries without a classification, mostly anonymized ones. */
  unclassified: { clicks: number; impressions: number };
}

interface SeriesPoint {
  bucket: string;
  startDate: string;
  endDate: string;
  branded: Metrics;
  nonBranded: Metrics;
  /** Branded share of classified clicks in this bucket, percent. */
  brandedClickShare: number;
}

interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface BrandedAnalysisResult {
  period: DateRange;
  eligible: boolean;
  current: SplitTotals;
  previous: { period: DateRange; totals: SplitTotals } | null;
  change: {
    brandedClicks: number;
    brandedClicksPercent: number | null;
    nonBrandedClicks: number;
    nonBrandedClicksPercent: number | null;
    brandedClickSharePoints: number;
  } | null;
  series: SeriesPoint[] | null;
  topQueries: { branded: QueryRow[]; nonBranded: QueryRow[] } | null;
  scope: {
    searchType: SearchType;
    urlContains: string | null;
    filterLists: FilterList[];
    dataState: DataState;
  };
  notes: string[];
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

function aggregate(rows: SearchAnalyticsRow[]): Metrics {
  let clicks = 0;
  let impressions = 0;
  let posWeight = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    // Row positions are already impression-weighted, so weighting by
    // impressions reproduces the true average across rows.
    posWeight += r.position * r.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? round((clicks / impressions) * 100, 2) : 0,
    position: impressions > 0 ? round(posWeight / impressions, 1) : 0,
  };
}

const share = (part: number, whole: number) => (whole > 0 ? round((part / whole) * 100, 2) : 0);

/** Splits rows whose key at `idx` is the brandedClassification value. */
function bySide(rows: SearchAnalyticsRow[], idx: number) {
  return {
    branded: rows.filter((r) => r.keys[idx] === "BRANDED"),
    nonBranded: rows.filter((r) => r.keys[idx] === "NON_BRANDED"),
  };
}

/** Bucket key for a YYYY-MM-DD date: the day, the ISO week's Monday, or the month. */
export function bucketOf(date: string, granularity: Exclude<BrandedGranularity, "none">): string {
  if (granularity === "day") return date;
  if (granularity === "month") return date.slice(0, 7);
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - mondayOffset);
  return day.toISOString().split("T")[0];
}

/**
 * Builds the series from rows grouped by [date, brandedClassification].
 * Buckets are clipped to the window, so a partial first or last week/month
 * says so through its startDate/endDate.
 */
export function buildSeries(
  rows: SearchAnalyticsRow[],
  granularity: Exclude<BrandedGranularity, "none">
): SeriesPoint[] {
  const buckets = new Map<string, { dates: string[]; rows: SearchAnalyticsRow[] }>();
  for (const r of rows) {
    const date = r.keys[0];
    const key = bucketOf(date, granularity);
    const b = buckets.get(key) || { dates: [], rows: [] };
    b.dates.push(date);
    b.rows.push(r);
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bucket, b]) => {
      const sides = bySide(b.rows, 1);
      const branded = aggregate(sides.branded);
      const nonBranded = aggregate(sides.nonBranded);
      const dates = [...b.dates].sort();
      return {
        bucket,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        branded,
        nonBranded,
        brandedClickShare: share(branded.clicks, branded.clicks + nonBranded.clicks),
      };
    });
}

/** Combines the property total and the two classes into one totals block. */
export function splitTotals(propertyRows: SearchAnalyticsRow[], splitRows: SearchAnalyticsRow[]): SplitTotals {
  const property = aggregate(propertyRows);
  const sides = bySide(splitRows, 0);
  const branded = aggregate(sides.branded);
  const nonBranded = aggregate(sides.nonBranded);
  const classifiedClicks = branded.clicks + nonBranded.clicks;
  const classifiedImpressions = branded.impressions + nonBranded.impressions;
  return {
    property,
    branded: {
      ...branded,
      clickShare: share(branded.clicks, classifiedClicks),
      impressionShare: share(branded.impressions, classifiedImpressions),
    },
    nonBranded: {
      ...nonBranded,
      clickShare: share(nonBranded.clicks, classifiedClicks),
      impressionShare: share(nonBranded.impressions, classifiedImpressions),
    },
    unclassified: {
      clicks: Math.max(0, property.clicks - classifiedClicks),
      impressions: Math.max(0, property.impressions - classifiedImpressions),
    },
  };
}

const pctChange = (now: number, before: number) =>
  before > 0 ? round(((now - before) / before) * 100, 2) : null;

export async function brandedAnalysis(options: {
  days?: number;
  startDate?: string;
  endDate?: string;
  comparePrevious?: boolean;
  granularity?: BrandedGranularity;
  topQueries?: number;
  urlContains?: string;
  searchType?: SearchType;
  devices?: string[];
  countries?: string[];
  dataState?: DataState;
} = {}): Promise<BrandedAnalysisResult> {
  const {
    days = 28,
    startDate,
    endDate,
    comparePrevious = true,
    granularity = "none",
    topQueries = 10,
    urlContains,
    searchType = "web",
    devices = [],
    countries = [],
    dataState = "all",
  } = options;

  if (!ALLOWED_DIMENSIONS[searchType].includes("brandedClassification")) {
    throw new Error(
      `searchType "${searchType}" has no queries and therefore no branded split. ` +
        `Use web, image, video, news or webMultimodal.`
    );
  }

  const period = resolveDateRange(days, startDate, endDate);
  if (granularity === "day" && period.days > 400) {
    throw new Error(`granularity "day" over ${period.days} days is too long; use week or month.`);
  }

  const filterLists = deviceCountryLists(devices, countries, searchType);
  const baseFilters: DimensionFilter[] = urlContains
    ? [{ dimension: "page", operator: "contains", expression: urlContains }]
    : [];
  normaliseFilters(baseFilters, filterLists, searchType);

  const groups = (extra: DimensionFilter[] = []) => {
    const filters = normaliseFilters([...baseFilters, ...extra], filterLists, searchType);
    return filters.length > 0 || filterLists.length > 0
      ? [{ filters, ...(filterLists.length > 0 ? { filterLists } : {}) }]
      : undefined;
  };

  const fetchTotals = async (range: DateRange): Promise<SplitTotals> => {
    const [propertyRows, splitRows] = await Promise.all([
      fetchAllRows({
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: [],
        type: searchType,
        dimensionFilterGroups: groups(),
        dataState,
      }),
      fetchAllRows({
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ["brandedClassification"],
        type: searchType,
        dimensionFilterGroups: groups(),
        dataState,
      }),
    ]);
    return splitTotals(propertyRows, splitRows);
  };

  const fetchTop = async (side: "branded" | "non_branded"): Promise<QueryRow[]> => {
    const rows = await fetchAllRows({
      startDate: period.startDate,
      endDate: period.endDate,
      dimensions: ["query"],
      type: searchType,
      dimensionFilterGroups: groups(brandedFilter(side)),
      dataState,
      rowLimit: topQueries,
      maxRows: topQueries,
    });
    return rows
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .map((r) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: round(r.ctr * 100, 2),
        position: round(r.position, 1),
      }));
  };

  const previousRange = comparePrevious ? precedingDateRange(period) : null;

  const [current, previousTotals, seriesRows, topBranded, topNonBranded] = await Promise.all([
    fetchTotals(period),
    previousRange ? fetchTotals(previousRange) : Promise.resolve(null),
    granularity !== "none"
      ? fetchAllRows({
          startDate: period.startDate,
          endDate: period.endDate,
          dimensions: ["date", "brandedClassification"],
          type: searchType,
          dimensionFilterGroups: groups(),
          dataState,
        })
      : Promise.resolve(null),
    topQueries > 0 ? fetchTop("branded") : Promise.resolve(null),
    topQueries > 0 ? fetchTop("non_branded") : Promise.resolve(null),
  ]);

  const eligible = current.branded.impressions + current.nonBranded.impressions > 0;

  const notes = [BRANDED_CAVEAT];
  const windowNote = brandedWindowNote(period.startDate);
  if (windowNote) notes.push(windowNote);
  if (previousRange && previousRange.startDate < BRANDED_DATA_START) {
    notes.push(
      `The comparison window ${previousRange.startDate} to ${previousRange.endDate} starts before ` +
        `${BRANDED_DATA_START}; its branded/non-branded figures are incomplete, so the change is not a like-for-like comparison.`
    );
  }
  if (!eligible) {
    notes.push(
      current.property.impressions > 0
        ? "The property has traffic in this window, but no query carries a brand classification. " +
            "Most likely the property is not eligible (not top-level, or too little query volume). " +
            "This is not evidence of zero brand traffic."
        : "The property has no traffic in this window under the chosen filters."
    );
  }

  let change: BrandedAnalysisResult["change"] = null;
  if (previousTotals) {
    const p = previousTotals;
    change = {
      brandedClicks: current.branded.clicks - p.branded.clicks,
      brandedClicksPercent: pctChange(current.branded.clicks, p.branded.clicks),
      nonBrandedClicks: current.nonBranded.clicks - p.nonBranded.clicks,
      nonBrandedClicksPercent: pctChange(current.nonBranded.clicks, p.nonBranded.clicks),
      brandedClickSharePoints: round(current.branded.clickShare - p.branded.clickShare, 2),
    };
  }

  return {
    period,
    eligible,
    current,
    previous: previousRange && previousTotals ? { period: previousRange, totals: previousTotals } : null,
    change,
    series: seriesRows && granularity !== "none" ? buildSeries(seriesRows, granularity) : null,
    topQueries:
      topBranded && topNonBranded ? { branded: topBranded, nonBranded: topNonBranded } : null,
    scope: {
      searchType,
      urlContains: urlContains ?? null,
      filterLists,
      dataState,
    },
    notes,
  };
}
