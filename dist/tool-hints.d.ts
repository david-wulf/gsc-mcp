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
export declare const TOOL_HINTS: Record<string, string>;
/** Werkzeuge, deren Antwort einen Darstellungshinweis (VISUAL_SUFFIX) bekommt. */
export declare const VISUAL_TOOLS: ReadonlySet<string>;
/** Werkzeuge mit Positionswerten; ihre Antwort bekommt den Positions-Hinweis (POSITION_CAVEAT). */
export declare const POSITION_TOOLS: ReadonlySet<string>;
export declare function describe(name: string, base: string): string;
