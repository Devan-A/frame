import type { ParsedBoard } from '../../types';
interface UseParsedBoardReturn {
    data: ParsedBoard | null;
    isLoading: boolean;
    error: string | null;
    parseBoard: () => void;
    highlightNode: (nodeId: string) => void;
}
/**
 * Custom hook for managing board parsing state and communication with the plugin controller.
 */
export declare function useParsedBoard(): UseParsedBoardReturn;
export {};
//# sourceMappingURL=useParsedBoard.d.ts.map