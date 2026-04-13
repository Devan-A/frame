import React, { useState } from 'react';
import { useParsedBoard } from './hooks/useParsedBoard';
import type { StepLogEntry } from './hooks/useParsedBoard';
import { ConceptCard } from './components/ConceptCard';
import { EmptyState } from './components/EmptyState';
import { BoardIcon } from './components/icons/BoardIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { Confetti } from './components/Confetti';
import { exportToScoresCSV } from './utils/export';

var STORAGE_KEY_URL = 'coe-backend-url';
var STORAGE_KEY_KEY = 'coe-api-key';
var STORAGE_KEY_PROJECT = 'coe-project-name';

function loadSaved(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (_e) {
    return fallback;
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (_e) { /* noop */ }
}

function formatMs(ms: number): string {
  var secs = Math.floor(ms / 1000);
  var mins = Math.floor(secs / 60);
  var s = secs % 60;
  if (mins > 0) return mins + 'm ' + (s < 10 ? '0' : '') + s + 's';
  var tenths = Math.floor((ms % 1000) / 100);
  return s + '.' + tenths + 's';
}

function StepTimeline(props: { steps: StepLogEntry[]; analyzing: boolean }) {
  var steps = props.steps;
  var analyzing = props.analyzing;
  return (
    <div className="step-timeline space-y-3">
      {steps.map(function (entry, i) {
        var isLast = i === steps.length - 1;
        var isDone = entry.step === 'Done!';
        return (
          <div
            key={i}
            className="relative anim-step-enter"
            style={{ animationDelay: i * 50 + 'ms' }}
          >
            <div className={'step-dot' + (isDone ? ' done' : '')} />
            <div className="flex items-baseline justify-between gap-2">
              <p className={
                'text-xs font-medium ' +
                (isDone
                  ? 'text-[var(--color-green)]'
                  : isLast && analyzing
                  ? 'text-[var(--color-green)]'
                  : 'text-[var(--figma-color-text-secondary)]')
              }>
                {entry.step}
                {isLast && analyzing && (
                  <span className="dot-pulse ml-1 inline-flex gap-0.5">
                    <span className="inline-block w-1 h-1 rounded-full" style={{ background: 'var(--color-green)' }} />
                    <span className="inline-block w-1 h-1 rounded-full" style={{ background: 'var(--color-green)' }} />
                    <span className="inline-block w-1 h-1 rounded-full" style={{ background: 'var(--color-green)' }} />
                  </span>
                )}
              </p>
              <span className="text-[10px] text-[var(--figma-color-text-tertiary)] tabular-nums whitespace-nowrap">
                {formatMs(entry.timestamp)}
              </span>
            </div>
            {entry.detail && (
              <p className="text-[10px] text-[var(--figma-color-text-tertiary)] mt-0.5">
                {entry.detail}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function HumanaLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4v16M18 4v16M6 12h12"
        stroke="#00A648"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  var hook = useParsedBoard();
  var data = hook.data;
  var isLoading = hook.isLoading;
  var isAnalyzing = hook.isAnalyzing;
  var error = hook.error;
  var analysisResult = hook.analysisResult;
  var progress = hook.progress;
  var stepLog = hook.stepLog;
  var elapsedMs = hook.elapsedMs;
  var justFinished = hook.justFinished;
  var parseBoard = hook.parseBoard;
  var analyzeBoardApi = hook.analyzeBoardApi;
  var highlightNode = hook.highlightNode;
  var dismissFinished = hook.dismissFinished;

  var _bu = useState(function () { return loadSaved(STORAGE_KEY_URL, 'http://localhost:8000'); });
  var backendUrl = _bu[0]; var setBackendUrl = _bu[1];
  var _ak = useState(function () { return loadSaved(STORAGE_KEY_KEY, ''); });
  var apiKey = _ak[0]; var setApiKey = _ak[1];
  var _pn = useState(function () { return loadSaved(STORAGE_KEY_PROJECT, 'Concept Board'); });
  var projectName = _pn[0]; var setProjectName = _pn[1];
  var _ss = useState(false);
  var showSettings = _ss[0]; var setShowSettings = _ss[1];

  var handleBackendUrlChange = function (e: React.ChangeEvent<HTMLInputElement>) {
    setBackendUrl(e.target.value);
    persist(STORAGE_KEY_URL, e.target.value);
  };
  var handleApiKeyChange = function (e: React.ChangeEvent<HTMLInputElement>) {
    setApiKey(e.target.value);
    persist(STORAGE_KEY_KEY, e.target.value);
  };
  var handleProjectNameChange = function (e: React.ChangeEvent<HTMLInputElement>) {
    setProjectName(e.target.value);
    persist(STORAGE_KEY_PROJECT, e.target.value);
  };

  var handleAnalyzeApi = function () {
    analyzeBoardApi({ baseUrl: backendUrl.replace(/\/+$/, ''), apiKey: apiKey }, projectName);
  };

  var handleExportScoresCSV = function () {
    if (data) exportToScoresCSV(data, projectName);
  };

  var busy = isLoading || isAnalyzing;

  return (
    <div className="flex flex-col h-screen bg-[var(--figma-color-bg)]">
      <Confetti active={justFinished} duration={3500} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[var(--figma-color-border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-green-light)' }}
            >
              <HumanaLogo />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--figma-color-text)] leading-tight">Diverge & Converge</h1>
              <p className="text-[10px] text-[var(--figma-color-text-tertiary)]">CoE Workshop Analyzer</p>
            </div>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--figma-color-text-tertiary)] hover:text-[var(--figma-color-text)] hover:bg-[var(--figma-color-bg-tertiary)] transition-all duration-200"
            onClick={function () { setShowSettings(function (v) { return !v; }); }}
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mb-3 p-3 rounded-xl bg-[var(--figma-color-bg-secondary)] border border-[var(--figma-color-border)] space-y-2.5 anim-slide-down">
            <label className="block">
              <span className="text-[10px] font-semibold text-[var(--figma-color-text-secondary)] uppercase tracking-wider">
                Backend URL
              </span>
              <input
                type="text"
                value={backendUrl}
                onChange={handleBackendUrlChange}
                placeholder="http://localhost:8000"
                className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-[var(--figma-color-border)] bg-white text-[var(--figma-color-text)] placeholder-[var(--figma-color-text-tertiary)] focus:outline-none focus:border-[var(--color-green)] transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-[var(--figma-color-text-secondary)] uppercase tracking-wider">
                API Key (Anthropic)
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="sk-ant-…"
                className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-[var(--figma-color-border)] bg-white text-[var(--figma-color-text)] placeholder-[var(--figma-color-text-tertiary)] focus:outline-none focus:border-[var(--color-green)] transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-[var(--figma-color-text-secondary)] uppercase tracking-wider">
                Project Name
              </span>
              <input
                type="text"
                value={projectName}
                onChange={handleProjectNameChange}
                placeholder="Concept Board"
                className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-[var(--figma-color-border)] bg-white text-[var(--figma-color-text)] placeholder-[var(--figma-color-text-tertiary)] focus:outline-none focus:border-[var(--color-green)] transition-colors"
              />
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2"
            onClick={parseBoard}
            disabled={busy}
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="w-3.5 h-3.5" />
                <span>Parsing…</span>
              </>
            ) : (
              <span>Parse Board</span>
            )}
          </button>
          <button
            className={'btn-primary flex-1 flex items-center justify-center gap-1.5' + (isAnalyzing ? ' pulse-glow' : '')}
            onClick={handleAnalyzeApi}
            disabled={busy}
          >
            {isAnalyzing ? (
              <>
                <SpinnerIcon className="w-3.5 h-3.5" />
                <span>Analyzing…</span>
              </>
            ) : (
              <span>Analyze</span>
            )}
          </button>
        </div>

        {/* Timer during analysis */}
        {isAnalyzing && (
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-[var(--figma-color-text-tertiary)] anim-fade-in">
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-green)' }} />
            <span className="tabular-nums">{formatMs(elapsedMs)}</span>
          </div>
        )}
      </header>

      {/* ── Step timeline during analysis ──────────────────────────────── */}
      {(isAnalyzing || justFinished) && stepLog.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--figma-color-border)] anim-fade-in" style={{ background: 'var(--color-green-light)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] font-semibold text-[var(--figma-color-text-secondary)] uppercase tracking-wider">
              Agent Progress
            </h2>
            {!isAnalyzing && (
              <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--color-green)' }}>
                {formatMs(elapsedMs)} total
              </span>
            )}
          </div>
          <StepTimeline steps={stepLog} analyzing={isAnalyzing} />
        </div>
      )}

      {/* ── Summary bar ────────────────────────────────────────────────── */}
      {data && !isAnalyzing && (
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-[var(--figma-color-border)] bg-[var(--figma-color-bg-secondary)] anim-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[var(--figma-color-text-secondary)]">
              <span>
                <strong className="text-[var(--figma-color-text)]">{data.concepts.length}</strong>{' '}
                concept{data.concepts.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[var(--figma-color-border)]">/</span>
              <span>
                <strong className="text-[var(--figma-color-text)]">{data.totalParticipants}</strong>{' '}
                participant{data.totalParticipants !== 1 ? 's' : ''}
              </span>
              <span className="text-[var(--figma-color-border)]">/</span>
              <span>
                <strong className="text-[var(--figma-color-text)]">{data.totalFeatures}</strong>{' '}
                feature{data.totalFeatures !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              className="btn-secondary flex items-center gap-1 text-[10px] px-2 py-1"
              onClick={handleExportScoresCSV}
              title="Export scores as CSV"
            >
              <DownloadIcon />
              <span>Scores CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Success banner ─────────────────────────────────────────────── */}
      {justFinished && analysisResult && (
        <div
          className="flex-shrink-0 mx-4 mt-3 p-3 rounded-xl border anim-success"
          style={{ background: 'var(--color-green-light)', borderColor: 'rgba(0, 166, 72, 0.3)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg" style={{ color: 'var(--color-green)' }}>{'✓'}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-green-dark)' }}>Analysis Complete!</p>
                <p className="text-[10px] text-[var(--figma-color-text-secondary)] mt-0.5">
                  Updated {analysisResult.length} section{analysisResult.length !== 1 ? 's' : ''} in {formatMs(elapsedMs)}
                </p>
              </div>
            </div>
            <button
              className="text-[10px] text-[var(--figma-color-text-tertiary)] hover:text-[var(--figma-color-text)] transition-colors px-2 py-1"
              onClick={dismissFinished}
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="rounded-xl p-3 mb-3 border border-red-200 bg-red-50 anim-fade-in">
            <p className="text-xs text-red-600 font-semibold">Error</p>
            <p className="text-xs text-red-500 mt-1 break-words">{error}</p>
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
            {data.concepts.map(function (concept, i) {
              return (
                <div
                  key={concept.index}
                  className="anim-slide-up"
                  style={{ animationDelay: i * 60 + 'ms' }}
                >
                  <ConceptCard
                    concept={concept}
                    onHighlightNode={highlightNode}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {data && (
        <footer className="flex-shrink-0 px-4 py-2 border-t border-[var(--figma-color-border)] bg-[var(--figma-color-bg-secondary)]">
          <p className="text-[10px] text-[var(--figma-color-text-tertiary)] text-center">
            Last parsed: {new Date(data.lastParsed).toLocaleString()}
          </p>
        </footer>
      )}
    </div>
  );
}
