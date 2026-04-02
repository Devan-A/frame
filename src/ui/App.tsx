import React from 'react';
import { useParsedBoard } from './hooks/useParsedBoard';
import { ConceptCard } from './components/ConceptCard';
import { EmptyState } from './components/EmptyState';
import { BoardIcon } from './components/icons/BoardIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { exportToJSON, exportToCSV } from './utils/export';

export default function App() {
  const { data, isLoading, isAnalyzing, error, analysisResult, parseBoard, analyzeBoard, highlightNode } = useParsedBoard();

  const handleExportJSON = () => {
    if (data) {
      exportToJSON(data);
    }
  };

  const handleExportCSV = () => {
    if (data) {
      exportToCSV(data);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--figma-color-bg)]">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-[var(--figma-color-border)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🧠</span>
          <h1 className="text-sm font-semibold text-[var(--figma-color-text)]">
            Concept Board Parser
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={parseBoard}
            disabled={isLoading || isAnalyzing}
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="w-4 h-4" />
                Parsing...
              </>
            ) : (
              'Parse Board'
            )}
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={analyzeBoard}
            disabled={isLoading || isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <SpinnerIcon className="w-4 h-4" />
                Analyzing...
              </>
            ) : (
              'Analyze & Draw'
            )}
          </button>
        </div>
      </header>

      {/* Summary bar */}
      {data && (
        <div className="flex-shrink-0 px-4 py-2 bg-[var(--figma-color-bg-secondary)] border-b border-[var(--figma-color-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[var(--figma-color-text-secondary)]">
              <span>
                <strong className="text-[var(--figma-color-text)]">{data.concepts.length}</strong>{' '}
                concept{data.concepts.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[var(--figma-color-border)]">·</span>
              <span>
                <strong className="text-[var(--figma-color-text)]">{data.totalParticipants}</strong>{' '}
                participant{data.totalParticipants !== 1 ? 's' : ''}
              </span>
              <span className="text-[var(--figma-color-border)]">·</span>
              <span>
                <strong className="text-[var(--figma-color-text)]">{data.totalFeatures}</strong>{' '}
                feature{data.totalFeatures !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                className="btn-secondary text-[10px] px-2 py-1"
                onClick={handleExportJSON}
                title="Export as JSON"
              >
                JSON
              </button>
              <button
                className="btn-secondary text-[10px] px-2 py-1"
                onClick={handleExportCSV}
                title="Export as CSV"
              >
                CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Result Banner */}
      {analysisResult && (
        <div className="flex-shrink-0 px-4 py-2 bg-green-900/30 border-b border-green-700">
          <p className="text-xs text-green-300 font-medium">Analysis Complete</p>
          <p className="text-xs text-green-200 mt-1">
            Updated {analysisResult.length} sections on the board
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-3 py-3">
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-3">
            <p className="text-xs text-red-300 font-medium">Error</p>
            <p className="text-xs text-red-200 mt-1">{error}</p>
          </div>
        )}

        {!data && !isLoading && !error && (
          <EmptyState
            icon={<BoardIcon />}
            title="No data yet"
            description="Click 'Parse Board' to scan your FigJam board for concepts, participants, and features."
          />
        )}

        {data && data.concepts.length === 0 && (
          <EmptyState
            icon={<BoardIcon />}
            title="No concepts found"
            description="Make sure your sections follow the naming convention: concept-1, concept-2, etc."
          />
        )}

        {data && data.concepts.length > 0 && (
          <div className="space-y-3">
            {data.concepts.map((concept) => (
              <ConceptCard
                key={concept.index}
                concept={concept}
                onHighlightNode={highlightNode}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      {data && (
        <footer className="flex-shrink-0 px-4 py-2 border-t border-[var(--figma-color-border)] bg-[var(--figma-color-bg)]">
          <p className="text-[10px] text-[var(--figma-color-text-tertiary)] text-center">
            Last parsed: {new Date(data.lastParsed).toLocaleString()}
          </p>
        </footer>
      )}
    </div>
  );
}
