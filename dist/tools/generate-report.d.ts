interface ReportResult {
    filePath: string;
    sectionsIncluded: string[];
    summary: string;
}
/**
 * Reports are written only into one folder: GSC_REPORT_DIR, or the server's
 * working directory when that is unset. output_path is a file name, not a
 * path, so an agent steered by injected content cannot write elsewhere, and
 * an existing file is never overwritten (a -2, -3 ... suffix is added).
 */
export declare function reportDirectory(): string;
export declare function reportFileName(outputName: string | undefined, date: string): string;
/** Writes content into dir under fileName without overwriting; returns the path actually written. */
export declare function writeReportFile(dir: string, fileName: string, content: string): string;
export declare function generateReport(outputPath?: string, days?: number, includeSections?: string[]): Promise<ReportResult>;
export {};
