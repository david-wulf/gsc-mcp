import { getSearchConsoleClient, getConfig } from "./auth.js";

/**
 * GSC search types. The API defaults to "web" when type is omitted, which is
 * why every legacy tool only ever sees web data. Set this explicitly to query
 * Discover, Image, Video or News surfaces in isolation.
 */
export type SearchType = "web" | "image" | "video" | "news" | "discover" | "googleNews";

/**
 * Dimensions the API actually allows per surface. Used for a friendly guard so
 * an invalid combination fails with a clear message instead of an opaque 400.
 * (searchAppearance is special: it must be the ONLY grouping dimension.)
 */
export const ALLOWED_DIMENSIONS: Record<SearchType, string[]> = {
  web: ["query", "page", "country", "device", "date", "searchAppearance"],
  image: ["query", "page", "country", "device", "date", "searchAppearance"],
  video: ["query", "page", "country", "device", "date", "searchAppearance"],
  news: ["query", "page", "country", "device", "date"],
  // Discover is not query-based: no "query", no "device".
  discover: ["page", "country", "date", "searchAppearance"],
  googleNews: ["page", "country", "date"],
};

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface QueryParams {
  startDate: string;
  endDate: string;
  dimensions: string[];
  /** Surface to query. Omit for "web" (the API default). */
  searchType?: SearchType;
  dimensionFilterGroups?: Array<{
    filters: Array<{
      dimension: string;
      operator: string;
      expression: string;
    }>;
  }>;
  rowLimit?: number;
  /** Hard cap on rows fetched across all pages. Omit for no cap. */
  maxRows?: number;
}

/**
 * Validates that the requested dimensions are legal for the chosen surface.
 * Throws a descriptive error instead of letting the API return a generic 400.
 */
export function assertValidDimensions(searchType: SearchType, dimensions: string[]): void {
  const allowed = ALLOWED_DIMENSIONS[searchType];
  const invalid = dimensions.filter((d) => !allowed.includes(d));
  if (invalid.length > 0) {
    throw new Error(
      `Dimension(s) [${invalid.join(", ")}] are not supported for searchType "${searchType}". ` +
        `Allowed: [${allowed.join(", ")}].`
    );
  }
  if (dimensions.includes("searchAppearance") && dimensions.length > 1) {
    throw new Error(
      `"searchAppearance" must be the only grouping dimension. ` +
        `To break a single appearance down by page/query, filter on searchAppearance instead.`
    );
  }
}

/**
 * CTR-Erwartung pro Position.
 *
 * Die Studientabelle unten stammt aus einer branchenweiten Auswertung fremder
 * Seiten. Sie ist nur der Rueckfall: gemessen an einer Content-Property liegt die
 * echte CTR auf Position 1 bei 3,5 % gegen die 28,5 % der Tabelle - Faktor 8. Wer
 * dagegen bewertet, stempelt fast jede Seite als unterdurchschnittlich und sagt
 * damit etwas ueber die Studie, nicht ueber die Seite.
 *
 * Deshalb bauen die Tools ihre Kurve aus den Zeilen, die sie ohnehin schon geholt
 * haben, und greifen nur dann auf die Tabelle zurueck, wenn ein Rang zu wenig
 * Volumen fuer eine belastbare Messung hat.
 */
export const STUDY_CTR_BY_POSITION = [
  0.285, 0.157, 0.11, 0.08, 0.072, 0.051, 0.04, 0.032, 0.028, 0.025,
];

export function studyCtrAt(position: number): number {
  if (position <= 0) return STUDY_CTR_BY_POSITION[0];
  if (position <= 10) return STUDY_CTR_BY_POSITION[Math.floor(position) - 1];
  return Math.max(0.005, 0.025 - (position - 10) * 0.002);
}

export type CtrSource = "measured" | "study";

export interface ClickCurve {
  /** Rang -> gemessene CTR als Anteil (0-1). */
  byRank: Map<number, number>;
  /** Woraus die Kurve gebaut wurde, damit das Ergebnis einordbar bleibt. */
  basis: string;
  ranksMeasured: number;
  impressionsConsidered: number;
}

/**
 * Baut die CTR-pro-Rang-Kurve aus bereits geholten Zeilen.
 *
 * CTR je Rang ist Summe der Klicks durch Summe der Impressionen, nie ein Mittel
 * aus Verhaeltnissen - sonst zaehlt eine Zeile mit drei Impressionen so viel wie
 * eine mit dreissigtausend. Auf ungefilterten Zeilen aufrufen: baut man die Kurve
 * erst nach einem Impressionsfilter, ist sie nach oben verzerrt.
 */
