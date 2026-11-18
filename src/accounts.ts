import { google } from "googleapis";
import { searchconsole_v1, indexing_v3 } from "googleapis";
import * as fs from "fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { hostMatchesProperties } from "./safe-fetch.js";

/**
 * Mehrere Service-Accounts in einer Instanz.
 *
 * Quellen: GSC_SERVICE_ACCOUNT_JSON und jede Variable GSC_SERVICE_ACCOUNT_JSON_<NAME>
 * (kompletter Schluessel als Zeichenkette), ersatzweise GSC_KEY_FILE. Die Reihenfolge
 * ist die Vorzugsreihenfolge: GSC_ACCOUNT_ORDER (Komma-Liste aus client_email oder
 * deren Teil vor dem "@") zieht genannte Accounts nach vorn, der Rest folgt in der
 * Reihenfolge GSC_SERVICE_ACCOUNT_JSON, dann die Varianten alphabetisch.
 *
 * Je Aufruf nimmt der Server den bevorzugten Account, der die Property in sites.list
 * fuehrt, und wiederholt den Aufruf mit dem naechsten, wenn Google mit 403 ablehnt.
 * Nach aussen gehen nur client_email und Variablenname, nie Schluesseldaten.
 */

export interface GscAccount {
  /** client_email aus dem Schluessel */
  email: string;
  /** Herkunft: Name der Umgebungsvariable oder "GSC_KEY_FILE" */
  source: string;
  credentials: Record<string, unknown>;
}

const INLINE_PREFIX = "GSC_SERVICE_ACCOUNT_JSON";
const INLINE_VAR = /^GSC_SERVICE_ACCOUNT_JSON(_[A-Z0-9_]+)?$/;

// sops (dotenv) und manche Secret-Manager machen aus dem "\n" im private_key echte
// Zeilenumbrueche - dann ist der Schluessel kein gueltiges JSON mehr ("Bad control
// character"). Der Wert kommt einzeilig an, echte Umbrueche koennen also nur aus diesen
// Escapes stammen: zurueckverwandeln und erneut parsen.
export function parseServiceAccountJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch (error) {
    try {
      return JSON.parse(raw.replace(/\r?\n/g, "\\n"));
    } catch {
      // Die Original-Meldung nennt nur Position und Zeichen, keinen Inhalt.
      throw error;
    }
  }
}

/** Namen der Variablen mit Inline-Schluessel, in Grundreihenfolge. */
export function inlineAccountVars(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env)
    .filter((name) => INLINE_VAR.test(name) && Boolean(env[name]?.trim()))
    .sort((a, b) => (a === INLINE_PREFIX ? -1 : b === INLINE_PREFIX ? 1 : a.localeCompare(b)));
}

export function hasServiceAccountSource(env: NodeJS.ProcessEnv = process.env): boolean {
  return inlineAccountVars(env).length > 0 || Boolean(env.GSC_KEY_FILE);
}

