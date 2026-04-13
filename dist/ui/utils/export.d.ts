import type { ParsedBoard } from '../../types';
/**
 * Exports parsed board data as a scores CSV matching the backend's
 * user_concept_scores format:
 *   project_name, participant_id, concept_id, concept_name,
 *   score, features_to_include, feature_description
 *
 * One row per participant-concept combination; features are aggregated.
 */
export declare function exportToScoresCSV(data: ParsedBoard, projectName: string): void;
//# sourceMappingURL=export.d.ts.map