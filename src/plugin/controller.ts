import type {
  Feature,
  Participant,
  Concept,
  ParsedBoard,
  UIToControllerMessage,
} from '../types';

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

figma.showUI(__html__, {
  width: 360,
  height: 600,
  themeColors: true,
});

figma.ui.onmessage = (msg: UIToControllerMessage) => {
  try {
    switch (msg.type) {
      case 'PARSE_BOARD': {
        figma.ui.postMessage({ type: 'PARSING_STARTED' });
        const parsedBoard = parseBoard();
        figma.ui.postMessage({ type: 'BOARD_DATA', payload: parsedBoard });
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
