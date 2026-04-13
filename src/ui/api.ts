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
import type {
  AnalysisResponse,
  ThreadResponse,
  RunResponse,
  ThreadStateResponse,
  FeatureTheme,
  FeatureScoreItem,
  RtcEbc,
  ConceptScoresResult,
} from '../types/api';

const AGENT_NAME = 'converge-diverge';

// ── Configuration ───────────────────────────────────────────────────────

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

// ── Low-level HTTP helpers ──────────────────────────────────────────────

function headers(cfg: ApiConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) h['X-Api-Key'] = cfg.apiKey;
  return h;
}

async function createThread(cfg: ApiConfig): Promise<string> {
  const res = await fetch(
    `${cfg.baseUrl}/agents/${AGENT_NAME}/threads`,
    { method: 'POST', headers: headers(cfg) },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create thread failed (${res.status}): ${body}`);
  }
  const data: ThreadResponse = await res.json();
  return data.thread_id;
}

async function postRun(
  cfg: ApiConfig,
  threadId: string,
  body: { message?: string; resume?: unknown; config?: Record<string, unknown> },
): Promise<RunResponse> {
  const res = await fetch(
    `${cfg.baseUrl}/agents/${AGENT_NAME}/threads/${threadId}/runs`,
    { method: 'POST', headers: headers(cfg), body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Run failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function getThreadState(
  cfg: ApiConfig,
  threadId: string,
): Promise<ThreadStateResponse> {
  const res = await fetch(
    `${cfg.baseUrl}/agents/${AGENT_NAME}/threads/${threadId}`,
    { headers: headers(cfg) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get thread state failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Data transformation: ParsedBoard → backend input formats ────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the initial user message containing <features_and_needs /> XML.
 * The agent's system prompt instructs it to pass this to map_feature_to_themes.
 */
export function buildFeaturesAndNeedsMessage(board: ParsedBoard): string {
  const features = new Set<string>();
  const needs = new Set<string>();

  for (const concept of board.concepts) {
    for (const participant of concept.participants) {
      for (const f of participant.features) {
        if (f.title && f.title !== '[untitled]') features.add(f.title);
        if (f.description && f.description !== '[no description]') needs.add(f.description);
      }
    }
  }

  const featureItems = Array.from(features)
    .map((f) => `    <item>${escapeXml(f)}</item>`)
    .join('\n');
  const needItems = Array.from(needs)
    .map((n) => `    <item>${escapeXml(n)}</item>`)
    .join('\n');

  return [
    '<features_and_needs>',
    '  <features_list>',
    featureItems,
    '  </features_list>',
    '  <user_needs>',
    needItems,
    '  </user_needs>',
    '</features_and_needs>',
  ].join('\n');
}

/**
 * Build structured JSON for the first resume (after map_feature_to_themes).
 * Matches the UserScoresAndSolutions DTO schema.
 */
export function buildUserScoresAndSolutions(
  board: ParsedBoard,
  projectName: string,
): Record<string, unknown> {
  const userConceptScores: Record<string, unknown>[] = [];
  const solutionConcepts: Record<string, unknown>[] = [];

  for (const concept of board.concepts) {
    solutionConcepts.push({
      id: `concept-${concept.index}`,
      name: `Concept ${concept.index}`,
      description: concept.aggregatedFeatures.map((f) => f.title).join(', '),
    });

    for (const participant of concept.participants) {
      userConceptScores.push({
        project_name: projectName,
        participant_id: `participant-${participant.index}`,
        concept_id: `concept-${concept.index}`,
        concept_name: `Concept ${concept.index}`,
        score: participant.conceptScore ?? 1,
        features_to_include: participant.features.map((f) => f.title).join(', '),
        feature_description: participant.features.map((f) => f.description).join('; '),
      });
    }
  }

  return { user_concept_scores: userConceptScores, solution_concepts: solutionConcepts };
}

/**
 * Build structured JSON for the second resume (after score_concepts).
 * Matches the UserFeatureScores DTO schema (array of items).
 */
export function buildUserFeatureScores(
  board: ParsedBoard,
  projectName: string,
): Record<string, unknown>[] {
  const scores: Record<string, unknown>[] = [];

  for (const concept of board.concepts) {
    for (const participant of concept.participants) {
      for (const feature of participant.features) {
        scores.push({
          project_name: projectName,
          participant_id: `participant-${participant.index}`,
          feature: feature.title,
          need: feature.description !== '[no description]' ? feature.description : feature.title,
          criticality: 'Medium',
        });
      }
    }
  }

  return scores;
}

// ── State normalisation (xml_pydantic model_dump shapes can vary) ───────

function normalizeArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const vals = Object.values(raw as Record<string, unknown>);
    for (const v of vals) {
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function normalizeFeatureThemes(raw: unknown): FeatureTheme[] {
  const arr = normalizeArray(raw);
  return arr.map((item: any) => ({
    feature: item.feature ?? '',
    rationale: item.rationale ?? '',
    theme: {
      title: item.theme?.title ?? '',
      need: item.theme?.need ?? '',
    },
  }));
}

function normalizeConceptScores(raw: unknown): ConceptScoresResult {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;

  const rawList = Array.isArray(obj.prioritized_concept_list)
    ? obj.prioritized_concept_list
    : [];

  const list = rawList.map((c: any) => ({
    name: c.name ?? c.concept_name ?? '',
    id: c.id ?? c.concept_id ?? '',
    rank: c.rank ?? 0,
    need: c.need ?? null,
    average_z_score: c.average_z_score ?? c.mean_raw_score ?? 0,
    disagreement: c.disagreement ?? 0,
    concensus_weight: c.concensus_weight ?? c.consensus_weight ?? 1,
    final_score: c.final_score ?? 0,
  }));

  const hsc = obj.highest_scoring_concept ?? {};
  const insights = Array.isArray(obj.insights)
    ? obj.insights.map((i: any) => (typeof i === 'string' ? i : JSON.stringify(i)))
    : [];

  return {
    prioritized_concept_list: list,
    highest_scoring_concept: {
      name: hsc.name ?? '',
      id: hsc.id ?? '',
      description: hsc.description ?? '',
    },
    insights,
  };
}

function normalizeFeatureScores(raw: unknown): FeatureScoreItem[] {
  const arr = normalizeArray(raw);
  return arr.map((item: any) => ({
    feature: item.feature ?? '',
    need: item.need ?? '',
    'final-score': item['final-score'] ?? item.final_score ?? 0,
  }));
}

function normalizeRtcEbc(raw: unknown): RtcEbc {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  return {
    role: obj.role ?? '',
    task: obj.task ?? '',
    context: obj.context ?? '',
    elements: obj.elements ?? '',
    behaviors: obj.behaviors ?? '',
    constraints: obj.constraints ?? '',
  };
}

/** Assemble a clean AnalysisResponse from raw thread state values. */
function extractAnalysis(values: Record<string, unknown>): AnalysisResponse {
  const cs = normalizeConceptScores(values.concept_scores);
  return {
    prioritized_concept_list: cs.prioritized_concept_list,
    highest_scoring_concept: cs.highest_scoring_concept,
    insights: cs.insights,
    features_and_themes: normalizeFeatureThemes(values.features_and_themes),
    feature_scores: normalizeFeatureScores(values.feature_scores),
    rtc_ebc: normalizeRtcEbc(values.rtc_ebc),
  };
}

// ── Full analysis orchestration ─────────────────────────────────────────

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
export async function runFullAnalysis(
  cfg: ApiConfig,
  board: ParsedBoard,
  projectName: string,
  onProgress?: ProgressCallback,
): Promise<AnalysisResponse> {
  onProgress?.('Creating conversation thread…');
  const threadId = await createThread(cfg);

  // Step 1: send features_and_needs → agent calls map_feature_to_themes → interrupts
  onProgress?.('Sending board data to agent…', 'Step 1/4 — mapping features to themes');
  const initialMessage = buildFeaturesAndNeedsMessage(board);
  await postRun(cfg, threadId, { message: initialMessage });

  let state = await getThreadState(cfg, threadId);

  // Step 2: if interrupted, resume with user_scores_and_solutions
  if (state.next.length > 0) {
    onProgress?.('Providing concept scores…', 'Step 2/4 — scoring concepts');
    const scoresPayload = buildUserScoresAndSolutions(board, projectName);
    await postRun(cfg, threadId, { resume: scoresPayload });

    state = await getThreadState(cfg, threadId);
  }

  // Step 3+4: if interrupted again, resume with user_feature_scores.
  // score_features and generate_rct_ebc run back-to-back without an
  // interrupt, so this single resume covers both steps.
  if (state.next.length > 0) {
    onProgress?.('Providing feature scores…', 'Step 3/4 — scoring features');
    const featurePayload = buildUserFeatureScores(board, projectName);
    await postRun(cfg, threadId, { resume: featurePayload });

    onProgress?.('Generating RTC-EBC framework…', 'Step 4/4 — final synthesis');
    state = await getThreadState(cfg, threadId);
  }

  // Edge case: if still paused, nudge the agent forward.
  if (state.next.length > 0) {
    onProgress?.('Finalising analysis…');
    await postRun(cfg, threadId, { resume: '' });
    state = await getThreadState(cfg, threadId);
  }

  onProgress?.('Extracting results…');
  return extractAnalysis(state.values);
}
