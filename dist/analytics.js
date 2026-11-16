"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVICES = exports.STUDY_CTR_BY_POSITION = exports.BRANDED_CAVEAT = exports.BRANDED_VALUES = exports.BRANDED_DATA_START = exports.ALLOWED_DIMENSIONS = void 0;
exports.brandedFilter = brandedFilter;
exports.normaliseFilters = normaliseFilters;
exports.deviceCountryLists = deviceCountryLists;
exports.brandedWindowNote = brandedWindowNote;
exports.assertValidDimensions = assertValidDimensions;
exports.studyCtrAt = studyCtrAt;
exports.buildClickCurve = buildClickCurve;
exports.expectedCtr = expectedCtr;
exports.deviceCountryFilters = deviceCountryFilters;
exports.getDateRange = getDateRange;
exports.resolveDateRange = resolveDateRange;
exports.precedingDateRange = precedingDateRange;
exports.getPriorDateRange = getPriorDateRange;
exports.fetchAllRows = fetchAllRows;
const auth_js_1 = require("./auth.js");
/**
 * Dimensions the API actually allows per surface. Used for a friendly guard so
 * an invalid combination fails with a clear message instead of an opaque 400.
 * (searchAppearance is special: it must be the ONLY grouping dimension.)
 *
 * webMultimodal (API update 2026-11): Google Lens, Circle to Search and image
 * uploads in Search. brandedClassification (same update) splits query-based
 * surfaces into BRANDED / NON_BRANDED; Discover and Google News carry no
 * queries, so they have no brand split either.
 */
exports.ALLOWED_DIMENSIONS = {
    web: ["query", "page", "country", "device", "date", "searchAppearance", "brandedClassification"],
    image: ["query", "page", "country", "device", "date", "searchAppearance", "brandedClassification"],
    video: ["query", "page", "country", "device", "date", "searchAppearance", "brandedClassification"],
    news: ["query", "page", "country", "device", "date", "brandedClassification"],
    webMultimodal: ["query", "page", "country", "device", "date", "searchAppearance", "brandedClassification"],
    // Discover is not query-based: no "query", no "device".
    discover: ["page", "country", "date", "searchAppearance"],
    googleNews: ["page", "country", "date"],
};
/**
 * Branded / non-branded classification (Search Analytics API update, 2026-11).
 * Google classifies each query itself; the values are BRANDED and NON_BRANDED.
 * Data exists from this day on, and only for eligible properties (top-level
 * properties with enough query volume). Other properties get no rows at all —
 * an empty answer there means "not classified", never "no brand traffic".
 */
exports.BRANDED_DATA_START = "2026-02-21";
exports.BRANDED_VALUES = ["BRANDED", "NON_BRANDED"];
exports.BRANDED_CAVEAT = `brandedClassification is Google's own classification, available from ${exports.BRANDED_DATA_START} ` +
    "and only for eligible properties (top-level, enough query volume). Ineligible properties return " +
    "no rows: zero rows means not classified, not zero brand traffic. Queries hidden for privacy " +
    "(anonymized) are not in the query rows, so branded + non-branded can be lower than the property total.";
/** Filter for one side of the brand split; undefined means both sides. */
function brandedFilter(branded) {
    if (!branded)
        return [];
    return [
        {
            dimension: "brandedClassification",
            operator: "equals",
            expression: branded === "branded" ? "BRANDED" : "NON_BRANDED",
        },
    ];
}
/**
 * Normalises and checks filters before they reach the API, so the rules of the
 * 2026-11 update fail with a clear message instead of an opaque 400:
 * - brandedClassification takes only `equals` with BRANDED or NON_BRANDED,
 * - it cannot be combined with a query filter in the same request,
 * - the same dimension may not appear in both filters and filterLists.
 * Returns the filters with brandedClassification values upper-cased.
 */
function normaliseFilters(filters, filterLists = [], searchType = "web") {
    const out = filters.map((f) => {
        if (f.dimension !== "brandedClassification")
            return f;
        if (!exports.ALLOWED_DIMENSIONS[searchType].includes("brandedClassification")) {
            throw new Error(`searchType "${searchType}" has no queries and therefore no brandedClassification.`);
        }
        if (f.operator !== "equals") {
            throw new Error(`brandedClassification only supports the operator "equals" (got "${f.operator}"). ` +
                `For the other side of the split, filter on the other value.`);
        }
        const value = f.expression.toUpperCase().replace(/[\s-]/g, "_");
        if (!exports.BRANDED_VALUES.includes(value)) {
            throw new Error(`brandedClassification must be BRANDED or NON_BRANDED, got "${f.expression}".`);
        }
        return { ...f, expression: value };
    });
    const hasBranded = out.some((f) => f.dimension === "brandedClassification");
    const hasQueryFilter = out.some((f) => f.dimension === "query");
    if (hasBranded && hasQueryFilter) {
        throw new Error("The API does not allow a brandedClassification filter together with a query filter. " +
            "Group by query instead and filter the rows, or drop one of the two filters.");
    }
    for (const list of filterLists) {
        if (out.some((f) => f.dimension === list.dimension)) {
            throw new Error(`"${list.dimension}" is used both as a filter and as a list. Use one of the two.`);
        }
    }
    return out;
}
/**
 * Builds filterLists for several devices and/or countries (API update
 * 2026-11). A single value works too; it is the same as an equals filter.
 */
