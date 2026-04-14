import { useState, useEffect, useCallback, useRef } from 'react';
import type { ParsedBoard, ControllerToUIMessage } from '../../types';
import type { AnalysisResponse } from '../../types/api';
import { runFullAnalysis, type ApiConfig, type ProgressCallback, type RunOptions } from '../api';

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
  analyzeBoardApi: (cfg: ApiConfig, projectName: string, options?: RunOptions) => void;
  highlightNode: (nodeId: string) => void;
  /** Clear the "just finished" celebration state. */
  dismissFinished: () => void;
}

export function useParsedBoard(): UseParsedBoardReturn {
  const [data, setData] = useState<ParsedBoard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [stepLog, setStepLog] = useState<StepLogEntry[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [justFinished, setJustFinished] = useState(false);

  const pendingParseResolve = useRef<((board: ParsedBoard) => void) | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(function () {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedMs(Date.now() - startTimeRef.current);
  }

  useEffect(function () {
    return function () {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(function () {
    var handleMessage = function (event: MessageEvent<{ pluginMessage: ControllerToUIMessage }>) {
      var msg = event.data.pluginMessage;
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
          if (pendingParseResolve.current) {
            pendingParseResolve.current(msg.payload);
            pendingParseResolve.current = null;
          }
          break;

        case 'PARSE_ERROR':
          setError(msg.message);
          setIsLoading(false);
          if (pendingParseResolve.current) {
            pendingParseResolve.current = null;
          }
          break;

        case 'ANALYSIS_STARTED':
          setIsAnalyzing(true);
          setError(null);
          setAnalysisResult(null);
          break;

        case 'ANALYSIS_COMPLETE': {
          var sections: string[] = (msg as any).sectionsUpdated || [];
          setIsAnalyzing(false);
          setProgress(null);
          setAnalysisResult(sections);
          stopTimer();
          setStepLog(function (prev) {
            return prev.concat([{
              step: 'Done!',
              detail: 'Board updated with ' + sections.length + ' sections',
              timestamp: Date.now() - startTimeRef.current,
            }]);
          });
          setJustFinished(true);
          break;
        }

        case 'ANALYSIS_ERROR':
          setIsAnalyzing(false);
          setProgress(null);
          stopTimer();
          setError(msg.message);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return function () { window.removeEventListener('message', handleMessage); };
  }, []);

  var parseBoard = useCallback(function () {
    setIsLoading(true);
    setError(null);
    parent.postMessage({ pluginMessage: { type: 'PARSE_BOARD' } }, '*');
  }, []);

  var ensureParsedBoard = useCallback(function (): Promise<ParsedBoard> {
    if (data) return Promise.resolve(data);
    return new Promise<ParsedBoard>(function (resolve) {
      pendingParseResolve.current = resolve;
      parent.postMessage({ pluginMessage: { type: 'PARSE_BOARD' } }, '*');
    });
  }, [data]);

  var analyzeBoardApi = useCallback(
    function (cfg: ApiConfig, projectName: string, options?: RunOptions) {
      setIsAnalyzing(true);
      setError(null);
      setAnalysisResult(null);
      setJustFinished(false);
      setStepLog([]);
      setProgress({ step: 'Parsing board…' });
      startTimer();

      setStepLog([{ step: 'Parsing board…', timestamp: 0 }]);

      (async function () {
        try {
          var board = await ensureParsedBoard();

          var onProgress: ProgressCallback = function (step, detail) {
            setProgress({ step: step, detail: detail });
            setStepLog(function (prev) {
              return prev.concat([{
                step: step,
                detail: detail,
                timestamp: Date.now() - startTimeRef.current,
              }]);
            });
          };

          var analysis: AnalysisResponse = await runFullAnalysis(
            cfg,
            board,
            projectName,
            onProgress,
            options,
          );

          setProgress({ step: 'Drawing results on board…' });
          setStepLog(function (prev) {
            return prev.concat([{
              step: 'Drawing results on board…',
              timestamp: Date.now() - startTimeRef.current,
            }]);
          });

          parent.postMessage(
            {
              pluginMessage: {
                type: 'DRAW_RESULTS',
                analysis: analysis,
                parsedBoard: board,
                experimentMode: options?.experimentMode ?? false,
              },
            },
            '*',
          );
        } catch (err) {
          var message = err instanceof Error ? err.message : String(err);
          setIsAnalyzing(false);
          setProgress(null);
          stopTimer();
          setError(message);
        }
      })();
    },
    [ensureParsedBoard],
  );

  var highlightNode = useCallback(function (nodeId: string) {
    parent.postMessage({ pluginMessage: { type: 'HIGHLIGHT_NODE', nodeId: nodeId } }, '*');
  }, []);

  var dismissFinished = useCallback(function () {
    setJustFinished(false);
  }, []);

  return {
    data: data,
    isLoading: isLoading,
    isAnalyzing: isAnalyzing,
    error: error,
    analysisResult: analysisResult,
    progress: progress,
    stepLog: stepLog,
    elapsedMs: elapsedMs,
    justFinished: justFinished,
    parseBoard: parseBoard,
    analyzeBoardApi: analyzeBoardApi,
    highlightNode: highlightNode,
    dismissFinished: dismissFinished,
  };
}
