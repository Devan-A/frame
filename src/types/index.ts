/**
 * Represents a single feature extracted from a participant's section.
 */
export interface Feature {
  /** The numeric index extracted from feature-{n} naming pattern */
  index: number;
  /** Feature title from feature-{n}-title node */
  title: string;
  /** Feature description from feature-{n}-description node */
  description: string;
}

/**
 * Represents a participant within a concept section.
 */
export interface Participant {
  /** The numeric index extracted from participant-{n} naming pattern */
  index: number;
  /** Score from 1-4 parsed from concept-score node, or null if invalid/missing */
  conceptScore: number | null;
  /** All features belonging to this participant */
  features: Feature[];
  /** Reference to the node ID for canvas highlighting */
  nodeId: string;
}

/**
 * Represents a concept section containing multiple participants.
 */
export interface Concept {
  /** The numeric index extracted from concept-{n} naming pattern */
  index: number;
  /** All participants within this concept */
  participants: Participant[];
  /** Computed average of all valid participant conceptScores */
  averageScore: number | null;
  /** All features across all participants, flattened */
  aggregatedFeatures: Feature[];
  /** Reference to the node ID for canvas highlighting */
  nodeId: string;
}

/**
 * The complete parsed board data structure.
 */
export interface ParsedBoard {
  /** All concepts found on the board */
  concepts: Concept[];
  /** Total count of participants across all concepts */
  totalParticipants: number;
  /** Total count of features across all participants */
  totalFeatures: number;
  /** ISO timestamp of when the board was last parsed */
  lastParsed: string;
}

/**
 * Message types sent from UI to plugin controller.
 */
export type UIToControllerMessage =
  | { type: 'PARSE_BOARD' }
  | { type: 'CLOSE_PLUGIN' }
  | { type: 'HIGHLIGHT_NODE'; nodeId: string };

/**
 * Message types sent from plugin controller to UI.
 */
export type ControllerToUIMessage =
  | { type: 'BOARD_DATA'; payload: ParsedBoard }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'PARSING_STARTED' };
