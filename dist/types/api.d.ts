/**
 * Backend API types aligned with the Lithium converge-diverge agent.
 *
 * Thread state keys after a complete run:
 *   concept_scores   → ConceptScoresResult
 *   features_and_themes → FeatureTheme[]
 *   feature_scores   → FeatureScoreItem[]
 *   rtc_ebc          → RtcEbc
 */
export interface ConceptScore {
    name: string;
    id: string;
    rank: number;
    need: string | null;
    average_z_score: number;
    disagreement: number;
    concensus_weight: number;
    final_score: number;
}
export interface HighestScoringConcept {
    name: string;
    id: string;
    description: string;
}
export interface ConceptScoresResult {
    prioritized_concept_list: ConceptScore[];
    highest_scoring_concept: HighestScoringConcept;
    insights: string[];
}
export interface Theme {
    title: string;
    need: string;
}
export interface FeatureTheme {
    theme: Theme;
    feature: string;
    rationale: string;
}
export interface FeatureScoreItem {
    feature: string;
    need: string;
    'final-score': number;
}
export interface RtcEbc {
    role: string;
    task: string;
    context: string;
    elements: string;
    behaviors: string;
    constraints: string;
}
export interface AnalysisResponse {
    prioritized_concept_list: ConceptScore[];
    highest_scoring_concept: HighestScoringConcept;
    insights: string[];
    features_and_themes: FeatureTheme[];
    feature_scores: FeatureScoreItem[];
    rtc_ebc: RtcEbc;
}
export interface ThreadResponse {
    thread_id: string;
}
export interface RunResponse {
    thread_id: string;
    type: string;
    content: unknown;
}
export interface ThreadStateResponse {
    thread_id: string;
    next: string[];
    values: Record<string, unknown>;
}
//# sourceMappingURL=api.d.ts.map