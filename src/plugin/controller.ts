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
    width: 680,
    height: 300,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  },
  'table-of-concept-scores': {
    name: 'table-of-concept-scores',
    width: 900,
    height: 400,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  },
  'titles-for-needs': {
    name: 'titles-for-needs',
    width: 700,
    height: 400,
    fillColor: { r: 0.9, g: 0.95, b: 0.9 },
  },
  'all-features': {
    name: 'all-features',
    width: 800,
    height: 400,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  },
  'all-features-scoring': {
    name: 'all-features-scoring',
    width: 1400,
    height: 600,
    fillColor: { r: 0.9, g: 0.98, b: 0.9 },
  },
};

let nextSectionX = 0;
let nextSectionY = 0;

/**
 * Checks if we're running in FigJam.
 */
function isFigJam(): boolean {
  return figma.editorType === 'figjam';
}

/**
 * Finds a section/frame on the page by exact name (case-insensitive).
 * Creates the section/frame if it doesn't exist.
 * Uses Section in FigJam, Frame in Figma.
 */
function findOrCreateSection(name: string): SectionNode | FrameNode {
  const normalizedName = name.toLowerCase().trim();
  const allNodes = figma.currentPage.findAll(() => true);
  
  for (const node of allNodes) {
    if (node.name.toLowerCase().trim() === normalizedName) {
      if (node.type === 'SECTION' || node.type === 'FRAME') {
        return node as SectionNode | FrameNode;
      }
    }
  }
  
  const config = SECTION_CONFIGS[normalizedName] || {
    name: name,
    width: 500,
    height: 400,
    fillColor: { r: 0.95, g: 0.95, b: 0.95 },
  };
  
  let container: SectionNode | FrameNode;
  
  if (isFigJam()) {
    container = figma.createSection();
  } else {
    container = figma.createFrame();
    container.fills = [{ type: 'SOLID', color: config.fillColor }];
  }
  
  container.name = config.name;
  container.x = nextSectionX;
  container.y = nextSectionY;
  container.resizeWithoutConstraints(config.width, config.height);
  
  nextSectionX += config.width + 50;
  
  return container;
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

const PAD = 24;
const ROW_H = 36;
const HEADER_H = 48;
const COL_GAP = 16;
const MUTED: RGB = { r: 0.45, g: 0.45, b: 0.45 };
const DARK: RGB = { r: 0.08, g: 0.08, b: 0.08 };

const CRITICALITY_COLORS: Record<string, RGB> = {
  Critical: { r: 0.93, g: 0.26, b: 0.21 },
  High:     { r: 0.96, g: 0.49, b: 0.0 },
  Medium:   { r: 0.9,  g: 0.65, b: 0.0 },
  Low:      { r: 0.2,  g: 0.65, b: 0.32 },
};

/**
 * Removes all TEXT and STICKY nodes from a container.
 */
function clearTextContent(container: SectionNode | FrameNode): void {
  const toRemove: SceneNode[] = [];
  for (const child of (container as FrameNode).findAll(
    (n) => n.type === 'TEXT' || n.type === 'STICKY'
  )) {
    toRemove.push(child);
  }
  for (const node of toRemove) {
    node.remove();
  }
}

/**
 * Creates a styled text node appended to a parent.
 */
function createText(
  parent: SectionNode | FrameNode,
  content: string,
  x: number,
  y: number,
  size: number = 12,
  bold: boolean = false,
  color: RGB = DARK,
  maxWidth?: number
): TextNode {
  const node = figma.createText();
  parent.appendChild(node);
  node.fontName = { family: 'Inter', style: bold ? 'Bold' : 'Regular' };
  node.fontSize = size;
  if (maxWidth) {
    node.textAutoResize = 'HEIGHT';
    node.resize(maxWidth, 20);
  }
  node.characters = content;
  node.fills = [{ type: 'SOLID', color }];
  node.x = x;
  node.y = y;
  return node;
}

/**
 * Finds or creates a child FrameNode within a parent by name.
 */
function findOrCreateChildFrame(
  parent: FrameNode | SectionNode,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor?: RGB
): FrameNode {
  const existing = (parent as FrameNode).findOne(
    (n) => n.type === 'FRAME' && n.name.toLowerCase() === name.toLowerCase()
  );
  if (existing && existing.type === 'FRAME') {
    return existing as FrameNode;
  }
  const frame = figma.createFrame();
  frame.name = name;
  frame.fills = fillColor ? [{ type: 'SOLID', color: fillColor }] : [];
  parent.appendChild(frame);
  frame.x = x;
  frame.y = y;
  frame.resizeWithoutConstraints(width, height);
  return frame;
}

/**
 * Resizes a section/frame to tightly fit all its children.
 */
function resizeToFitContent(container: SectionNode | FrameNode): void {
  let maxBottom = 0;
  let maxRight = 0;
  for (const child of (container as FrameNode).children) {
    if ('x' in child && 'y' in child && 'width' in child && 'height' in child) {
      const right = child.x + (child as FrameNode).width;
      const bottom = child.y + (child as FrameNode).height;
      if (right > maxRight) maxRight = right;
      if (bottom > maxBottom) maxBottom = bottom;
    }
  }
  if (maxRight > 0 || maxBottom > 0) {
    container.resizeWithoutConstraints(maxRight + PAD, maxBottom + PAD);
  }
}

/**
 * Draws the highest-scoring-concept-description section:
 * Bold title at top, description text below it.
 */
function drawHighestScoringConceptContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);
  const w = Math.max((section as FrameNode).width - PAD * 2, 320);

  const title = createText(
    section,
    response.highest_scoring_concept.name,
    PAD, PAD,
    22, true, DARK, w
  );

  createText(
    section,
    response.highest_scoring_concept.description,
    PAD, PAD + title.height + 16,
    13, false, { r: 0.25, g: 0.25, b: 0.25 }, w
  );

  resizeToFitContent(section);
}