function orderAccounts(accounts: GscAccount[], order: string | undefined): GscAccount[] {
  const wanted = (order ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (wanted.length === 0) return accounts;
  const rank = (acc: GscAccount) => {
    const email = acc.email.toLowerCase();
    const local = email.split("@")[0];
    const i = wanted.findIndex((w) => w === email || w === local);
    return i === -1 ? wanted.length : i;
  };
  // Array.prototype.sort ist stabil: Gleichrangige behalten die Grundreihenfolge.
  return [...accounts].sort((a, b) => rank(a) - rank(b));
}

/** Liest alle konfigurierten Accounts. Wirft nur, wenn ein Schluessel kaputt ist. */
export function loadServiceAccounts(env: NodeJS.ProcessEnv = process.env): GscAccount[] {
  const accounts: GscAccount[] = [];
  const seen = new Set<string>();
  const add = (source: string, credentials: Record<string, unknown>) => {
    const email = typeof credentials.client_email === "string" ? credentials.client_email : "";
    if (!email) {
      throw new Error(`${source} does not contain a service account key (client_email missing).`);
    }
    if (seen.has(email)) return;
    seen.add(email);
    accounts.push({ email, source, credentials });
  };

  for (const name of inlineAccountVars(env)) {
    let parsed: Record<string, unknown>;
    try {
      parsed = parseServiceAccountJson(env[name] as string);
    } catch {
      throw new Error(`${name} is not valid JSON. Store the complete service account key in it.`);
    }
    add(name, parsed);
  }
  // GSC_KEY_FILE nur ohne Inline-Schluessel, wie bisher (Inline hat Vorrang).
  if (accounts.length === 0 && env.GSC_KEY_FILE) {
    const keyFile = env.GSC_KEY_FILE;
    if (!fs.existsSync(keyFile)) {
      throw new Error(`Service account key file not found at: ${keyFile}`);
    }
    add("GSC_KEY_FILE", parseServiceAccountJson(fs.readFileSync(keyFile, "utf8")));
  }
  return orderAccounts(accounts, env.GSC_ACCOUNT_ORDER);
}

let accountCache: GscAccount[] | null = null;

export function getServiceAccounts(): GscAccount[] {
  if (!accountCache) accountCache = loadServiceAccounts();
  return accountCache;
}

// ---------------------------------------------------------------------------
// Clients je Account

type ScopeProvider = () => string[];
let scopeProvider: ScopeProvider = () => ["https://www.googleapis.com/auth/webmasters.readonly"];

/** auth.ts setzt hier die Scopes der Instanz (vermeidet einen Import-Zyklus). */
export function setScopeProvider(fn: ScopeProvider) {
  scopeProvider = fn;
}

const clientCache = new Map<string, searchconsole_v1.Searchconsole>();

export function clientFor(account: GscAccount): searchconsole_v1.Searchconsole {
  let client = clientCache.get(account.email);
  if (!client) {
    // auth am Client statt google.options(): sonst teilen sich alle Accounts eine
    // globale Anmeldung, und der zuletzt erzeugte gewinnt.
    const auth = new google.auth.GoogleAuth({
      credentials: account.credentials,
      scopes: scopeProvider(),
    });
    client = google.searchconsole({ version: "v1", auth });
    clientCache.set(account.email, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Account je Aufruf

const accountContext = new AsyncLocalStorage<GscAccount>();

export function withAccount<T>(account: GscAccount, fn: () => T): T {
  return accountContext.run(account, fn);
}

export function currentAccount(): GscAccount | undefined {
  return accountContext.getStore();
}

// ---------------------------------------------------------------------------
// Welche Properties sieht welcher Account (sites.list, zwischengespeichert)

export interface SiteEntry {
  siteUrl: string;
  permissionLevel: string | null;
}

type SiteLister = (account: GscAccount) => Promise<SiteEntry[]>;

const defaultLister: SiteLister = async (account) => {
  const res = await clientFor(account).sites.list({});
  return (res.data.siteEntry ?? [])
    .filter((e) => Boolean(e.siteUrl))
    .map((e) => ({ siteUrl: e.siteUrl as string, permissionLevel: e.permissionLevel ?? null }));
};

let siteLister: SiteLister = defaultLister;
const SITES_TTL_MS = 10 * 60 * 1000;
const sitesCache = new Map<string, { at: number; sites: SiteEntry[] }>();

export async function sitesOf(account: GscAccount, fresh = false): Promise<SiteEntry[]> {
  const hit = sitesCache.get(account.email);
  if (!fresh && hit && Date.now() - hit.at < SITES_TTL_MS) return hit.sites;
  const sites = await siteLister(account);
  sitesCache.set(account.email, { at: Date.now(), sites });
  return sites;
}

function sameProperty(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Accounts fuer eine Property in Versuchsreihenfolge: zuerst die, deren sites.list die
 * Property fuehrt (in Vorzugsreihenfolge), danach die uebrigen. Kann ein Account seine
 * Liste nicht abrufen, steht er bei den uebrigen - der eigentliche Aufruf entscheidet.
 */
export async function accountsFor(siteUrl: string | undefined): Promise<GscAccount[]> {
  const accounts = getServiceAccounts();
  if (!siteUrl || accounts.length <= 1) return accounts;
  const listed: GscAccount[] = [];
  const rest: GscAccount[] = [];
  await Promise.all(
    accounts.map(async (acc) => {
      try {
        const sites = await sitesOf(acc);
        (sites.some((s) => sameProperty(s.siteUrl, siteUrl)) ? listed : rest).push(acc);
      } catch {
        rest.push(acc);
      }
    })
  );
  const pos = (acc: GscAccount) => accounts.indexOf(acc);
  return [...listed.sort((a, b) => pos(a) - pos(b)), ...rest.sort((a, b) => pos(a) - pos(b))];
}

// ---------------------------------------------------------------------------
// 403-Fallback

/** Google lehnt ab, weil dieser Account keine Rechte an der Property hat. */
export function isPermissionError(err: unknown): boolean {
  // Schon ueber alle Accounts gelaufen (auch verschachtelt, z. B. je Property-Variante
  // in list_sitemaps): nicht noch einmal mit dem naechsten Account wiederholen.
  if ((err as { exhausted?: unknown })?.exhausted === true) return false;
  const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown }; message?: unknown };
  const status = Number(e?.code ?? e?.status ?? e?.response?.status);
  if (status === 403) return true;
  const msg = typeof e?.message === "string" ? e.message : "";
  return /insufficient permission|sufficient permission|do(es)? not own|not own this site|permission denied/i.test(msg);
}

/** Alle Accounts wurden versucht; der Wrapper wiederholt dann nicht noch einmal. */
export class AccountsExhaustedError extends Error {
  readonly tried: string[];
  readonly status = 403;
  readonly exhausted = true;
  constructor(
    siteUrl: string | undefined,
    attempts: Array<{ email: string; error: unknown }>,
    hint = "Add one of these accounts as a user of the property in Search Console " +
      "(list_properties shows what each account can see)."
  ) {
    super(
      `No configured service account has access to ${siteUrl ?? "this property"}. Tried: ` +
      attempts.map((a) => `${a.email} (${shortReason(a.error)})`).join("; ") +
      `. ${hint}`
    );
    this.name = "AccountsExhaustedError";
    this.tried = attempts.map((a) => a.email);
  }
}

/** Erste Zeile der Google-Meldung, gekuerzt. Enthaelt nie Schluesseldaten. */
export function shortReason(err: unknown): string {
  const e = err as { code?: unknown; message?: unknown };
  const msg = (typeof e?.message === "string" ? e.message : String(err)).split("\n")[0].trim();
  const code = e?.code !== undefined ? `${e.code}: ` : "";
  return (code + msg).slice(0, 240);
}

/**
 * Fuehrt fn mit dem passenden Account aus. Lehnt Google mit 403 ab, folgt der naechste
 * Account; sind alle durch, kommt ein AccountsExhaustedError mit den versuchten
 * client_emails. Andere Fehler gehen unveraendert durch. Mit nur einem Account ist das
 * ein einfacher Aufruf.
 */
export async function runWithAccountFallback<T>(
  siteUrl: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return tryAccounts(siteUrl, await accountsFor(siteUrl), fn);
}

// ---------------------------------------------------------------------------
// Indexing API: URL-basiert, braucht den Account als Inhaber (siteOwner)

const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const indexingCache = new Map<string, indexing_v3.Indexing>();

export function indexingClientFor(account: GscAccount): indexing_v3.Indexing {
  let client = indexingCache.get(account.email);
  if (!client) {
    const auth = new google.auth.GoogleAuth({ credentials: account.credentials, scopes: [INDEXING_SCOPE] });
    client = google.indexing({ version: "v3", auth });
    indexingCache.set(account.email, client);
  }
  return client;
}

/**
 * Accounts fuer eine einzelne URL: zuerst die, die eine passende Property als Inhaber
 * fuehren (nur das akzeptiert die Indexing API), dann die mit anderer Berechtigung auf
 * einer passenden Property, dann der Rest - jeweils in Vorzugsreihenfolge.
 */
export async function accountsForUrl(url: string): Promise<GscAccount[]> {
  const accounts = getServiceAccounts();
  if (accounts.length <= 1) return accounts;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return accounts;
  }
  const rank = new Map<GscAccount, number>();
  await Promise.all(
    accounts.map(async (acc) => {
      try {
        const matching = (await sitesOf(acc)).filter((s) => hostMatchesProperties(host, [s.siteUrl]));
        rank.set(acc, matching.some((s) => s.permissionLevel === "siteOwner") ? 0 : matching.length > 0 ? 1 : 2);
      } catch {
        rank.set(acc, 2);
      }
    })
  );
  return [...accounts].sort((a, b) => (rank.get(a) ?? 2) - (rank.get(b) ?? 2));
}

/** Wie runWithAccountFallback, aber fuer eine URL (Indexing API). */
export async function runForUrl<T>(url: string, fn: () => Promise<T>): Promise<T> {
  return tryAccounts(
    url,
    await accountsForUrl(url),
    fn,
    "The Indexing API needs the account as Owner of a property covering the URL (Full user is not " +
      "enough) and the Web Search Indexing API enabled in the account's Cloud project."
  );
}

async function tryAccounts<T>(
  label: string | undefined,
  accounts: GscAccount[],
  fn: () => Promise<T>,
  hint?: string
): Promise<T> {
  if (accounts.length === 0) return fn();
  if (accounts.length === 1) return withAccount(accounts[0], fn);
  const attempts: Array<{ email: string; error: unknown }> = [];
  for (const acc of accounts) {
    try {
      return await withAccount(acc, fn);
    } catch (err) {
      if (!isPermissionError(err)) throw err;
      attempts.push({ email: acc.email, error: err });
    }
  }
  throw new AccountsExhaustedError(label, attempts, hint);
}

/** Nur fuer Tests: sites.list ersetzen und Zwischenspeicher leeren. */
export const _testing = {
  setSiteLister(fn: SiteLister | null) {
    siteLister = fn ?? defaultLister;
    sitesCache.clear();
  },
  setAccounts(accounts: GscAccount[] | null) {
    accountCache = accounts;
    sitesCache.clear();
    clientCache.clear();
    indexingCache.clear();
  },
};
