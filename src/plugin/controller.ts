import type {
  Feature,
  Participant,
  Concept,
  ParsedBoard,
  UIToControllerMessage,
} from '../types';
import type { AnalysisResponse } from '../types/api';
import { mockAnalysisResponse, mockParsedBoard } from './mockData';

declare const __html__: string;

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

const MUTED: RGB = { r: 0.45, g: 0.45, b: 0.45 };
const DARK: RGB  = { r: 0.08, g: 0.08, b: 0.08 };

const CRITICALITY_COLORS: Record<string, RGB> = {
  Critical: { r: 0.93, g: 0.26, b: 0.21 },
  High:     { r: 0.96, g: 0.49, b: 0.0  },
  Medium:   { r: 0.9,  g: 0.65, b: 0.0  },
  Low:      { r: 0.2,  g: 0.65, b: 0.32 },
};

/** Scale a base design value to match the actual container size. */
function sc(val: number, scale: number): number {
  return Math.round(val * scale);
}

/** Compute a scale factor from actual section width vs design reference. */
function getScale(section: SectionNode | FrameNode, referenceWidth: number): number {
  return (section as FrameNode).width / referenceWidth;
}

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
 * Removes ALL children from a container.
 */
function clearAllContent(container: SectionNode | FrameNode): void {
  const toRemove: SceneNode[] = [];
  for (const child of (container as FrameNode).children) {
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
    container.resizeWithoutConstraints(maxRight + 24, maxBottom + 24);
  }
}

/**
 * Draws the highest-scoring-concept-description section.
 * All dimensions scale from the section's actual width vs design width 680.
 */
function drawHighestScoringConceptContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);
  const s   = getScale(section, 680);
  const pad = sc(24, s);
  const w   = (section as FrameNode).width - pad * 2;

  const title = createText(
    section, response.highest_scoring_concept.name,
    pad, pad,
    sc(22, s), true, DARK, w
  );

  createText(
    section, response.highest_scoring_concept.description,
    pad, pad + title.height + sc(16, s),
    sc(13, s), false, { r: 0.25, g: 0.25, b: 0.25 }, w
  );
}

/**
 * Draws the table-of-concept-scores section.
 * Scales from design width 900.
 */
function drawConceptScoresTableContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);
  const s      = getScale(section, 900);
  const pad    = sc(24, s);
  const gap    = sc(16, s);
  const rowH   = sc(48, s);
  const headH  = sc(56, s);

  const colDefs: { label: string; frac: number }[] = [
    { label: 'Rank',             frac: 0.06 },
    { label: 'Concept Name',     frac: 0.22 },
    { label: 'Avg Z Score',      frac: 0.14 },
    { label: 'Disagreement',     frac: 0.16 },
    { label: 'Consensus Weight', frac: 0.20 },
    { label: 'Final Score',      frac: 0.14 },
  ];

  const totalW   = (section as FrameNode).width - pad * 2 - gap * (colDefs.length - 1);
  const colWidths = colDefs.map((c) => Math.round(totalW * c.frac));

  let x = pad;
  for (let j = 0; j < colDefs.length; j++) {
    createText(section, colDefs[j].label, x, pad, sc(11, s), true, MUTED, colWidths[j]);
    x += colWidths[j] + gap;
  }

  for (let i = 0; i < response.prioritized_concept_list.length; i++) {
    const c      = response.prioritized_concept_list[i];
    const y      = pad + headH + i * rowH;
    const isTop  = i === 0;
    const color: RGB = isTop ? { r: 0.07, g: 0.48, b: 0.32 } : DARK;

    const safeFixed = function (v: unknown, decimals: number): string {
      var n = Number(v);
      if (isNaN(n)) return '—';
      return n.toFixed(decimals);
    };

    const values = [
      String(c.rank || i + 1),
      c.name || '(unnamed)',
      safeFixed(c.average_z_score, 2),
      safeFixed(c.disagreement, 2),
      safeFixed(c.concensus_weight, 2),
      safeFixed(c.final_score, 1),
    ];

    x = pad;
    for (let j = 0; j < colDefs.length; j++) {
      createText(section, values[j], x, y, sc(12, s), isTop, color, colWidths[j]);
      x += colWidths[j] + gap;
    }
  }
}

/**
 * Draws the titles-for-needs section.
 * Scales from design width 700.
 */
function drawTitlesForNeedsContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);
  const s      = getScale(section, 700);
  const pad    = sc(24, s);
  const gap    = sc(32, s);
  const rowH   = sc(44, s);
  const headH  = sc(56, s);
  const colW   = Math.round(((section as FrameNode).width - pad * 2 - gap) / 2);

  const needX  = pad;
  const titleX = pad + colW + gap;

  createText(section, 'Need',       needX,  pad, sc(11, s), true, MUTED, colW);
  createText(section, 'Need Title', titleX, pad, sc(11, s), true, MUTED, colW);

  for (let i = 0; i < response.features_and_themes.length; i++) {
    const item = response.features_and_themes[i];
    const y    = pad + headH + i * rowH;
    createText(section, item.theme.need,  needX,  y, sc(14, s), false, DARK, colW);
    createText(section, item.theme.title, titleX, y, sc(14, s), true,  DARK, colW);
  }
}

/**
 * Draws the all-features section.
 * Scales from design width 800.
 */
function drawAllFeaturesContent(
  section: SectionNode | FrameNode,
  response: AnalysisResponse
): void {
  clearTextContent(section);
  const s      = getScale(section, 800);
  const pad    = sc(24, s);
  const gap    = sc(24, s);
  const rowH   = sc(44, s);
  const headH  = sc(56, s);

  const totalW    = (section as FrameNode).width - pad * 2 - gap * 2;
  const featureW  = Math.round(totalW * 0.28);
  const needW     = Math.round(totalW * 0.28);
  const rationaleW = totalW - featureW - needW;

  const featureX   = pad;
  const needX      = featureX + featureW + gap;
  const rationaleX = needX + needW + gap;

  createText(section, 'Feature',     featureX,   pad, sc(11, s), true, MUTED, featureW);
  createText(section, 'Mapped Need', needX,      pad, sc(11, s), true, MUTED, needW);
  createText(section, 'Rationale',   rationaleX, pad, sc(11, s), true, MUTED, rationaleW);

  for (let i = 0; i < response.features_and_themes.length; i++) {
    const item = response.features_and_themes[i];
    const y    = pad + headH + i * rowH;
    const grey: RGB = { r: 0.3, g: 0.3, b: 0.3 };
    createText(section, item.feature,    featureX,   y, sc(12, s), true,  DARK, featureW);
    createText(section, item.theme.need, needX,      y, sc(12, s), false, grey, needW);
    createText(section, item.rationale,  rationaleX, y, sc(12, s), false, grey, rationaleW);
  }
}

/**
 * Draws the all-features-scoring section.
 * Clears everything and rebuilds participant frames from scratch.
 * Scales from design width 1400.
 */
