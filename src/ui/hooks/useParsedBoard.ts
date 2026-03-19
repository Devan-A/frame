import { useState, useEffect, useCallback } from 'react';
import type { ParsedBoard, ControllerToUIMessage } from '../../types';

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
export function useParsedBoard(): UseParsedBoardReturn {
  const [data, setData] = useState<ParsedBoard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<{ pluginMessage: ControllerToUIMessage }>) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'PARSING_STARTED':
          setIsLoading(true);
          setError(null);
          break;

        case 'BOARD_DATA':
          setData(msg.payload);
          setIsLoading(false);
          setError(null);
          break;

        case 'PARSE_ERROR':
          setError(msg.message);
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const parseBoard = useCallback(() => {
    setIsLoading(true);
    setError(null);
    parent.postMessage({ pluginMessage: { type: 'PARSE_BOARD' } }, '*');
  }, []);

  const highlightNode = useCallback((nodeId: string) => {
    parent.postMessage({ pluginMessage: { type: 'HIGHLIGHT_NODE', nodeId } }, '*');
  }, []);

  return { data, isLoading, error, parseBoard, highlightNode };
}
