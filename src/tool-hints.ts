/**
 * Werkzeugbeschreibungen fuer Suche und Auswahl (Konvention 2026-11-05).
 *
 * Jede Beschreibung beginnt mit einer Zeile "Typische Fragen" (deutsch, mit englischen
 * Stichworten), danach folgt die Funktionsbeschreibung. So finden Embedding- und Schlagwortsuchen
 * (z. B. die MCP-Werkzeugsuche von LiteLLM) das passende Werkzeug auch fuer deutsche Anfragen.
 * Verhaltensregeln (keine Spekulation, Darstellung, Positions-Hinweis) stehen NICHT in der
 * Beschreibung, sondern kommen ueber withMeta() mit jeder Antwort - das spart Kontext bei jedem
 * Client, der alle Beschreibungen laedt, und verwischt die Suche nicht.
 * Neues Werkzeug: Hinweis hier eintragen; describe() wirft, wenn er fehlt.
 */

export const TOOL_HINTS: Record<string, string> = {
  quick_wins: "Typische Fragen: Welche Keywords stehen knapp vor Seite 1 (Position 4 bis 15)? Wo bringt Optimierung am schnellsten mehr Klicks? Quick wins, striking distance keywords.",
  ctr_opportunities: "Typische Fragen: Welche Seiten ranken gut, bekommen aber zu wenig Klicks? Wo Title und Meta-Description verbessern? Low CTR, snippet optimisation.",
  traffic_drops: "Typische Fragen: Welche Seiten haben zuletzt Klicks verloren, und liegt es an Ranking, CTR oder Nachfrage? Traffic loss, drop diagnosis.",
  content_gaps: "Typische Fragen: Zu welchen Suchanfragen gibt es Nachfrage, aber keinen passenden eigenen Inhalt? Welche Artikel neu schreiben? Content gap, missing topics.",
  site_snapshot: "Typische Fragen: Gesamtüberblick der Website: Klicks, Impressionen, CTR und Position, verglichen mit der Vorperiode. Site overview, KPI summary, total traffic.",
  inspect_url: "Typische Fragen: Ist eine URL bei Google indexiert, und wenn nicht, warum (Canonical, noindex, robots, Crawling)? Index status, URL inspection.",
  cannibalization_check: "Typische Fragen: Konkurrieren mehrere eigene Seiten um dieselbe Suchanfrage? Keyword-Kannibalisierung erkennen. Cannibalisation, duplicate rankings.",
  content_decay: "Typische Fragen: Welche Seiten verlieren über drei Monate stetig Klicks? Veraltete Inhalte finden, die eine Überarbeitung brauchen. Content decay, gradual decline.",
  topic_cluster_performance: "Typische Fragen: Wie schneidet ein Bereich der Website zusammen ab, z. B. alle URLs unter /blog/ oder einer Kategorie? Section, folder, cluster performance.",
  ctr_vs_benchmark: "Typische Fragen: Ist die Klickrate je Seite für ihre Position normal? Welche Seiten liegen unter dem Erwartungswert? CTR benchmark, expected CTR by position.",
  verify_claim: "Typische Fragen: Eine eigene Aussage oder Kennzahl vor dem Berichten gegen Live-Daten prüfen. Fact check, verify a number.",
  advanced_search_analytics: "Typische Fragen: Klicks, Impressionen, CTR und Position für eine bestimmte URL, ein Keyword, ein Land oder Gerät in einem frei gewählten Zeitraum, z. B. einem Kalendermonat; Rohdaten und Exporte. Page-level data, custom query.",
  check_alerts: "Typische Fragen: Gibt es Auffälligkeiten wie Positionsverluste, abstürzende CTR oder aus der Suche verschwundene Seiten? Was zuerst prüfen? Alerts, monitoring.",
  content_recommendations: "Typische Fragen: Was als Nächstes tun: Seiten aktualisieren, neue Inhalte schreiben oder Seiten zusammenlegen? Priorisierte Maßnahmenliste. Content plan, action list.",
  generate_report: "Typische Fragen: Einen Leistungsbericht als Markdown-Datei für regelmäßige Auswertungen erzeugen. Performance report, scheduled reporting.",
  multi_site_dashboard: "Typische Fragen: Mehrere Websites oder Kunden-Properties nebeneinander vergleichen, mit Zustand je Property. Portfolio overview, all sites.",
  submit_url: "Typische Fragen: Indexierung einer einzelnen URL bei Google beantragen (schreibend). Request indexing, Indexing API.",
  submit_batch: "Typische Fragen: Viele URLs auf einmal zur Indexierung schicken, bis 200 je Tag (schreibend). Bulk indexing request.",
  submit_sitemap: "Typische Fragen: Eine Sitemap bei Google einreichen oder erneut melden (schreibend). Submit sitemap.",
  list_sitemaps: "Typische Fragen: Welche Sitemaps sind eingereicht, mit Fehlern, Warnungen und Zahl indexierter Seiten? Sitemap status.",
  discover_analysis: "Typische Fragen: Wie läuft Google Discover: Feed-Traffic, beste Artikel, Länder, Verlauf? Discover performance.",
  image_analysis: "Typische Fragen: Wie schneidet die Website in der Google-Bildersuche insgesamt ab? Image search overview.",
  search_appearance: "Typische Fragen: Wie performen Darstellungsformen wie Rich Results, Händlereinträge, Produkt-Snippets oder Bewertungssterne? Rich result types, merchant listings.",
  query_count: "Typische Fragen: Für wie viele Suchanfragen ist eine Seite, ein Verzeichnis oder die Domain sichtbar, aufgeteilt nach Positionsgruppen? Keyword count, visibility breadth.",
  image_keyword_overview: "Typische Fragen: Mit welchen Suchbegriffen wird die Website in der Bildersuche gefunden? Top image keywords.",
  image_search_quick_wins: "Typische Fragen: Welche Bild-Suchbegriffe stehen knapp vor den Top 3? Image quick wins.",
  compare_web_vs_image: "Typische Fragen: Bei welchen Suchanfragen trägt die Bildersuche im Vergleich zur Websuche viel bei? Web versus image traffic.",
  image_pages_overview: "Typische Fragen: Welche Seiten bekommen Besucher aus der Bildersuche und welche nicht? Image traffic by page.",
  image_keyword_trends: "Typische Fragen: Wie haben sich Bild-Suchbegriffe gegenüber dem Vorzeitraum entwickelt? Image keyword trend.",
  image_impressions_no_clicks: "Typische Fragen: Bilder mit vielen Impressionen und kaum Klicks; wo das Vorschaubild nicht überzeugt. Image impressions without clicks.",
  image_content_decay: "Typische Fragen: Welche Seiten verlieren über Monate Besucher aus der Bildersuche? Image content decay.",
  genai_conversation_queries: "Typische Fragen: Welche Suchanfragen stammen aus der KI-Suche (AI Mode, AI Overviews), etwa Rückfragen und Gesprächsfragmente? AI search queries.",
  image_page_audit: "Typische Fragen: Bilder auf eigenen Seiten auf SEO-Mängel prüfen: Alt-Texte, Dateinamen, Größen, Lazy Loading. Image SEO audit.",
};