function drawAllFeaturesScoringContent(
  section: SectionNode | FrameNode,
  parsedBoard: ParsedBoard
): void {
  clearAllContent(section);

  const critLevels = ['Critical', 'High', 'Medium', 'Low'];
  const s   = getScale(section, 1400);
  const pad = sc(24, s);
  const gap = sc(24, s);

  let totalParticipants = 0;
  for (const concept of parsedBoard.concepts) {
    totalParticipants += concept.participants.length;
  }
  if (totalParticipants === 0) return;

  const sectionW    = (section as FrameNode).width;
  const participantW = Math.floor((sectionW - pad * 2 - gap * (totalParticipants - 1)) / totalParticipants);

  const innerW  = participantW - pad * 2;
  const nameW   = Math.round(innerW * 0.32);
  const descW   = Math.round(innerW * 0.42);
  const critW   = innerW - nameW - descW - sc(16, s) * 2;
  const nameX   = pad;
  const descX   = nameX + nameW + sc(16, s);
  const critX   = descX + descW + sc(16, s);
  const cellH   = sc(44, s);
  const rowGap  = sc(8,  s);
  const headH   = sc(64, s);

  let nextX = pad;

  for (const concept of parsedBoard.concepts) {
    for (const participant of concept.participants) {
      const pLabel = 'participant-' + String(participant.index);

      const pFrame = figma.createFrame();
      pFrame.name = pLabel;
      pFrame.fills = [{ type: 'SOLID', color: { r: 0.93, g: 0.98, b: 0.93 } }];
      section.appendChild(pFrame);
      pFrame.x = nextX;
      pFrame.y = pad;
      pFrame.resizeWithoutConstraints(participantW, 200);

      createText(pFrame, pLabel,         pad, pad,             sc(14, s), true,  DARK);
      createText(pFrame, 'Feature',      nameX, pad + sc(28, s), sc(10, s), true,  MUTED, nameW);
      createText(pFrame, 'Description',  descX, pad + sc(28, s), sc(10, s), true,  MUTED, descW);
      createText(pFrame, 'Criticality',  critX, pad + sc(28, s), sc(10, s), true,  MUTED, critW);

      for (let i = 0; i < participant.features.length; i++) {
        const feature     = participant.features[i];
        const criticality = critLevels[i % critLevels.length];
        const critColor   = CRITICALITY_COLORS[criticality] || MUTED;
        const bgColor: RGB = {
          r: critColor.r * 0.12 + 0.88,
          g: critColor.g * 0.12 + 0.88,
          b: critColor.b * 0.12 + 0.88,
        };
        const rowY = pad + headH + i * (cellH + rowGap);
        const inPad = sc(6, s);

        const nf = figma.createFrame();
        nf.name = 'feature-name';
        nf.fills = [];
        pFrame.appendChild(nf);
        nf.x = nameX;
        nf.y = rowY;
        nf.resizeWithoutConstraints(nameW, cellH);
        createText(nf, feature.title, inPad, inPad, sc(11, s), false, DARK, nameW - inPad * 2);

        const df = figma.createFrame();
        df.name = 'feature-description';
        df.fills = [];
        pFrame.appendChild(df);
        df.x = descX;
        df.y = rowY;
        df.resizeWithoutConstraints(descW, cellH);
        createText(df, feature.description, inPad, inPad, sc(11, s), false, { r: 0.3, g: 0.3, b: 0.3 }, descW - inPad * 2);

        const cf = figma.createFrame();
        cf.name = 'criticality';
        cf.fills = [{ type: 'SOLID', color: bgColor }];
        pFrame.appendChild(cf);
        cf.x = critX;
        cf.y = rowY;
        cf.resizeWithoutConstraints(critW, cellH);
        createText(cf, criticality, inPad, inPad, sc(11, s), true, critColor, critW - inPad * 2);
      }

      resizeToFitContent(pFrame);
      nextX = pFrame.x + pFrame.width + gap;
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
 * Main function to draw analysis results on the board.
 *
 * @param response  Analysis data (from backend API or mock).
 * @param parsedBoard  Parsed board structure used for per-participant section.
 */
async function analyzeAndDraw(
  response: AnalysisResponse,
  parsedBoard: ParsedBoard,
  experimentMode: boolean = false,
): Promise<string[]> {
  await loadFonts();

  const startPos = calculateNewSectionStartPosition();
  nextSectionX = startPos.x;
  nextSectionY = startPos.y;

  console.log('[analyzeAndDraw] Starting position:', startPos, 'experimentMode:', experimentMode);

  const createdSections: SceneNode[] = [];

  const section1 = findOrCreateSection('highest-scoring-concept-description');
  createdSections.push(section1);
  drawHighestScoringConceptContent(section1, response);

  const section2 = findOrCreateSection('table-of-concept-scores');
  createdSections.push(section2);
  drawConceptScoresTableContent(section2, response);

  if (experimentMode) {
    const section3 = findOrCreateSection('titles-for-needs');
    createdSections.push(section3);
    drawTitlesForNeedsContent(section3, response);

    const section4 = findOrCreateSection('all-features');
    createdSections.push(section4);
    drawAllFeaturesContent(section4, response);

    const section5 = findOrCreateSection('all-features-scoring');
    createdSections.push(section5);
    drawAllFeaturesScoringContent(section5, parsedBoard);
  }

  const sectionNames = createdSections.map(function (s) { return s.name; });
  console.log('[analyzeAndDraw] Updated sections:', sectionNames);

  if (createdSections.length > 0) {
    figma.viewport.scrollAndZoomIntoView(createdSections);
    figma.currentPage.selection = createdSections;
  }

  return sectionNames;
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
        const sectionsUpdated = await analyzeAndDraw(mockAnalysisResponse, mockParsedBoard);
        figma.ui.postMessage({ type: 'ANALYSIS_COMPLETE', sectionsUpdated });
        break;
      }

      case 'DRAW_RESULTS': {
        figma.ui.postMessage({ type: 'ANALYSIS_STARTED' });
        const sectionsUpdated = await analyzeAndDraw(msg.analysis, msg.parsedBoard, msg.experimentMode ?? false);
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
    figma.ui.postMessage({ type: 'ANALYSIS_ERROR', message: errorMessage });
  }
};
