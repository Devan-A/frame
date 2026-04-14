/**
 * API client for the Lithium converge-diverge backend.
 *
 * All network calls happen inside the UI iframe (the Figma plugin sandbox
 * has no fetch/XMLHttpRequest). Results are forwarded to the controller
 * via postMessage for drawing.
 *
 * Agent workflow (4 tools, 2 human-review interrupts):
 *   1. map_feature_to_themes  → INTERRUPT
 *   2. score_concepts          → INTERRUPT
 *   3. score_features          → (no interrupt)
 *   4. generate_rct_ebc        → (no interrupt)
 */
import type { ParsedBoard } from '../types';
import type { AnalysisResponse } from '../types/api';
export interface ApiConfig {
    baseUrl: string;
}
/**
 * Build the initial user message containing <features_and_needs /> XML.
 * The agent's system prompt instructs it to pass this to map_feature_to_themes.
 */
export declare function buildFeaturesAndNeedsMessage(board: ParsedBoard): string;
/**
 * Build structured JSON for the first resume (after map_feature_to_themes).
 * Matches the UserScoresAndSolutions DTO schema.
 */
export declare function buildUserScoresAndSolutions(board: ParsedBoard, projectName: string): Record<string, unknown>;
/**
 * Build structured JSON for the second resume (after score_concepts).
 * Matches the UserFeatureScores DTO schema (array of items).
 */
export declare function buildUserFeatureScores(board: ParsedBoard, projectName: string): Record<string, unknown>[];
export type ProgressCallback = (step: string, detail?: string) => void;
/**
 * Runs the full converge-diverge analysis pipeline:
 *   create thread → initial run → 2 resume cycles → extract state.
 *
 * @param cfg       Backend URL + API key.
 * @param board     Parsed FigJam board data.
 * @param projectName  Label used in score payloads.
 * @param onProgress   Optional status callback surfaced in the UI.
 * @returns The assembled AnalysisResponse ready for drawing.
 */
export interface RunOptions {
    experimentMode?: boolean;
}
export declare function runFullAnalysis(cfg: ApiConfig, board: ParsedBoard, projectName: string, onProgress?: ProgressCallback, options?: RunOptions): Promise<AnalysisResponse>;
//# sourceMappingURL=api.d.ts.map