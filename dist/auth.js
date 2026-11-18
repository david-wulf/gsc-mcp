"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthMode = getAuthMode;
exports.withSiteUrl = withSiteUrl;
exports.currentSiteUrl = currentSiteUrl;
exports.getConfig = getConfig;
exports.getSearchConsoleClient = getSearchConsoleClient;
exports.runForProperty = runForProperty;
exports.listPropertiesPerAccount = listPropertiesPerAccount;
exports.allAccessibleSiteUrls = allAccessibleSiteUrls;
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs"));
const node_async_hooks_1 = require("node:async_hooks");
const oauth_js_1 = require("./oauth.js");
const accounts_js_1 = require("./accounts.js");
let cachedOAuthClient = null;
// Same scope set as the OAuth flow, including auth/indexing on the full
// tier so submit_url / submit_batch work in service-account mode too (#2).
(0, accounts_js_1.setScopeProvider)(() => (0, oauth_js_1.scopesForTier)((0, oauth_js_1.getScopeTier)()));
function getAuthMode() {
    const mode = process.env.GSC_AUTH_MODE?.toLowerCase();
    if (mode === "oauth")
        return "oauth";
    return "service_account";
}
// Property-Override je Tool-Aufruf. index.ts setzt ihn aus dem Parameter
// `site_url`; getConfig() liefert ihn dann als siteUrl, so dass auch
// verschachtelte Aufrufe (fetchAllRows, inspectUrl, generate_report) die
// gewaehlte Property nutzen, ohne dass jede Tool-Funktion sie durchreichen muss.
const siteUrlContext = new node_async_hooks_1.AsyncLocalStorage();
function withSiteUrl(siteUrl, fn) {
    const trimmed = siteUrl?.trim();
    return trimmed ? siteUrlContext.run(trimmed, fn) : fn();
}
/** Property dieses Aufrufs, ohne zu werfen (fuer Metadaten). */
function currentSiteUrl() {
    return (siteUrlContext.getStore() ||
        process.env.GSC_SITE_URL?.trim() ||
        process.env.GSC_SITE_URLS?.split(",").map((s) => s.trim()).find(Boolean));
}
function getConfig() {
    const mode = getAuthMode();
    // trim(): Secrets, die unter Windows bearbeitet wurden, tragen sonst ein "\r" mit in die
    // Property-URL - Google findet die Property dann nicht.
    const siteUrl = siteUrlContext.getStore() || process.env.GSC_SITE_URL?.trim() || undefined;
    const siteUrls = process.env.GSC_SITE_URLS
        ? process.env.GSC_SITE_URLS.split(",").map((s) => s.trim()).filter(Boolean)
        : siteUrl
            ? [siteUrl]
            : [];
    if (mode === "service_account") {
        const keyFile = process.env.GSC_KEY_FILE;
        // GSC_SERVICE_ACCOUNT_JSON (und GSC_SERVICE_ACCOUNT_JSON_<NAME> fuer weitere
        // Accounts) haelt den kompletten Schluessel als Zeichenkette. Damit kann ein
        // Secret-Manager (Infisical) ihn zur Laufzeit einspeisen, ohne dass der Private Key
        // je auf die Platte muss. Hat Vorrang vor GSC_KEY_FILE. Siehe accounts.ts.
        const inline = (0, accounts_js_1.inlineAccountVars)().length > 0;
        if (!(0, accounts_js_1.hasServiceAccountSource)()) {
            throw new Error("Either GSC_SERVICE_ACCOUNT_JSON or GSC_KEY_FILE is required in " +
                "service_account mode. Set GSC_SERVICE_ACCOUNT_JSON to the contents of " +
                "your service account JSON key (more accounts: GSC_SERVICE_ACCOUNT_JSON_<NAME>), " +
                "or GSC_KEY_FILE to its path, or switch to OAuth by setting GSC_AUTH_MODE=oauth.");
        }
        if (!siteUrl && siteUrls.length === 0) {
            throw new Error("GSC_SITE_URL environment variable is required. " +
                "Set it to your GSC property URL (e.g. https://yoursite.com/ or sc-domain:yoursite.com).");
        }
        if (!inline && keyFile && !fs.existsSync(keyFile)) {
            throw new Error(`Service account key file not found at: ${keyFile}`);
        }
        return {
            keyFile,
            inlineJson: process.env.GSC_SERVICE_ACCOUNT_JSON,
            siteUrl: siteUrl || siteUrls[0],
            siteUrls,
        };
    }
    // OAuth mode
    if (!siteUrl && siteUrls.length === 0) {
        throw new Error("GSC_SITE_URL environment variable is required. " +
            "Set it to your GSC property URL (e.g. https://yoursite.com/ or sc-domain:yoursite.com).");
    }
    return { keyFile: undefined, inlineJson: undefined, siteUrl: siteUrl || siteUrls[0], siteUrls };
}
async function getOAuthClient() {
    const oauth2Client = await (0, oauth_js_1.authenticateWithOAuth)();
    googleapis_1.google.options({ auth: oauth2Client });
    return googleapis_1.google.searchconsole("v1");
}
/**
 * Client fuer den laufenden Aufruf. Im Service-Account-Modus der Account aus dem
 * Aufruf-Kontext (runForProperty setzt ihn, mit 403-Fallback); ohne Kontext der
 * bevorzugte Account, der die aktuelle Property in sites.list fuehrt.
 */
