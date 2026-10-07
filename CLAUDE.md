# CLAUDE.md — Suganthans-GSC-MCP

## Zweck
MCP-Server für die Google Search Console API (Search Analytics, URL Inspection, Sitemaps, Indexing API) mit 33 SEO-Analyse-Tools. Fork von `Suganthan-Mohanadasan/Suganthans-GSC-MCP` (Basis v2.5.1), Fork-Version 2.7.0; läuft bei David je Property als eigene Server-Instanz.

## Aufbau
- Einstieg: `src/index.ts` — `McpServer`, alle Tools per `server.registerTool()`; `node dist/index.js setup` startet den OAuth-Einrichtungsassistenten (`src/setup.ts`)
- Tool-Logik: je Tool eine Datei in `src/tools/`
- `src/auth.ts` (Service Account / OAuth, `getConfig()`), `src/oauth.ts`, `src/analytics.ts` (Search-Analytics-Abfragen), `src/inspection.ts`, `src/guardrails.ts` (`GUARDRAIL_SUFFIX`, `VISUAL_SUFFIX`, `withMeta()`)
- Herkunft/Git:
  - Remotes: `origin` = `david-wulf/gsc-mcp`, `hs` = `homeandsmart-gmbh/search-console-mcp`, `upstream` und `sug` = beide Suganthan (doppelt)
  - Eigene Anpassungen: Tools `discover_analysis`, `image_analysis`, `search_appearance`, `query_count`; Dimension-Guard; device/country-Filter; eigene Klickkurve statt Studientabelle; `GSC_SERVICE_ACCOUNT_JSON` aus dem Secret-Manager; vollständige `inspect_url`-Felder; SDK 1.30 + `registerTool`; `site_url` pro Aufruf auf allen Property-Tools (Wrapper um `registerTool` in `index.ts` + `withSiteUrl()`/`AsyncLocalStorage` in `auth.ts`)
  - Upstream ziehen: `git fetch upstream && git merge upstream/main` (Muster: `0e331e5` „Merge upstream v2.5.1 into the fork"), danach README-Fork-Hinweis und `package.json`-Version nachziehen. Beiträge an Upstream laufen als PR von `david-wulf` (vgl. Merge PR #1)

## Tools
- Lesend: `quick_wins`, `ctr_opportunities`, `traffic_drops`, `content_gaps`, `site_snapshot`, `inspect_url`, `cannibalization_check`, `content_decay`, `topic_cluster_performance`, `ctr_vs_benchmark`, `verify_claim`, `advanced_search_analytics`, `check_alerts`, `content_recommendations`, `generate_report`, `multi_site_dashboard`, `list_sitemaps`, `discover_analysis`, `image_analysis`, `search_appearance`, `query_count`, `genai_conversation_queries`, `image_keyword_overview`, `image_search_quick_wins`, `compare_web_vs_image`, `image_pages_overview`, `image_keyword_trends`, `image_impressions_no_clicks`, `image_content_decay`, `image_page_audit` (holt zusätzlich die Seite)
- **Schreibend**: `submit_url`, `submit_batch` (Indexing API), `submit_sitemap` (Sitemap in GSC einreichen)

## Lokal starten & prüfen
```bash
npm install
npm run build        # tsc -> dist/
npm start            # node dist/index.js
```
Keine Tests/Lint im Repo; `npm run build` ist die Typprüfung. Nachweise einzelner Fixes liegen unter `docs/verification/`.

## Einbindung in Claude
- `~/.claude.json`: `gsc` (über `infisical-run.mjs … -- node …\Suganthans-GSC-MCP\dist\index.js`), `gsc-mb24` (direkt `node …/dist/index.js`)
- `claude_desktop_config.json`: `gsc`, `gsc-solakon`, `gsc-markenbaumarkt24`, `gsc-mb24` (direkt `node …/dist/index.js`)
- Ein Build wirkt auf alle Instanzen — nach `npm run build` Claude neu starten.

## Konfiguration
`GSC_AUTH_MODE` (`service_account` Standard | `oauth`), `GSC_SITE_URL` bzw. `GSC_SITE_URLS`, `GSC_SERVICE_ACCOUNT_JSON` (Vorrang) oder `GSC_KEY_FILE`, für OAuth `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_OAUTH_SECRETS_FILE`, `GSC_SCOPES` (`readonly` sperrt Submit-Tools)

## Neues Tool hinzufügen
1. `src/tools/<name>.ts` mit exportierter async-Funktion; Abfragen über `src/analytics.ts`, Auth über `auth.ts`
2. In `src/index.ts` `server.registerTool("<name>", { description: "…" + GUARDRAIL_SUFFIX (+ VISUAL_SUFFIX), inputSchema: { … zod … } }, async (args) => …)`; Ergebnis per `withMeta()` als JSON-Text (Muster: `query_count`)
   `site_url` nicht selbst ins Schema schreiben — der Wrapper ergänzt ihn; Tools ohne Property-Bezug in `NO_PROPERTY_TOOLS` eintragen. Die Property immer über `getConfig().siteUrl` lesen, nie direkt aus `process.env`, und nie als Parameter durch Tool-Funktionen oder `fetchAllRows` reichen; für mehrere Properties in einem Aufruf `withSiteUrl()` (Muster: `multi-site-dashboard.ts`).
3. README-Tabelle „Only in this fork" und Tool-Zahl in `package.json`-`description` anpassen, `npm run build`

## Grenzen
- Keine Schlüssel/Client-Secrets öffnen, ausgeben oder committen (`.gitignore` ignoriert `*.json` außer package/tsconfig/manifest). `src/embedded-client.ts` bleibt leer.
- `submit_url`, `submit_batch`, `submit_sitemap` nur mit ausdrücklicher Freigabe pro Aufruf.

## Offen
- `submit-url.ts` verlangt im Service-Account-Modus `GSC_KEY_FILE`; Instanzen nur mit `GSC_SERVICE_ACCOUNT_JSON` (Infisical-Weg) können damit vermutlich nicht einreichen — nicht geprüft.
- Remotes `upstream` und `sug` zeigen auf dieselbe URL.
