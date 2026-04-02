/**
 * API response types for concept analysis
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

export interface Concept {
  name: string;
  id: string;
  description: string;
}

export interface Insight {
  strong_concensus: string;
  high_disagreement: string;
  other_data_patterns: string;
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

export interface AnalysisResponse {
  prioritized_concept_list: ConceptScore[];
  highest_scoring_concept: Concept;
  insights: Insight[];
  features_and_themes: FeatureTheme[];
}

export interface FeatureScoring {
  participant: string;
  feature_name: string;
  feature_description: string;
  criticality: string;
}

export interface AllFeaturesResponse {
  features: FeatureScoring[];
}