export function buildClickCurve(
  rows: SearchAnalyticsRow[],
  basis: string,
  minImpressionsPerRank: number = 100
): ClickCurve {
  const buckets = new Map<number, { clicks: number; impressions: number }>();
  let impressionsConsidered = 0;

  for (const row of rows) {
    if (!row.impressions) continue;
    const rank = Math.max(1, Math.round(row.position));
    const bucket = buckets.get(rank) || { clicks: 0, impressions: 0 };
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    buckets.set(rank, bucket);
    impressionsConsidered += row.impressions;
  }

  const byRank = new Map<number, number>();
  for (const [rank, bucket] of buckets) {
    if (bucket.impressions < minImpressionsPerRank) continue;
    byRank.set(rank, bucket.clicks / bucket.impressions);
  }

  return { byRank, basis, ranksMeasured: byRank.size, impressionsConsidered };
}

/** Gemessene CTR fuer diesen Rang, sonst die Studientabelle. */
export function expectedCtr(
  position: number,
  curve?: ClickCurve
): { ctr: number; source: CtrSource } {
  const rank = Math.max(1, Math.round(position));
  const measured = curve?.byRank.get(rank);
  if (measured !== undefined) return { ctr: measured, source: "measured" };
  return { ctr: studyCtrAt(position), source: "study" };
}

/** Devices as the API spells them in dimension filters. */
export const DEVICES = ["MOBILE", "DESKTOP", "TABLET"] as const;
export type Device = (typeof DEVICES)[number];

/**
 * Dimension filters for device and country.
 *
 * Both are optional, and unset means unfiltered - every tool keeps returning
 * all devices and all countries unless asked otherwise.
 *
 * Discover has no device dimension (see ALLOWED_DIMENSIONS), so filtering by
 * device there is impossible rather than merely empty. That fails loudly.
 */
export function deviceCountryFilters(
  device?: string,
  country?: string,
  searchType: SearchType = "web"
): Array<{ dimension: string; operator: string; expression: string }> {
  const filters: Array<{ dimension: string; operator: string; expression: string }> = [];

  if (device) {
    if (!ALLOWED_DIMENSIONS[searchType].includes("device")) {
      throw new Error(
        `searchType "${searchType}" has no device dimension, so it cannot be filtered by device. ` +
          `Allowed dimensions: [${ALLOWED_DIMENSIONS[searchType].join(", ")}].`
      );
    }
    const upper = device.toUpperCase() as Device;
    if (!DEVICES.includes(upper)) {
      throw new Error(`Unknown device "${device}". Allowed: ${DEVICES.join(", ")}.`);
    }
    filters.push({ dimension: "device", operator: "equals", expression: upper });
  }

  if (country) {
    const lower = country.toLowerCase();
    if (!/^[a-z]{3}$/.test(lower)) {
      throw new Error(
        `Country must be an ISO-3166-1 alpha-3 code such as deu, aut, che or usa - got "${country}".`
      );
    }
    filters.push({ dimension: "country", operator: "equals", expression: lower });
  }

  return filters;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1); // yesterday (latest available)
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

export function getPriorDateRange(days: number): { startDate: string; endDate: string } {
  const currentEnd = new Date();
  currentEnd.setDate(currentEnd.getDate() - 1);
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - days + 1);

  const priorEnd = new Date(currentStart);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - days + 1);

  return {
    startDate: formatDate(priorStart),
    endDate: formatDate(priorEnd),
  };
}

/**
 * Fetches all rows from the Search Analytics API with automatic pagination.
 * Uses dataState: 'all' so data matches the GSC dashboard exactly.
 */
export async function fetchAllRows(params: QueryParams, siteUrlOverride?: string): Promise<SearchAnalyticsRow[]> {
  const client = await getSearchConsoleClient();
  const siteUrl = siteUrlOverride || getConfig().siteUrl;
  const allRows: SearchAnalyticsRow[] = [];
  const pageSize = params.rowLimit || 25000;
  let startRow = 0;

  while (true) {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: params.dimensions,
        type: params.searchType, // undefined => API default "web"
        dimensionFilterGroups: params.dimensionFilterGroups,
        rowLimit: pageSize,
        startRow,
        dataState: "all",
      },
    });

    const rows = response.data.rows;
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      allRows.push({
        keys: row.keys || [],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      });
    }

    if (rows.length < pageSize) break;
    if (params.maxRows && allRows.length >= params.maxRows) break;
    startRow += pageSize;
  }

  return params.maxRows ? allRows.slice(0, params.maxRows) : allRows;
}
