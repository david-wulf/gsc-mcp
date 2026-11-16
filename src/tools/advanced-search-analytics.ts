import {
  fetchAllRows,
  resolveDateRange,
  SearchAnalyticsRow,
  SearchType,
  DataState,
  assertValidDimensions,
  BrandedChoice,
  BRANDED_CAVEAT,
  brandedFilter,
  brandedWindowNote,
  deviceCountryLists,
  FilterList,
  normaliseFilters,
} from "../analytics.js";

interface Filter {
  dimension: string;
  operator: string;
  expression: string;
}

/** Set when the request touches brandedClassification. */
interface BrandedInfo {
  caveat: string;
  windowNote: string | null;
  /** True when a branded query matched nothing: likely an ineligible property. */
  emptyResult: boolean;
}

/** Most rows a single call returns. Larger lists are read page by page with start_row. */
export const MAX_PAGE_SIZE = 500;

interface OutputRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface AdvancedSearchResult {
  rows: OutputRow[];
  /** Rows the whole query matched, across all pages. */
  totalRows: number;
  /** Zero-based offset of the first returned row within totalRows. */
  startRow: number;
  returnedRows: number;
  hasMore: boolean;
  /** Pass this as start_row to get the next page; null on the last page. */
  nextStartRow: number | null;
  /** Set when row_limit was above MAX_PAGE_SIZE and got lowered. */
  rowLimitCapped: string | null;
  dimensions: string[];
  period: { startDate: string; endDate: string; days: number };
  dataState: DataState;
  filtersApplied: Filter[];
  filterListsApplied: FilterList[];
  searchType: string;
  branded: BrandedInfo | null;
}

export interface AdvancedSearchOptions {
  days?: number;
  startDate?: string;
  endDate?: string;
  dimensions?: string[];
  filters?: Filter[];
  rowLimit?: number;
  startRow?: number;
  orderBy?: string;
  orderDirection?: string;
  searchType?: SearchType;
  dataState?: DataState;
  /** Shortcut for a brandedClassification filter. */
  branded?: BrandedChoice;
  /** Several devices in one request (filterLists). */
  devices?: string[];
  /** Several countries in one request (filterLists), ISO alpha-3. */
  countries?: string[];
}

export interface Page {
  rows: SearchAnalyticsRow[];
  totalRows: number;
  startRow: number;
  hasMore: boolean;
  nextStartRow: number | null;
  rowLimit: number;
  rowLimitCapped: string | null;
}

/**
 * Sorts all rows and cuts out one page. The order is total — ties on the sort
 * metric fall back to the row keys — so consecutive start_row calls page
 * through one fixed list: no row appears twice, none goes missing.
 */
export function sortAndPage(
  rows: SearchAnalyticsRow[],
  orderBy: string = "clicks",
  orderDirection: string = "descending",
  startRow: number = 0,
  rowLimit: number = 100
): Page {
  const sortKey = orderBy as keyof SearchAnalyticsRow;
  const multiplier = orderDirection === "ascending" ? 1 : -1;
  const value = (r: SearchAnalyticsRow) =>
    typeof r[sortKey] === "number" ? (r[sortKey] as number) : 0;
  const tieKey = (r: SearchAnalyticsRow) => r.keys.join("\u0000");
  const sorted = [...rows].sort((a, b) => {
    const diff = (value(a) - value(b)) * multiplier;
    if (diff !== 0) return diff;
    const ka = tieKey(a);
    const kb = tieKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const requested = Math.max(1, Math.floor(rowLimit));
  const limit = Math.min(requested, MAX_PAGE_SIZE);
  const offset = Math.max(0, Math.floor(startRow));
  const page = sorted.slice(offset, offset + limit);
  const end = offset + page.length;
  const hasMore = end < sorted.length;

  return {
    rows: page,
    totalRows: sorted.length,
    startRow: offset,
    hasMore,
    nextStartRow: hasMore ? end : null,
    rowLimit: limit,
    rowLimitCapped:
      requested > MAX_PAGE_SIZE
        ? `row_limit ${requested} lowered to ${MAX_PAGE_SIZE}, the most one call returns. Page on with start_row.`
        : null,
  };
}

export async function advancedSearchAnalytics(
  options: AdvancedSearchOptions = {}
): Promise<AdvancedSearchResult> {
  const {
    days = 28,
    startDate: requestedStart,
    endDate: requestedEnd,
    dimensions = ["query"],
    filters = [],
    rowLimit = 100,
    startRow = 0,
    orderBy = "clicks",
    orderDirection = "descending",
    searchType = "web",
    dataState = "all",
    branded,
    devices = [],
    countries = [],
  } = options;

  assertValidDimensions(searchType, dimensions);

  const period = resolveDateRange(days, requestedStart, requestedEnd);

  if (branded && filters.some((f) => f.dimension === "brandedClassification")) {
    throw new Error("Use either branded or a brandedClassification filter, not both.");
  }
  const filterLists = deviceCountryLists(devices, countries, searchType);
  const allFilters = normaliseFilters(
    [...filters, ...brandedFilter(branded)].map((f) => ({
      dimension: f.dimension,
      operator: f.operator,
      expression: f.expression,
    })),
    filterLists,
    searchType
  );

  const dimensionFilterGroups =
    allFilters.length > 0 || filterLists.length > 0
      ? [
          {
            filters: allFilters,
            ...(filterLists.length > 0 ? { filterLists } : {}),
          },
        ]
      : undefined;

  const usesBranded =
    dimensions.includes("brandedClassification") ||
    allFilters.some((f) => f.dimension === "brandedClassification");

  // The API pages internally (25k rows per request); every call fetches the
  // full list so sorting and paging run over all rows, not over the first page.
  const rows = await fetchAllRows({
    startDate: period.startDate,
    endDate: period.endDate,
    dimensions,
    type: searchType,
    dimensionFilterGroups,
    dataState,
  });

  const page = sortAndPage(rows, orderBy, orderDirection, startRow, rowLimit);

  return {
    rows: page.rows.map((r) => ({
      keys: r.keys,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 10000) / 100,
      position: Math.round(r.position * 10) / 10,
    })),
    totalRows: page.totalRows,
    startRow: page.startRow,
    returnedRows: page.rows.length,
    hasMore: page.hasMore,
    nextStartRow: page.nextStartRow,
    rowLimitCapped: page.rowLimitCapped,
    dimensions,
    period,
    dataState,
    filtersApplied: allFilters,
    filterListsApplied: filterLists,
    searchType: searchType || "web",
    branded: usesBranded
      ? {
          caveat: BRANDED_CAVEAT,
          windowNote: brandedWindowNote(period.startDate),
          emptyResult: rows.length === 0,
        }
      : null,
  };
}