async function getSearchConsoleClient() {
    if (getAuthMode() === "oauth") {
        if (!cachedOAuthClient)
            cachedOAuthClient = await getOAuthClient();
        return cachedOAuthClient;
    }
    getConfig(); // gleiche Pruefungen und Meldungen wie bisher
    const forced = (0, accounts_js_1.currentAccount)();
    if (forced)
        return (0, accounts_js_1.clientFor)(forced);
    const [account] = await (0, accounts_js_1.accountsFor)(currentSiteUrl());
    if (!account) {
        throw new Error("No service account configured (GSC_SERVICE_ACCOUNT_JSON / GSC_KEY_FILE).");
    }
    return (0, accounts_js_1.clientFor)(account);
}
/**
 * Fuehrt einen Aufruf gegen eine Property aus und wechselt bei 403 den Service-Account.
 * Im OAuth-Modus gibt es nur die eine Anmeldung, dann ist das ein einfacher Aufruf.
 */
function runForProperty(siteUrl, fn) {
    if (getAuthMode() === "oauth")
        return fn();
    return (0, accounts_js_1.runWithAccountFallback)(siteUrl, fn);
}
/** Je Account die Properties aus sites.list (frisch abgerufen). Nur client_email, nie Schluessel. */
async function listPropertiesPerAccount() {
    if (getAuthMode() === "oauth") {
        const sc = await getSearchConsoleClient();
        const res = await sc.sites.list({});
        return [{
                account: "oauth",
                source: "GSC_AUTH_MODE=oauth",
                preference: 1,
                properties: (res.data.siteEntry ?? [])
                    .filter((e) => Boolean(e.siteUrl))
                    .map((e) => ({ siteUrl: e.siteUrl, permissionLevel: e.permissionLevel ?? null })),
                error: null,
            }];
    }
    const accounts = (0, accounts_js_1.getServiceAccounts)();
    return Promise.all(accounts.map(async (acc, i) => {
        try {
            const properties = await (0, accounts_js_1.sitesOf)(acc, true);
            return { account: acc.email, source: acc.source, preference: i + 1, properties, error: null };
        }
        catch (err) {
            return { account: acc.email, source: acc.source, preference: i + 1, properties: [], error: (0, accounts_js_1.shortReason)(err) };
        }
    }));
}
/** Alle Properties, die irgendein konfigurierter Account sieht (zwischengespeichert). */
async function allAccessibleSiteUrls() {
    if (getAuthMode() === "oauth") {
        const sc = await getSearchConsoleClient();
        const res = await sc.sites.list({});
        return (res.data.siteEntry ?? []).map((e) => e.siteUrl).filter((u) => Boolean(u));
    }
    const lists = await Promise.all((0, accounts_js_1.getServiceAccounts)().map((acc) => (0, accounts_js_1.sitesOf)(acc).catch(() => [])));
    return [...new Set(lists.flat().map((s) => s.siteUrl))];
}