function deviceCountryLists(devices = [], countries = [], searchType = "web") {
    const lists = [];
    if (devices.length > 0) {
        if (!exports.ALLOWED_DIMENSIONS[searchType].includes("device")) {
            throw new Error(`searchType "${searchType}" has no device dimension, so it cannot be filtered by device.`);
        }
        const upper = [...new Set(devices.map((d) => d.toUpperCase()))];
        const bad = upper.filter((d) => !exports.DEVICES.includes(d));
        if (bad.length > 0) {
            throw new Error(`Unknown device(s) ${bad.join(", ")}. Allowed: ${exports.DEVICES.join(", ")}.`);
        }
        lists.push({ dimension: "device", expressions: upper });
    }
    if (countries.length > 0) {
        const lower = [...new Set(countries.map((c) => c.toLowerCase()))];
        const bad = lower.filter((c) => !/^[a-z]{3}$/.test(c));
        if (bad.length > 0) {
            throw new Error(`Countries must be ISO-3166-1 alpha-3 codes such as deu, aut, che - got ${bad.join(", ")}.`);
        }
        lists.push({ dimension: "country", expressions: lower });
    }
    return lists;
}
/** Note for a response whose window starts before brand data exists. */
function brandedWindowNote(startDate) {
    return startDate < exports.BRANDED_DATA_START
        ? `The window starts ${startDate}, before brand data exists (${exports.BRANDED_DATA_START}). ` +
            `Days before ${exports.BRANDED_DATA_START} carry no brandedClassification, so they are missing from branded/non-branded figures.`
        : null;
}
/**
 * Validates that the requested dimensions are legal for the chosen surface.
 * Throws a descriptive error instead of letting the API return a generic 400.
 */
