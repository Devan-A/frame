import type {
  Feature,
  Participant,
  Concept,
  ParsedBoard,
  UIToControllerMessage,
} from '../types';
import type { AnalysisResponse } from '../types/api';
import { mockAnalysisResponse, generateMockFeatureScoring } from './mockData';

const CONCEPT_PATTERN = /^concept-(\d+)$/i;
const PARTICIPANT_PATTERN = /^participant-(\d+)$/i;
const FEATURE_PATTERN = /^feature-(\d+)$/i;
const CONCEPT_SCORE_NAME = 'concept-score';

/**
 * Checks if a node is a container type (Frame, Group, or Section).
 */
function isContainerNode(node: SceneNode): node is FrameNode | GroupNode | SectionNode {
  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION';
}

/**
 * Checks if a node can contain text content.
 */
function isTextBearingNode(node: SceneNode): boolean {
  return node.type === 'TEXT' || node.type === 'STICKY' || node.type === 'SHAPE_WITH_TEXT';
}

/**
 * Extracts text content from a node.
 * Handles TEXT, STICKY, SHAPE_WITH_TEXT nodes directly.
 * For containers, recursively searches for the first text-bearing child.
 */
function extractText(node: SceneNode): string {
  if (node.type === 'TEXT') {
    return node.characters.trim();
  }

  if (node.type === 'STICKY') {
    return node.text.characters.trim();
  }

  if (node.type === 'SHAPE_WITH_TEXT') {
    return node.text.characters.trim();
  }

  if (isContainerNode(node) && 'children' in node) {
    for (const child of node.children) {
      const text = extractText(child);
      if (text) {
        return text;
      }
    }
  }

  return '';
}

/**
 * Finds a direct or nested child with a specific name (case-insensitive).
 */
