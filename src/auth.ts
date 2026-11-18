import { google } from "googleapis";
import { searchconsole_v1 } from "googleapis";
import * as fs from "fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { authenticateWithOAuth, getScopeTier, scopesForTier } from "./oauth.js";
import {
  accountsFor,
  clientFor,
  currentAccount,
  getServiceAccounts,
  hasServiceAccountSource,
  inlineAccountVars,
  runWithAccountFallback,
  setScopeProvider,
  shortReason,
  sitesOf,
  type SiteEntry,
} from "./accounts.js";

let cachedOAuthClient: searchconsole_v1.Searchconsole | null = null;

// Same scope set as the OAuth flow, including auth/indexing on the full
// tier so submit_url / submit_batch work in service-account mode too (#2).
setScopeProvider(() => scopesForTier(getScopeTier()));

export type AuthMode = "service_account" | "oauth";

export function getAuthMode(): AuthMode {
  const mode = process.env.GSC_AUTH_MODE?.toLowerCase();
  if (mode === "oauth") return "oauth";
  return "service_account";
}

// Property-Override je Tool-Aufruf. index.ts setzt ihn aus dem Parameter
// `site_url`; getConfig() liefert ihn dann als siteUrl, so dass auch
// verschachtelte Aufrufe (fetchAllRows, inspectUrl, generate_report) die
// gewaehlte Property nutzen, ohne dass jede Tool-Funktion sie durchreichen muss.
const siteUrlContext = new AsyncLocalStorage<string>();

export function withSiteUrl<T>(siteUrl: string | undefined, fn: () => T): T {
  const trimmed = siteUrl?.trim();
  return trimmed ? siteUrlContext.run(trimmed, fn) : fn();
}

/** Property dieses Aufrufs, ohne zu werfen (fuer Metadaten). */
export function currentSiteUrl(): string | undefined {
  return (
    siteUrlContext.getStore() ||
    process.env.GSC_SITE_URL?.trim() ||
    process.env.GSC_SITE_URLS?.split(",").map((s) => s.trim()).find(Boolean)
  );
}

export function getConfig() {
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
    const inline = inlineAccountVars().length > 0;
    if (!hasServiceAccountSource()) {
      throw new Error(
        "Either GSC_SERVICE_ACCOUNT_JSON or GSC_KEY_FILE is required in " +
        "service_account mode. Set GSC_SERVICE_ACCOUNT_JSON to the contents of " +
        "your service account JSON key (more accounts: GSC_SERVICE_ACCOUNT_JSON_<NAME>), " +
        "or GSC_KEY_FILE to its path, or switch to OAuth by setting GSC_AUTH_MODE=oauth."
      );
    }
    if (!siteUrl && siteUrls.length === 0) {
      throw new Error(
        "GSC_SITE_URL environment variable is required. " +
        "Set it to your GSC property URL (e.g. https://yoursite.com/ or sc-domain:yoursite.com)."
      );
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
    throw new Error(
      "GSC_SITE_URL environment variable is required. " +
      "Set it to your GSC property URL (e.g. https://yoursite.com/ or sc-domain:yoursite.com)."
    );
  }
  return { keyFile: undefined, inlineJson: undefined, siteUrl: siteUrl || siteUrls[0], siteUrls };
}

async function getOAuthClient(): Promise<searchconsole_v1.Searchconsole> {
  const oauth2Client = await authenticateWithOAuth();
  google.options({ auth: oauth2Client });
  return google.searchconsole("v1");
}

/**
 * Client fuer den laufenden Aufruf. Im Service-Account-Modus der Account aus dem
 * Aufruf-Kontext (runForProperty setzt ihn, mit 403-Fallback); ohne Kontext der
 * bevorzugte Account, der die aktuelle Property in sites.list fuehrt.
 */
export async function getSearchConsoleClient(): Promise<searchconsole_v1.Searchconsole> {
  if (getAuthMode() === "oauth") {
    if (!cachedOAuthClient) cachedOAuthClient = await getOAuthClient();
    return cachedOAuthClient;
  }

  getConfig(); // gleiche Pruefungen und Meldungen wie bisher
  const forced = currentAccount();
  if (forced) return clientFor(forced);
  const [account] = await accountsFor(currentSiteUrl());
  if (!account) {
    throw new Error("No service account configured (GSC_SERVICE_ACCOUNT_JSON / GSC_KEY_FILE).");
  }
  return clientFor(account);
}

/**
 * Fuehrt einen Aufruf gegen eine Property aus und wechselt bei 403 den Service-Account.
 * Im OAuth-Modus gibt es nur die eine Anmeldung, dann ist das ein einfacher Aufruf.
 */
export function runForProperty<T>(siteUrl: string | undefined, fn: () => Promise<T>): Promise<T> {
  if (getAuthMode() === "oauth") return fn();
  return runWithAccountFallback(siteUrl, fn);
}

export interface AccountProperties {
  account: string;
  source: string;
  /** 1 = bevorzugt */
  preference: number;
  properties: SiteEntry[];
  error: string | null;
}

/** Je Account die Properties aus sites.list (frisch abgerufen). Nur client_email, nie Schluessel. */
export async function listPropertiesPerAccount(): Promise<AccountProperties[]> {
  if (getAuthMode() === "oauth") {
    const sc = await getSearchConsoleClient();
    const res = await sc.sites.list({});
    return [{
      account: "oauth",
      source: "GSC_AUTH_MODE=oauth",
      preference: 1,
      properties: (res.data.siteEntry ?? [])
        .filter((e) => Boolean(e.siteUrl))
        .map((e) => ({ siteUrl: e.siteUrl as string, permissionLevel: e.permissionLevel ?? null })),
      error: null,
    }];
  }
  const accounts = getServiceAccounts();
  return Promise.all(accounts.map(async (acc, i) => {
    try {
      const properties = await sitesOf(acc, true);
      return { account: acc.email, source: acc.source, preference: i + 1, properties, error: null };
    } catch (err) {
      return { account: acc.email, source: acc.source, preference: i + 1, properties: [], error: shortReason(err) };
    }
  }));
}

/** Alle Properties, die irgendein konfigurierter Account sieht (zwischengespeichert). */
export async function allAccessibleSiteUrls(): Promise<string[]> {
  if (getAuthMode() === "oauth") {
    const sc = await getSearchConsoleClient();
    const res = await sc.sites.list({});
    return (res.data.siteEntry ?? []).map((e) => e.siteUrl).filter((u): u is string => Boolean(u));
  }
  const lists = await Promise.all(getServiceAccounts().map((acc) => sitesOf(acc).catch(() => [])));
  return [...new Set(lists.flat().map((s) => s.siteUrl))];
}