/**
 * Draws the table-of-concept-scores section:
 * Headers + one row per concept with Rank, Name, Avg Z Score,
 * Disagreement, Consensus Weight, Final Score columns.
 */
function drawConceptScoresTableContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);

  const cols: { label: string; width: number }[] = [
    { label: 'Rank',             width: 44  },
    { label: 'Concept Name',     width: 170 },
    { label: 'Avg Z Score',      width: 90  },
    { label: 'Disagreement',     width: 100 },
    { label: 'Consensus Weight', width: 130 },
    { label: 'Final Score',      width: 90  },
  ];

  let x = PAD;
  for (const col of cols) {
    createText(section, col.label, x, PAD, 11, true, MUTED, col.width);
    x += col.width + COL_GAP;
  }

  for (let i = 0; i < response.prioritized_concept_list.length; i++) {
    const c = response.prioritized_concept_list[i];
    const y = PAD + HEADER_H + i * ROW_H;
    const isTop = i === 0;
    const rowColor: RGB = isTop ? { r: 0.07, g: 0.48, b: 0.32 } : DARK;
    x = PAD;

    const values = [
      String(c.rank),
      c.name,
      String(c.average_z_score.toFixed(2)),
      String(c.disagreement.toFixed(2)),
      String(c.concensus_weight.toFixed(2)),
      String(c.final_score.toFixed(1)),
    ];

    for (let j = 0; j < cols.length; j++) {
      createText(section, values[j], x, y, 12, isTop, rowColor, cols[j].width);
      x += cols[j].width + COL_GAP;
    }
  }

  resizeToFitContent(section);
}

/**
 * Draws the titles-for-needs section:
 * Two columns — Need and Need Title — with a header row.
 */
function drawTitlesForNeedsContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);

  const needW = 220;
  const titleW = 220;
  const needX = PAD;
  const titleX = PAD + needW + COL_GAP * 2;

  createText(section, 'Need',       needX,  PAD, 11, true, MUTED, needW);
  createText(section, 'Need Title', titleX, PAD, 11, true, MUTED, titleW);

  for (let i = 0; i < response.features_and_themes.length; i++) {
    const item = response.features_and_themes[i];
    const y = PAD + HEADER_H + i * ROW_H;
    createText(section, item.theme.need,  needX,  y, 14, false, DARK, needW);
    createText(section, item.theme.title, titleX, y, 14, true,  DARK, titleW);
  }

  resizeToFitContent(section);
}

