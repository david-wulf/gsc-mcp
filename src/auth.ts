import { google } from "googleapis";
import { searchconsole_v1 } from "googleapis";
import * as fs from "fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { authenticateWithOAuth, getScopeTier, scopesForTier } from "./oauth.js";

let cachedClient: searchconsole_v1.Searchconsole | null = null;

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
    // GSC_SERVICE_ACCOUNT_JSON haelt den kompletten Schluessel als Zeichenkette.
    // Damit kann ein Secret-Manager (Infisical) ihn zur Laufzeit einspeisen, ohne
    // dass der Private Key je auf die Platte muss. Hat Vorrang vor GSC_KEY_FILE.
    const inlineJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
    if (!keyFile && !inlineJson) {
      throw new Error(
        "Either GSC_SERVICE_ACCOUNT_JSON or GSC_KEY_FILE is required in " +
        "service_account mode. Set GSC_SERVICE_ACCOUNT_JSON to the contents of " +
        "your service account JSON key, or GSC_KEY_FILE to its path, " +
        "or switch to OAuth by setting GSC_AUTH_MODE=oauth."
      );
    }
    if (!siteUrl && siteUrls.length === 0) {
      throw new Error(
        "GSC_SITE_URL environment variable is required. " +
        "Set it to your GSC property URL (e.g. https://yoursite.com/ or sc-domain:yoursite.com)."
      );
    }
    if (!inlineJson && keyFile && !fs.existsSync(keyFile)) {
      throw new Error(`Service account key file not found at: ${keyFile}`);
    }
    return { keyFile, inlineJson, siteUrl: siteUrl || siteUrls[0], siteUrls };
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

// sops (dotenv) und manche Secret-Manager machen aus dem "\n" im private_key echte
// Zeilenumbrueche - dann ist der Schluessel kein gueltiges JSON mehr ("Bad control
// character"). Der Wert kommt einzeilig an, echte Umbrueche koennen also nur aus diesen
// Escapes stammen: zurueckverwandeln und erneut parsen.
function parseServiceAccountJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    try {
      return JSON.parse(raw.replace(/\r?\n/g, "\\n"));
    } catch {
      throw error;
    }
  }
}

async function getServiceAccountClient(): Promise<searchconsole_v1.Searchconsole> {
  const { keyFile, inlineJson } = getConfig();

  // Same scope set as the OAuth flow, including auth/indexing on the full
  // tier so submit_url / submit_batch work in service-account mode too (#2).
  const scopes = scopesForTier(getScopeTier());
  const auth = inlineJson
    ? new google.auth.GoogleAuth({ credentials: parseServiceAccountJson(inlineJson), scopes })
    : new google.auth.GoogleAuth({ keyFile, scopes });

  google.options({ auth });
  return google.searchconsole("v1");
}

async function getOAuthClient(): Promise<searchconsole_v1.Searchconsole> {
  const oauth2Client = await authenticateWithOAuth();
  google.options({ auth: oauth2Client });
  return google.searchconsole("v1");
}

export async function getSearchConsoleClient(): Promise<searchconsole_v1.Searchconsole> {
  if (cachedClient) return cachedClient;

  const mode = getAuthMode();

  if (mode === "oauth") {
    cachedClient = await getOAuthClient();
  } else {
    cachedClient = await getServiceAccountClient();
  }

  return cachedClient;
}
