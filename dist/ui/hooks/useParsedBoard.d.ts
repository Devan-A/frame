import type { ParsedBoard } from '../../types';
import { type ApiConfig } from '../api';
export interface StepLogEntry {
    step: string;
    detail?: string;
    timestamp: number;
}
export interface AnalysisProgress {
    step: string;
    detail?: string;
}
interface UseParsedBoardReturn {
    data: ParsedBoard | null;
    isLoading: boolean;
    isAnalyzing: boolean;
    error: string | null;
    analysisResult: string[] | null;
    progress: AnalysisProgress | null;
    /** Accumulated log of every step with timestamps. */
    stepLog: StepLogEntry[];
    /** Elapsed milliseconds since analysis started (updates every 100ms). */
    elapsedMs: number;
    /** Whether analysis just completed (stays true until next run). */
    justFinished: boolean;
    parseBoard: () => void;
    analyzeBoardApi: (cfg: ApiConfig, projectName: string) => void;
    highlightNode: (nodeId: string) => void;
    /** Clear the "just finished" celebration state. */
    dismissFinished: () => void;
}
export declare function useParsedBoard(): UseParsedBoardReturn;
export {};
//# sourceMappingURL=useParsedBoard.d.ts.map