/**
 * Draws the all-features section:
 * Three columns — Feature, Mapped Need, Rationale.
 */
function drawAllFeaturesContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);

  const featureW   = 180;
  const needW      = 170;
  const rationaleW = 220;
  const featureX   = PAD;
  const needX      = PAD + featureW + COL_GAP * 2;
  const rationaleX = needX + needW + COL_GAP * 2;

  createText(section, 'Feature',      featureX,   PAD, 11, true, MUTED, featureW);
  createText(section, 'Mapped Need',  needX,      PAD, 11, true, MUTED, needW);
  createText(section, 'Rationale',    rationaleX, PAD, 11, true, MUTED, rationaleW);

  for (let i = 0; i < response.features_and_themes.length; i++) {
    const item = response.features_and_themes[i];
    const y = PAD + HEADER_H + i * ROW_H;
    createText(section, item.feature,       featureX,   y, 12, true,  DARK, featureW);
    createText(section, item.theme.need,    needX,      y, 12, false, { r: 0.3, g: 0.3, b: 0.3 }, needW);
    createText(section, item.rationale,     rationaleX, y, 12, false, { r: 0.3, g: 0.3, b: 0.3 }, rationaleW);
  }

  resizeToFitContent(section);
}

/**
 * Finds all child frames matching a name (case-insensitive) sorted top-to-bottom by Y.
 */
function findFramesByNameSortedByY(
  parent: FrameNode | SectionNode,
  name: string
): FrameNode[] {
  const matches: FrameNode[] = [];
  for (const child of (parent as FrameNode).children) {
    if (child.type === 'FRAME' && child.name.toLowerCase().trim() === name.toLowerCase()) {
      matches.push(child as FrameNode);
    }
  }
  return matches.sort((a, b) => a.y - b.y);
}

/**
 * Draws the all-features-scoring section.
 *
 * For each participant-X frame that already exists on the board it finds
 * the child frames named "feature-name", "feature-description", and
 * "criticality" (sorted top-to-bottom) and populates them with the
 * participant's actual feature data from the parsed board.
 *
 * If a participant frame doesn't exist yet, one is created along with
 * the necessary child frames.
 */