/** Werkzeuge, deren Antwort einen Darstellungshinweis (VISUAL_SUFFIX) bekommt. */
export const VISUAL_TOOLS: ReadonlySet<string> = new Set([
  "quick_wins",
  "ctr_opportunities",
  "traffic_drops",
  "content_gaps",
  "site_snapshot",
  "inspect_url",
  "cannibalization_check",
  "content_decay",
  "topic_cluster_performance",
  "ctr_vs_benchmark",
  "advanced_search_analytics",
  "check_alerts",
  "content_recommendations",
  "generate_report",
  "multi_site_dashboard",
  "discover_analysis",
  "image_analysis",
  "search_appearance",
  "query_count",
  "image_keyword_overview",
  "image_search_quick_wins",
  "compare_web_vs_image",
  "image_pages_overview",
  "image_keyword_trends",
  "image_impressions_no_clicks",
  "image_content_decay",
  "genai_conversation_queries",
  "image_page_audit",
]);

/** Werkzeuge mit Positionswerten; ihre Antwort bekommt den Positions-Hinweis (POSITION_CAVEAT). */
export const POSITION_TOOLS: ReadonlySet<string> = new Set([
  "quick_wins",
  "ctr_opportunities",
  "traffic_drops",
  "content_gaps",
  "site_snapshot",
  "cannibalization_check",
  "content_decay",
  "topic_cluster_performance",
  "ctr_vs_benchmark",
  "advanced_search_analytics",
  "check_alerts",
  "multi_site_dashboard",
  "image_keyword_overview",
  "image_search_quick_wins",
  "compare_web_vs_image",
  "image_pages_overview",
  "image_keyword_trends",
  "image_impressions_no_clicks",
  "image_content_decay",
  "genai_conversation_queries",
]);

export function describe(name: string, base: string): string {
  const hint = TOOL_HINTS[name];
  if (!hint) throw new Error(`Kein Suchhinweis fuer Werkzeug ${name} in src/tool-hints.ts`);
  return `${hint} ${base}`;
}