function findChildByName(
  parent: FrameNode | GroupNode | SectionNode,
  name: string
): SceneNode | null {
  const normalizedName = name.toLowerCase().trim();

  for (const child of parent.children) {
    if (child.name.toLowerCase().trim() === normalizedName) {
      return child;
    }
  }

  for (const child of parent.children) {
    if (isContainerNode(child)) {
      const found = findChildByName(child, name);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Finds all children matching a regex pattern (searches recursively).
 */
function findChildrenByPattern(
  parent: FrameNode | GroupNode | SectionNode,
  pattern: RegExp
): { node: SceneNode; match: RegExpMatchArray }[] {
  const results: { node: SceneNode; match: RegExpMatchArray }[] = [];

  function searchRecursive(node: SceneNode) {
    const match = node.name.toLowerCase().trim().match(pattern);
    if (match) {
      results.push({ node, match });
    }
    if (isContainerNode(node) && 'children' in node) {
      for (const child of node.children) {
        searchRecursive(child);
      }
    }
  }

  for (const child of parent.children) {
    searchRecursive(child);
  }

  return results;
}

/**
 * Parses a feature from a feature-{n} container node or directly from title/description nodes.
 */
function parseFeature(
  featureNode: SceneNode,
  featureIndex: number,
  participantNode?: FrameNode | GroupNode | SectionNode
): Feature {
  let title = '[untitled]';
  let description = '[no description]';

  if (isContainerNode(featureNode)) {
    const titleNode = findChildByName(featureNode, `feature-${featureIndex}-title`);
    const descNode = findChildByName(featureNode, `feature-${featureIndex}-description`);

    if (titleNode) {
      const extractedTitle = extractText(titleNode);
      if (extractedTitle) {
        title = extractedTitle;
      }
    }

    if (descNode) {
      const extractedDesc = extractText(descNode);
      if (extractedDesc) {
        description = extractedDesc;
      }
    }
  }

  if (title === '[untitled]' && participantNode) {
    const titleNode = findChildByName(participantNode, `feature-${featureIndex}-title`);
    if (titleNode) {
      const extractedTitle = extractText(titleNode);
      if (extractedTitle) {
        title = extractedTitle;
      }
    }
  }

  if (description === '[no description]' && participantNode) {
    const descNode = findChildByName(participantNode, `feature-${featureIndex}-description`);
    if (descNode) {
      const extractedDesc = extractText(descNode);
      if (extractedDesc) {
        description = extractedDesc;
      }
    }
  }

  return {
    index: featureIndex,
    title,
    description,
  };
}

const FEATURE_TITLE_PATTERN = /^feature-(\d+)-title$/i;
const FEATURE_DESC_PATTERN = /^feature-(\d+)-description$/i;

/**
 * Finds all features within a participant, supporting multiple structures:
 * 1. feature-{n} containers with feature-{n}-title and feature-{n}-description inside
 * 2. Direct feature-{n}-title and feature-{n}-description nodes (no container needed)
 */
function findAllFeatures(participantNode: FrameNode | GroupNode | SectionNode): Feature[] {
  const featureMap = new Map<number, { title?: string; description?: string }>();

  const featureContainers = findChildrenByPattern(participantNode, FEATURE_PATTERN);
  for (const { node, match } of featureContainers) {
    const featureIndex = parseInt(match[1], 10);
    const feature = parseFeature(node, featureIndex, participantNode);
    featureMap.set(featureIndex, {
      title: feature.title !== '[untitled]' ? feature.title : undefined,
      description: feature.description !== '[no description]' ? feature.description : undefined,
    });
  }

  const titleNodes = findChildrenByPattern(participantNode, FEATURE_TITLE_PATTERN);
  for (const { node, match } of titleNodes) {
    const featureIndex = parseInt(match[1], 10);
    const extractedTitle = extractText(node);
    if (extractedTitle) {
      const existing = featureMap.get(featureIndex);
      if (existing) {
        if (!existing.title) {
          existing.title = extractedTitle;
        }
      } else {
        featureMap.set(featureIndex, { title: extractedTitle });
      }
    }
  }

  const descNodes = findChildrenByPattern(participantNode, FEATURE_DESC_PATTERN);
  for (const { node, match } of descNodes) {
    const featureIndex = parseInt(match[1], 10);
    const extractedDesc = extractText(node);
    if (extractedDesc) {
      const existing = featureMap.get(featureIndex);
      if (existing) {
        if (!existing.description) {
          existing.description = extractedDesc;
        }
      } else {
        featureMap.set(featureIndex, { description: extractedDesc });
      }
    }
  }

  const features: Feature[] = [];
  for (const [index, data] of featureMap) {
    features.push({
      index,
      title: data.title || '[untitled]',
      description: data.description || '[no description]',
    });
  }

  return features.sort((a, b) => a.index - b.index);
}

/**
 * Checks if a node is spatially contained within another node's bounds.
 */
function isNodeWithinBounds(inner: SceneNode, outer: SceneNode): boolean {
  if (!('x' in inner) || !('y' in inner) || !('width' in inner) || !('height' in inner)) {
    return false;
  }
  if (!('x' in outer) || !('y' in outer) || !('width' in outer) || !('height' in outer)) {
    return false;
  }
  
  const innerX = (inner as any).absoluteTransform ? (inner as any).absoluteTransform[0][2] : inner.x;
  const innerY = (inner as any).absoluteTransform ? (inner as any).absoluteTransform[1][2] : inner.y;
  const outerX = (outer as any).absoluteTransform ? (outer as any).absoluteTransform[0][2] : outer.x;
  const outerY = (outer as any).absoluteTransform ? (outer as any).absoluteTransform[1][2] : outer.y;
  
  const outerNode = outer as FrameNode;
  const innerNode = inner as FrameNode;
  
  return (
    innerX >= outerX &&
    innerY >= outerY &&
    innerX + innerNode.width <= outerX + outerNode.width &&
    innerY + innerNode.height <= outerY + outerNode.height
  );
}

/**
 * Parses a score value from text, handling various formats.
 */
function parseScoreFromText(text: string): number | null {
  if (!text) return null;
  
  const cleaned = text.replace(/[^0-9.-]/g, '').trim();
  const match = text.match(/\d+/);
  const numStr = match ? match[0] : cleaned;
  
  const parsed = parseInt(numStr, 10);
  if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
    return Math.min(Math.max(parsed, 1), 4);
  }
  return null;
}

/**
 * Finds a concept-score for a participant by searching:
 * 1. Within participant for concept-score-{n} (e.g., concept-score-1 inside participant-1)
 * 2. Within participant for generic "concept-score"
 * 3. At concept level as fallback
 */
function findConceptScore(
  participantNode: SceneNode,
  participantIndex: number,
  conceptNode: FrameNode | GroupNode | SectionNode
): number | null {
  const numberedScoreName = `concept-score-${participantIndex}`;
  
  if (isContainerNode(participantNode)) {
    const containerParticipant = participantNode as FrameNode | GroupNode | SectionNode;
    
    const numberedInParticipant = findChildByName(containerParticipant, numberedScoreName);
    if (numberedInParticipant) {
      const scoreText = extractText(numberedInParticipant);
      const parsedScore = parseScoreFromText(scoreText);
      if (parsedScore !== null) {
        return parsedScore;
      }
    }

    const scoreNode = findChildByName(containerParticipant, CONCEPT_SCORE_NAME);
    if (scoreNode) {
      const scoreText = extractText(scoreNode);
      const parsedScore = parseScoreFromText(scoreText);
      if (parsedScore !== null) {
        return parsedScore;
      }
    }
  }

  const conceptLevelNames = [
    numberedScoreName,
    `participant-${participantIndex}-score`,
    `score-${participantIndex}`,
  ];
  
  for (const scoreName of conceptLevelNames) {
    const namedScore = findChildByName(conceptNode, scoreName);
    if (namedScore) {
      const scoreText = extractText(namedScore);
      const parsedScore = parseScoreFromText(scoreText);
      if (parsedScore !== null) {
        return parsedScore;
      }
    }
  }

  return null;
}

/**
 * Parses a participant from a participant-{n} container node.
 */
function parseParticipant(
  participantNode: SceneNode,
  participantIndex: number,
  conceptNode?: FrameNode | GroupNode | SectionNode
): Participant {
  const participant: Participant = {
    index: participantIndex,
    conceptScore: null,
    features: [],
    nodeId: participantNode.id,
  };

  if (!isContainerNode(participantNode)) {
    return participant;
  }

  if (conceptNode) {
    participant.conceptScore = findConceptScore(participantNode, participantIndex, conceptNode);
  } else {
    const scoreNode = findChildByName(participantNode as FrameNode | GroupNode | SectionNode, CONCEPT_SCORE_NAME);
    if (scoreNode) {
      const scoreText = extractText(scoreNode);
      const parsedScore = parseInt(scoreText, 10);
      if (!isNaN(parsedScore) && parsedScore >= 1 && parsedScore <= 4) {
        participant.conceptScore = parsedScore;
      }
    }
  }

  participant.features = findAllFeatures(participantNode as FrameNode | GroupNode | SectionNode);

  return participant;
}

/**
 * Parses a concept from a concept-{n} container node.
 */
function parseConcept(conceptNode: SceneNode, conceptIndex: number): Concept {
  const concept: Concept = {
    index: conceptIndex,
    participants: [],
    averageScore: null,
    aggregatedFeatures: [],
    nodeId: conceptNode.id,
  };

  if (!isContainerNode(conceptNode)) {
    return concept;
  }

  const participantMatches = findChildrenByPattern(conceptNode, PARTICIPANT_PATTERN);
  for (const { node, match } of participantMatches) {
    const participantIndex = parseInt(match[1], 10);
    const participant = parseParticipant(node, participantIndex, conceptNode);
    concept.participants.push(participant);
  }

  concept.participants.sort((a, b) => a.index - b.index);

  const validScores = concept.participants
    .map((p) => p.conceptScore)
    .filter((score): score is number => score !== null);

  if (validScores.length > 0) {
    const sum = validScores.reduce((acc, score) => acc + score, 0);
    concept.averageScore = Math.round((sum / validScores.length) * 10) / 10;
  }

  concept.aggregatedFeatures = [];
  for (const p of concept.participants) {
    for (const f of p.features) {
      concept.aggregatedFeatures.push(f);
    }
  }

  return concept;
}

/**
 * Main parsing function that traverses the entire board.
 */
function parseBoard(): ParsedBoard {
  const concepts: Concept[] = [];

  const allNodes = figma.currentPage.findAll(() => true);

  for (const node of allNodes) {
    const match = node.name.toLowerCase().trim().match(CONCEPT_PATTERN);
    if (match) {
      const conceptIndex = parseInt(match[1], 10);
      const concept = parseConcept(node, conceptIndex);
      concepts.push(concept);
    }
  }

  concepts.sort((a, b) => a.index - b.index);

  const totalParticipants = concepts.reduce(
    (sum, c) => sum + c.participants.length,
    0
  );
  const totalFeatures = concepts.reduce(
    (sum, c) => sum + c.aggregatedFeatures.length,
    0
  );

  return {
    concepts,
    totalParticipants,
    totalFeatures,
    lastParsed: new Date().toISOString(),
  };
}

/**
 * Highlights a node on the canvas by scrolling to it and selecting it.
 */
function highlightNode(nodeId: string): void {
  const node = figma.getNodeById(nodeId);
  if (node && 'type' in node && node.type !== 'DOCUMENT' && node.type !== 'PAGE') {
    const sceneNode = node as SceneNode;
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
    figma.currentPage.selection = [sceneNode];
  }
}

/**
 * Section configuration for auto-creation
 */
interface SectionConfig {
  name: string;
  width: number;
  height: number;
  fillColor: { r: number; g: number; b: number };
}

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  'highest-scoring-concept-description': {
    name: 'highest-scoring-concept-description',
    width: 400,
    height: 300,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  },
  'table-of-concept-scores': {
    name: 'table-of-concept-scores',
    width: 700,
    height: 400,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  },
  'titles-for-needs': {
    name: 'titles-for-needs',
    width: 500,
    height: 350,
    fillColor: { r: 0.9, g: 0.95, b: 0.9 },
  },
  'all-features': {
    name: 'all-features',
    width: 600,
    height: 350,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  },
  'all-features-scoring': {
    name: 'all-features-scoring',
    width: 800,
    height: 500,
    fillColor: { r: 0.9, g: 0.98, b: 0.9 },
  },
};

let nextSectionX = 0;
let nextSectionY = 0;

/**
 * Finds a section on the page by exact name (case-insensitive).
 * Creates the section if it doesn't exist.
 */
function findOrCreateSection(name: string): SectionNode {
  const normalizedName = name.toLowerCase().trim();
  const allNodes = figma.currentPage.findAll(() => true);
  
  for (const node of allNodes) {
    if (node.name.toLowerCase().trim() === normalizedName) {
      if (node.type === 'SECTION') {
        return node as SectionNode;
      }
    }
  }
  
  const config = SECTION_CONFIGS[normalizedName] || {
    name: name,
    width: 500,
    height: 400,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  };
  
  const section = figma.createSection();
  section.name = config.name;
  section.x = nextSectionX;
  section.y = nextSectionY;
  section.resizeWithoutConstraints(config.width, config.height);
  
  nextSectionX += config.width + 50;
  
  return section;
}

/**
 * Finds a section on the page by exact name (case-insensitive).
 */
function findSectionByName(name: string): SectionNode | FrameNode | null {
  const normalizedName = name.toLowerCase().trim();
  const allNodes = figma.currentPage.findAll(() => true);
  
  for (const node of allNodes) {
    if (node.name.toLowerCase().trim() === normalizedName) {
      if (node.type === 'SECTION' || node.type === 'FRAME') {
        return node as SectionNode | FrameNode;
      }
    }
  }
  return null;
}

/**
 * Creates a sticky note with specified text and color.
 */
function createSticky(
  text: string,
  x: number,
  y: number,
  color?: string
): StickyNode {
  const sticky = figma.createSticky();
  sticky.x = x;
  sticky.y = y;
  sticky.text.characters = text;
  
  if (color) {
    const colorMap: Record<string, StickyNode['authorVisible']> = {};
    sticky.fills = [{ type: 'SOLID', color: hexToRgb(color) }];
  }
  
  return sticky;
}

/**
 * Converts hex color to RGB object.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 1, g: 1, b: 0.6 };
}

/**
 * Clears all stickies from a section.
 */
function clearSectionStickies(section: SectionNode | FrameNode): void {
  const stickies = section.findAll((n) => n.type === 'STICKY');
  for (const sticky of stickies) {
    sticky.remove();
  }
}

/**
 * Finds or creates a child sticky by name within a section.
 */
function findOrCreateStickyInSection(
  section: SectionNode | FrameNode,
  stickyName: string,
  defaultText: string,
  offsetX: number,
  offsetY: number
): StickyNode {
  const existing = section.findOne(
    (n) => n.type === 'STICKY' && n.name.toLowerCase().trim() === stickyName.toLowerCase()
  );
  
  if (existing && existing.type === 'STICKY') {
    return existing;
  }
  
  const sticky = figma.createSticky();
  sticky.name = stickyName;
  sticky.text.characters = defaultText;
  section.appendChild(sticky);
  sticky.x = offsetX;
  sticky.y = offsetY;
  return sticky;
}

/**
 * Updates the highest-scoring-concept-description section.
 */
function drawHighestScoringConcept(response: AnalysisResponse): void {
  const section = findOrCreateSection('highest-scoring-concept-description');

  const titleSticky = findOrCreateStickyInSection(section, 'title-of-concept', '', 20, 80);
  titleSticky.text.characters = response.highest_scoring_concept.name;
  
  const descSticky = findOrCreateStickyInSection(section, 'concept-description', '', 20, 160);
  descSticky.text.characters = response.highest_scoring_concept.description;
}

/**
 * Updates the table-of-concept-scores section with concept rankings.
 */
function drawConceptScoresTable(response: AnalysisResponse): void {
  const section = findOrCreateSection('table-of-concept-scores');

  const rowHeight = 60;
  const startY = 120;
  const colWidths = [60, 150, 100, 100, 120, 100];
  const colStarts = [20, 80, 230, 330, 430, 550];

  for (let i = 0; i < response.prioritized_concept_list.length; i++) {
    const concept = response.prioritized_concept_list[i];
    const y = startY + i * rowHeight;

    const rankSticky = findOrCreateStickyInSection(
      section, `rank-${i + 1}`, String(concept.rank), colStarts[0], y
    );
    rankSticky.text.characters = String(concept.rank);

    const nameSticky = findOrCreateStickyInSection(
      section, `name-${i + 1}`, concept.name, colStarts[1], y
    );
    nameSticky.text.characters = concept.name;

    const zScoreSticky = findOrCreateStickyInSection(
      section, `zscore-${i + 1}`, String(concept.average_z_score), colStarts[2], y
    );
    zScoreSticky.text.characters = String(concept.average_z_score.toFixed(2));

    const disagreeSticky = findOrCreateStickyInSection(
      section, `disagreement-${i + 1}`, String(concept.disagreement), colStarts[3], y
    );
    disagreeSticky.text.characters = String(concept.disagreement.toFixed(2));

    const consensusSticky = findOrCreateStickyInSection(
      section, `consensus-${i + 1}`, String(concept.concensus_weight), colStarts[4], y
    );
    consensusSticky.text.characters = String(concept.concensus_weight.toFixed(2));

    const finalSticky = findOrCreateStickyInSection(
      section, `final-${i + 1}`, String(concept.final_score), colStarts[5], y
    );
    finalSticky.text.characters = String(concept.final_score.toFixed(1));
  }
}

/**
 * Updates the titles-for-needs section.
 */
function drawTitlesForNeeds(response: AnalysisResponse): void {
  const section = findOrCreateSection('titles-for-needs');

  const rowHeight = 60;
  const startY = 100;

  for (let i = 0; i < response.features_and_themes.length; i++) {
    const item = response.features_and_themes[i];
    const y = startY + i * rowHeight;

    const needSticky = findOrCreateStickyInSection(
      section, `need-${i + 1}`, item.theme.need, 20, y
    );
    needSticky.text.characters = item.theme.need;

    const titleSticky = findOrCreateStickyInSection(
      section, `need-title-${i + 1}`, item.theme.title, 250, y
    );
    titleSticky.text.characters = item.theme.title;
  }
}

/**
 * Updates the all-features section.
 */
function drawAllFeatures(response: AnalysisResponse): void {
  const section = findOrCreateSection('all-features');

  const rowHeight = 60;
  const startY = 120;

  for (let i = 0; i < response.features_and_themes.length; i++) {
    const item = response.features_and_themes[i];
    const y = startY + i * rowHeight;

    const featureSticky = findOrCreateStickyInSection(
      section, `feature-${i + 1}`, item.feature, 20, y
    );
    featureSticky.text.characters = item.feature;

    const needSticky = findOrCreateStickyInSection(
      section, `feature-need-${i + 1}`, item.theme.need, 200, y
    );
    needSticky.text.characters = item.theme.need;

    const rationaleSticky = findOrCreateStickyInSection(
      section, `feature-rationale-${i + 1}`, item.rationale, 380, y
    );
    rationaleSticky.text.characters = item.rationale;
  }
}

/**
 * Updates the all-features-scoring section with participant feature data.
 */
function drawAllFeaturesScoring(parsedBoard: ParsedBoard): void {
  const section = findOrCreateSection('all-features-scoring');

  const mockScoring = generateMockFeatureScoring(
    parsedBoard.totalParticipants || 3,
    3
  );

  const colWidth = 140;
  const rowHeight = 50;
  const startX = 20;
  const startY = 100;

  let currentParticipant = '';
  let participantCol = 0;
  let featureRow = 0;

  for (const scoring of mockScoring) {
    if (scoring.participant !== currentParticipant) {
      currentParticipant = scoring.participant;
      featureRow = 0;

      const participantSticky = findOrCreateStickyInSection(
        section,
        `participant-header-${participantCol}`,
        scoring.participant,
        startX + participantCol * colWidth * 3,
        startY
      );
      participantSticky.text.characters = scoring.participant;
      participantCol++;
    }

    const col = (participantCol - 1) * 3;
    const x = startX + col * colWidth;
    const y = startY + (featureRow + 1) * rowHeight;

    const nameSticky = findOrCreateStickyInSection(
      section,
      `scoring-name-${participantCol}-${featureRow}`,
      scoring.feature_name,
      x,
      y
    );
    nameSticky.text.characters = scoring.feature_name;

    const descSticky = findOrCreateStickyInSection(
      section,
      `scoring-desc-${participantCol}-${featureRow}`,
      scoring.feature_description,
      x + colWidth,
      y
    );
    descSticky.text.characters = scoring.feature_description;

    const critSticky = findOrCreateStickyInSection(
      section,
      `scoring-crit-${participantCol}-${featureRow}`,
      scoring.criticality,
      x + colWidth * 2,
      y
    );
    critSticky.text.characters = scoring.criticality;

    featureRow++;
  }
}

/**
 * Main function to analyze board and draw results.
 */
/**
 * Calculates the starting position for new sections based on existing content.
 * Places new sections below all existing content to avoid overlap.
 */
function calculateNewSectionStartPosition(): { x: number; y: number } {
  const allNodes = figma.currentPage.findAll(() => true);
  let maxY = 0;
  let minX = Infinity;
  
  for (const node of allNodes) {
    if ('x' in node && 'y' in node && 'width' in node && 'height' in node) {
      const sceneNode = node as SceneNode & { width: number; height: number };
      const nodeBottom = sceneNode.y + sceneNode.height;
      if (nodeBottom > maxY) maxY = nodeBottom;
      if (sceneNode.x < minX) minX = sceneNode.x;
    }
  }
  
  if (minX === Infinity) minX = 0;
  
  return { x: minX, y: maxY + 200 };
}

/**
 * Loads required fonts for text operations.
 */
async function loadFonts(): Promise<void> {
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
}

/**
 * Main function to analyze board and draw results.
 */
async function analyzeAndDraw(parsedBoard: ParsedBoard): Promise<AnalysisResponse> {
  await loadFonts();
  
  const response = mockAnalysisResponse;
  
  const startPos = calculateNewSectionStartPosition();
  nextSectionX = startPos.x;
  nextSectionY = startPos.y;
  
  drawHighestScoringConcept(response);
  drawConceptScoresTable(response);
  drawTitlesForNeeds(response);
  drawAllFeatures(response);
  drawAllFeaturesScoring(parsedBoard);
  
  return response;
}

figma.showUI(__html__, {
  width: 360,
  height: 600,
  themeColors: true,
});

figma.ui.onmessage = async (msg: UIToControllerMessage) => {
  try {
    switch (msg.type) {
      case 'PARSE_BOARD': {
        figma.ui.postMessage({ type: 'PARSING_STARTED' });
        const parsedBoard = parseBoard();
        figma.ui.postMessage({ type: 'BOARD_DATA', payload: parsedBoard });
        break;
      }

      case 'ANALYZE_BOARD': {
        figma.ui.postMessage({ type: 'ANALYSIS_STARTED' });
        const parsedBoard = parseBoard();
        await analyzeAndDraw(parsedBoard);
        const sectionsUpdated = [
          'highest-scoring-concept-description',
          'table-of-concept-scores',
          'titles-for-needs',
          'all-features',
          'all-features-scoring',
        ];
        figma.ui.postMessage({ type: 'ANALYSIS_COMPLETE', sectionsUpdated });
        break;
      }

      case 'HIGHLIGHT_NODE': {
        highlightNode(msg.nodeId);
        break;
      }

      case 'CLOSE_PLUGIN': {
        figma.closePlugin();
        break;
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Plugin error:', error);
    figma.ui.postMessage({ type: 'PARSE_ERROR', message: errorMessage });
  }
};
