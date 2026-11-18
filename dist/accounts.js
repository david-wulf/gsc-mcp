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
exports._testing = exports.AccountsExhaustedError = void 0;
exports.parseServiceAccountJson = parseServiceAccountJson;
exports.inlineAccountVars = inlineAccountVars;
exports.hasServiceAccountSource = hasServiceAccountSource;
exports.loadServiceAccounts = loadServiceAccounts;
exports.getServiceAccounts = getServiceAccounts;
exports.setScopeProvider = setScopeProvider;
exports.clientFor = clientFor;
exports.withAccount = withAccount;
exports.currentAccount = currentAccount;
exports.sitesOf = sitesOf;
exports.accountsFor = accountsFor;
exports.isPermissionError = isPermissionError;
exports.shortReason = shortReason;
exports.runWithAccountFallback = runWithAccountFallback;
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs"));
const node_async_hooks_1 = require("node:async_hooks");
const INLINE_PREFIX = "GSC_SERVICE_ACCOUNT_JSON";
const INLINE_VAR = /^GSC_SERVICE_ACCOUNT_JSON(_[A-Z0-9_]+)?$/;
// sops (dotenv) und manche Secret-Manager machen aus dem "\n" im private_key echte
// Zeilenumbrueche - dann ist der Schluessel kein gueltiges JSON mehr ("Bad control
// character"). Der Wert kommt einzeilig an, echte Umbrueche koennen also nur aus diesen
// Escapes stammen: zurueckverwandeln und erneut parsen.
function parseServiceAccountJson(raw) {
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        try {
            return JSON.parse(raw.replace(/\r?\n/g, "\\n"));
        }
        catch {
            // Die Original-Meldung nennt nur Position und Zeichen, keinen Inhalt.
            throw error;
        }
    }
}
/** Namen der Variablen mit Inline-Schluessel, in Grundreihenfolge. */
function inlineAccountVars(env = process.env) {
    return Object.keys(env)
        .filter((name) => INLINE_VAR.test(name) && Boolean(env[name]?.trim()))
        .sort((a, b) => (a === INLINE_PREFIX ? -1 : b === INLINE_PREFIX ? 1 : a.localeCompare(b)));
}
function hasServiceAccountSource(env = process.env) {
    return inlineAccountVars(env).length > 0 || Boolean(env.GSC_KEY_FILE);
}
function orderAccounts(accounts, order) {
    const wanted = (order ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    if (wanted.length === 0)
        return accounts;
    const rank = (acc) => {
        const email = acc.email.toLowerCase();
        const local = email.split("@")[0];
        const i = wanted.findIndex((w) => w === email || w === local);
        return i === -1 ? wanted.length : i;
    };
    // Array.prototype.sort ist stabil: Gleichrangige behalten die Grundreihenfolge.
    return [...accounts].sort((a, b) => rank(a) - rank(b));
}
/** Liest alle konfigurierten Accounts. Wirft nur, wenn ein Schluessel kaputt ist. */
function loadServiceAccounts(env = process.env) {
    const accounts = [];
    const seen = new Set();
    const add = (source, credentials) => {
        const email = typeof credentials.client_email === "string" ? credentials.client_email : "";
        if (!email) {
            throw new Error(`${source} does not contain a service account key (client_email missing).`);
        }
        if (seen.has(email))
            return;
        seen.add(email);
        accounts.push({ email, source, credentials });
    };
    for (const name of inlineAccountVars(env)) {
        let parsed;
        try {
            parsed = parseServiceAccountJson(env[name]);
        }
        catch {
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
let accountCache = null;
function getServiceAccounts() {
    if (!accountCache)
        accountCache = loadServiceAccounts();
    return accountCache;
}
let scopeProvider = () => ["https://www.googleapis.com/auth/webmasters.readonly"];
/** auth.ts setzt hier die Scopes der Instanz (vermeidet einen Import-Zyklus). */
function setScopeProvider(fn) {
    scopeProvider = fn;
}
const clientCache = new Map();
function clientFor(account) {
    let client = clientCache.get(account.email);
    if (!client) {
        // auth am Client statt google.options(): sonst teilen sich alle Accounts eine
        // globale Anmeldung, und der zuletzt erzeugte gewinnt.
        const auth = new googleapis_1.google.auth.GoogleAuth({
            credentials: account.credentials,
            scopes: scopeProvider(),
        });
        client = googleapis_1.google.searchconsole({ version: "v1", auth });
        clientCache.set(account.email, client);
    }
    return client;
}
// ---------------------------------------------------------------------------
// Account je Aufruf
const accountContext = new node_async_hooks_1.AsyncLocalStorage();
function withAccount(account, fn) {
    return accountContext.run(account, fn);
}
function currentAccount() {
    return accountContext.getStore();
}
const defaultLister = async (account) => {
    const res = await clientFor(account).sites.list({});
    return (res.data.siteEntry ?? [])
        .filter((e) => Boolean(e.siteUrl))
        .map((e) => ({ siteUrl: e.siteUrl, permissionLevel: e.permissionLevel ?? null }));
};
let siteLister = defaultLister;
const SITES_TTL_MS = 10 * 60 * 1000;
const sitesCache = new Map();
async function sitesOf(account, fresh = false) {
    const hit = sitesCache.get(account.email);
    if (!fresh && hit && Date.now() - hit.at < SITES_TTL_MS)
        return hit.sites;
    const sites = await siteLister(account);
    sitesCache.set(account.email, { at: Date.now(), sites });
    return sites;
}
function sameProperty(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}
/**
 * Accounts fuer eine Property in Versuchsreihenfolge: zuerst die, deren sites.list die
 * Property fuehrt (in Vorzugsreihenfolge), danach die uebrigen. Kann ein Account seine
 * Liste nicht abrufen, steht er bei den uebrigen - der eigentliche Aufruf entscheidet.
 */
async function accountsFor(siteUrl) {
    const accounts = getServiceAccounts();
    if (!siteUrl || accounts.length <= 1)
        return accounts;
    const listed = [];
    const rest = [];
    await Promise.all(accounts.map(async (acc) => {
        try {
            const sites = await sitesOf(acc);
            (sites.some((s) => sameProperty(s.siteUrl, siteUrl)) ? listed : rest).push(acc);
        }
        catch {
            rest.push(acc);
        }
    }));
    const pos = (acc) => accounts.indexOf(acc);
    return [...listed.sort((a, b) => pos(a) - pos(b)), ...rest.sort((a, b) => pos(a) - pos(b))];
}
// ---------------------------------------------------------------------------
// 403-Fallback
/** Google lehnt ab, weil dieser Account keine Rechte an der Property hat. */
function isPermissionError(err) {
    // Schon ueber alle Accounts gelaufen (auch verschachtelt, z. B. je Property-Variante
    // in list_sitemaps): nicht noch einmal mit dem naechsten Account wiederholen.
    if (err?.exhausted === true)
        return false;
    const e = err;
    const status = Number(e?.code ?? e?.status ?? e?.response?.status);
    if (status === 403)
        return true;
    const msg = typeof e?.message === "string" ? e.message : "";
    return /insufficient permission|sufficient permission|do(es)? not own|not own this site|permission denied/i.test(msg);
}
/** Alle Accounts wurden versucht; der Wrapper wiederholt dann nicht noch einmal. */
class AccountsExhaustedError extends Error {
    tried;
    status = 403;
    exhausted = true;
    constructor(siteUrl, attempts) {
        super(`No configured service account has access to ${siteUrl ?? "this property"}. Tried: ` +
            attempts.map((a) => `${a.email} (${shortReason(a.error)})`).join("; ") +
            `. Add one of these accounts as a user of the property in Search Console ` +
            `(list_properties shows what each account can see).`);
        this.name = "AccountsExhaustedError";
        this.tried = attempts.map((a) => a.email);
    }
}
exports.AccountsExhaustedError = AccountsExhaustedError;
/** Erste Zeile der Google-Meldung, gekuerzt. Enthaelt nie Schluesseldaten. */
function shortReason(err) {
    const e = err;
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
async function runWithAccountFallback(siteUrl, fn) {
    const accounts = await accountsFor(siteUrl);
    if (accounts.length === 0)
        return fn();
    if (accounts.length === 1)
        return withAccount(accounts[0], fn);
    const attempts = [];
    for (const acc of accounts) {
        try {
            return await withAccount(acc, fn);
        }
        catch (err) {
            if (!isPermissionError(err))
                throw err;
            attempts.push({ email: acc.email, error: err });
        }
    }
    throw new AccountsExhaustedError(siteUrl, attempts);
}
/** Nur fuer Tests: sites.list ersetzen und Zwischenspeicher leeren. */
exports._testing = {
    setSiteLister(fn) {
        siteLister = fn ?? defaultLister;
        sitesCache.clear();
    },
    setAccounts(accounts) {
        accountCache = accounts;
        sitesCache.clear();
        clientCache.clear();
    },
};