function drawAllFeaturesScoringContent(
  section: SectionNode | FrameNode,
  parsedBoard: ParsedBoard
): void {
  const critLevels = ['Critical', 'High', 'Medium', 'Low'];
  const participantW = 480;
  const participantGap = 24;
  const nameColW  = 140;
  const descColW  = 180;
  const critColW  = 100;
  const nameColX  = PAD;
  const descColX  = nameColX + nameColW + COL_GAP;
  const critColX  = descColX + descColW + COL_GAP;
  const cellH     = 40;

  let nextParticipantX = PAD;

  for (const concept of parsedBoard.concepts) {
    for (const participant of concept.participants) {
      const participantName = 'participant-' + String(participant.index);

      let pFrame = (section as FrameNode).findOne(
        (n) => (n.type === 'FRAME' || n.type === 'SECTION') &&
                n.name.toLowerCase().trim() === participantName.toLowerCase()
      ) as FrameNode | null;

      const isNewFrame = !pFrame;

      if (!pFrame) {
        pFrame = figma.createFrame();
        pFrame.name = participantName;
        pFrame.fills = [{ type: 'SOLID', color: { r: 0.93, g: 0.98, b: 0.93 } }];
        section.appendChild(pFrame);
        pFrame.x = nextParticipantX;
        pFrame.y = PAD;
        pFrame.resizeWithoutConstraints(participantW, 200);
      }

      clearTextContent(pFrame);

      createText(pFrame, participantName, PAD, PAD, 14, true, DARK);

      createText(pFrame, 'Feature',     nameColX, PAD + 30, 10, true, MUTED, nameColW);
      createText(pFrame, 'Description', descColX, PAD + 30, 10, true, MUTED, descColW);
      createText(pFrame, 'Criticality', critColX, PAD + 30, 10, true, MUTED, critColW);

      const nameFrames = findFramesByNameSortedByY(pFrame, 'feature-name');
      const descFrames = findFramesByNameSortedByY(pFrame, 'feature-description');
      const critFrames = findFramesByNameSortedByY(pFrame, 'criticality');

      for (let i = 0; i < participant.features.length; i++) {
        const feature    = participant.features[i];
        const criticality = critLevels[i % critLevels.length];
        const critColor  = CRITICALITY_COLORS[criticality] || MUTED;
        const rowY       = PAD + 56 + i * (cellH + 6);

        if (isNewFrame || i >= nameFrames.length) {
          const nf = findOrCreateChildFrame(pFrame, 'feature-name', nameColX, rowY, nameColW, cellH);
          clearTextContent(nf);
          createText(nf, feature.title, 6, 8, 11, false, DARK, nameColW - 12);
        } else {
          clearTextContent(nameFrames[i]);
          createText(nameFrames[i], feature.title, 6, 8, 11, false, DARK, nameFrames[i].width - 12);
        }

        if (isNewFrame || i >= descFrames.length) {
          const df = findOrCreateChildFrame(pFrame, 'feature-description', descColX, rowY, descColW, cellH);
          clearTextContent(df);
          createText(df, feature.description, 6, 8, 11, false, { r: 0.3, g: 0.3, b: 0.3 }, descColW - 12);
        } else {
          clearTextContent(descFrames[i]);
          createText(descFrames[i], feature.description, 6, 8, 11, false, { r: 0.3, g: 0.3, b: 0.3 }, descFrames[i].width - 12);
        }

        if (isNewFrame || i >= critFrames.length) {
          const cf = findOrCreateChildFrame(
            pFrame, 'criticality', critColX, rowY, critColW, cellH,
            { r: critColor.r * 0.15 + 0.85, g: critColor.g * 0.15 + 0.85, b: critColor.b * 0.15 + 0.85 }
          );
          clearTextContent(cf);
          createText(cf, criticality, 6, 8, 11, true, critColor, critColW - 12);
        } else {
          critFrames[i].fills = [{ type: 'SOLID', color: { r: critColor.r * 0.15 + 0.85, g: critColor.g * 0.15 + 0.85, b: critColor.b * 0.15 + 0.85 } }];
          clearTextContent(critFrames[i]);
          createText(critFrames[i], criticality, 6, 8, 11, true, critColor, critFrames[i].width - 12);
        }
      }

      resizeToFitContent(pFrame);
      nextParticipantX = pFrame.x + pFrame.width + participantGap;
    }
  }

  resizeToFitContent(section);
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
  
  console.log('[analyzeAndDraw] Starting position:', startPos);
  
  const createdSections: SceneNode[] = [];
  
  const section1 = findOrCreateSection('highest-scoring-concept-description');
  createdSections.push(section1);
  drawHighestScoringConceptContent(section1, response);
  
  const section2 = findOrCreateSection('table-of-concept-scores');
  createdSections.push(section2);
  drawConceptScoresTableContent(section2, response);
  
  const section3 = findOrCreateSection('titles-for-needs');
  createdSections.push(section3);
  drawTitlesForNeedsContent(section3, response);
  
  const section4 = findOrCreateSection('all-features');
  createdSections.push(section4);
  drawAllFeaturesContent(section4, response);
  
  const section5 = findOrCreateSection('all-features-scoring');
  createdSections.push(section5);
  drawAllFeaturesScoringContent(section5, parsedBoard);
  
  console.log('[analyzeAndDraw] Created sections:', createdSections.map(s => s.name));
  
  if (createdSections.length > 0) {
    figma.viewport.scrollAndZoomIntoView(createdSections);
    figma.currentPage.selection = createdSections;
  }
  
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