function assertValidDimensions(searchType, dimensions) {
    const allowed = exports.ALLOWED_DIMENSIONS[searchType];
    const invalid = dimensions.filter((d) => !allowed.includes(d));
    if (invalid.length > 0) {
        throw new Error(`Dimension(s) [${invalid.join(", ")}] are not supported for searchType "${searchType}". ` +
            `Allowed: [${allowed.join(", ")}].`);
    }
    if (dimensions.includes("searchAppearance") && dimensions.length > 1) {
        throw new Error(`"searchAppearance" must be the only grouping dimension. ` +
            `To break a single appearance down by page/query, filter on searchAppearance instead.`);
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
exports.STUDY_CTR_BY_POSITION = [
    0.285, 0.157, 0.11, 0.08, 0.072, 0.051, 0.04, 0.032, 0.028, 0.025,
];
function studyCtrAt(position) {
    if (position <= 0)
        return exports.STUDY_CTR_BY_POSITION[0];
    if (position <= 10)
        return exports.STUDY_CTR_BY_POSITION[Math.floor(position) - 1];
    return Math.max(0.005, 0.025 - (position - 10) * 0.002);
}
/**
 * Baut die CTR-pro-Rang-Kurve aus bereits geholten Zeilen.
 *
 * CTR je Rang ist Summe der Klicks durch Summe der Impressionen, nie ein Mittel
 * aus Verhaeltnissen - sonst zaehlt eine Zeile mit drei Impressionen so viel wie
 * eine mit dreissigtausend. Auf ungefilterten Zeilen aufrufen: baut man die Kurve
 * erst nach einem Impressionsfilter, ist sie nach oben verzerrt.
 */
function buildClickCurve(rows, basis, minImpressionsPerRank = 100) {
    const buckets = new Map();
    let impressionsConsidered = 0;
    for (const row of rows) {
        if (!row.impressions)
            continue;
        const rank = Math.max(1, Math.round(row.position));
        const bucket = buckets.get(rank) || { clicks: 0, impressions: 0 };
        bucket.clicks += row.clicks;
        bucket.impressions += row.impressions;
        buckets.set(rank, bucket);
        impressionsConsidered += row.impressions;
    }
    const byRank = new Map();
    for (const [rank, bucket] of buckets) {
        if (bucket.impressions < minImpressionsPerRank)
            continue;
        byRank.set(rank, bucket.clicks / bucket.impressions);
    }
    return { byRank, basis, ranksMeasured: byRank.size, impressionsConsidered };
}
/** Gemessene CTR fuer diesen Rang, sonst die Studientabelle. */
function expectedCtr(position, curve) {
    const rank = Math.max(1, Math.round(position));
    const measured = curve?.byRank.get(rank);
    if (measured !== undefined)
        return { ctr: measured, source: "measured" };
    return { ctr: studyCtrAt(position), source: "study" };
}
/** Devices as the API spells them in dimension filters. */
exports.DEVICES = ["MOBILE", "DESKTOP", "TABLET"];
/**
 * Dimension filters for device and country.
 *
 * Both are optional, and unset means unfiltered - every tool keeps returning
 * all devices and all countries unless asked otherwise.
 *
 * Discover has no device dimension (see ALLOWED_DIMENSIONS), so filtering by
 * device there is impossible rather than merely empty. That fails loudly.
 */
function deviceCountryFilters(device, country, searchType = "web") {
    const filters = [];
    if (device) {
        if (!exports.ALLOWED_DIMENSIONS[searchType].includes("device")) {
            throw new Error(`searchType "${searchType}" has no device dimension, so it cannot be filtered by device. ` +
                `Allowed dimensions: [${exports.ALLOWED_DIMENSIONS[searchType].join(", ")}].`);
        }
        const upper = device.toUpperCase();
        if (!exports.DEVICES.includes(upper)) {
            throw new Error(`Unknown device "${device}". Allowed: ${exports.DEVICES.join(", ")}.`);
        }
        filters.push({ dimension: "device", operator: "equals", expression: upper });
    }
    if (country) {
        const lower = country.toLowerCase();
        if (!/^[a-z]{3}$/.test(lower)) {
            throw new Error(`Country must be an ISO-3166-1 alpha-3 code such as deu, aut, che or usa - got "${country}".`);
        }
        filters.push({ dimension: "country", operator: "equals", expression: lower });
    }
    return filters;
}
function formatDate(date) {
    return date.toISOString().split("T")[0];
}
function getDateRange(days) {
    const end = new Date();
    end.setDate(end.getDate() - 1); // yesterday (latest available)
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
    };
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
function parseIsoDate(value, label) {
    if (!ISO_DATE.test(value)) {
        throw new Error(`${label} must be a date in YYYY-MM-DD format, got "${value}".`);
    }
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    // Date.UTC silently rolls 2026-02-30 over to March; reject that instead.
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
        throw new Error(`${label} "${value}" is not a valid calendar date.`);
    }
    return date;
}
/**
 * Resolves the reporting window of a tool call. An explicit start_date/end_date
 * pair (YYYY-MM-DD, both inclusive) wins over `days`, so a calendar month can be
 * queried exactly; without it the window is the last `days` days ending
 * yesterday, as before. Both dates must be given together.
 */
function resolveDateRange(days, startDate, endDate) {
    const hasStart = startDate !== undefined && startDate !== "";
    const hasEnd = endDate !== undefined && endDate !== "";
    if (hasStart !== hasEnd) {
        throw new Error("start_date and end_date must be given together (YYYY-MM-DD, both inclusive). " +
            "Omit both to use days instead.");
    }
    if (!hasStart) {
        return { ...getDateRange(days), days };
    }
    const start = parseIsoDate(startDate, "start_date");
    const end = parseIsoDate(endDate, "end_date");
    if (start > end) {
        throw new Error(`start_date ${startDate} lies after end_date ${endDate}.`);
    }
    return {
        startDate: startDate,
        endDate: endDate,
        days: Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1,
    };
}
/** The range of the same length that ends the day before `range` starts. */
function precedingDateRange(range) {
    const start = parseIsoDate(range.startDate, "startDate");
    const priorEnd = new Date(start.getTime() - DAY_MS);
    const priorStart = new Date(priorEnd.getTime() - (range.days - 1) * DAY_MS);
    return {
        startDate: priorStart.toISOString().split("T")[0],
        endDate: priorEnd.toISOString().split("T")[0],
        days: range.days,
    };
}
function getPriorDateRange(days) {
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
async function fetchAllRows(params) {
    const client = await (0, auth_js_1.getSearchConsoleClient)();
    const { siteUrl } = (0, auth_js_1.getConfig)();
    const allRows = [];
    const pageSize = params.rowLimit || 25000;
    let startRow = 0;
    while (true) {
        const response = await client.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate: params.startDate,
                endDate: params.endDate,
                dimensions: params.dimensions,
                // Both spellings of the surface filter feed one API field. Undefined
                // means the API default, "web".
                type: params.type ?? params.searchType,
                // googleapis 176 predates filterLists (API update 2026-11); the field
                // goes through as-is, so the group type is widened here only.
                dimensionFilterGroups: params.dimensionFilterGroups,
                rowLimit: pageSize,
                startRow,
                dataState: params.dataState ?? "all",
            },
        });
        const rows = response.data.rows;
        if (!rows || rows.length === 0)
            break;
        for (const row of rows) {
            allRows.push({
                keys: row.keys || [],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0,
            });
        }
        if (rows.length < pageSize)
            break;
        if (params.maxRows && allRows.length >= params.maxRows)
            break;
        startRow += pageSize;
    }
    return params.maxRows ? allRows.slice(0, params.maxRows) : allRows;
}
