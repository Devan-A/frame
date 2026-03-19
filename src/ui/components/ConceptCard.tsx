import React, { useState } from 'react';
import type { Concept } from '../../types';
import { ParticipantRow } from './ParticipantRow';
import { ChevronIcon } from './icons/ChevronIcon';

interface ConceptCardProps {
  concept: Concept;
  onHighlightNode: (nodeId: string) => void;
}

export function ConceptCard({ concept, onHighlightNode }: ConceptCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const averageDisplay =
    concept.averageScore !== null
      ? concept.averageScore.toFixed(1)
      : 'N/A';

  return (
    <div className="card overflow-hidden">
      <div
        className="collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronIcon className={`chevron ${isExpanded ? 'expanded' : ''}`} />
        <span
          className="font-medium text-sm text-[var(--figma-color-text)] flex-1 cursor-pointer hover:text-[var(--figma-color-accent)]"
          onClick={(e) => {
            e.stopPropagation();
            onHighlightNode(concept.nodeId);
          }}
          title="Click to highlight on canvas"
        >
          Concept {concept.index}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--figma-color-text-secondary)]">
            avg:
          </span>
          <span
            className={`text-xs font-bold ${
              concept.averageScore !== null && concept.averageScore >= 3
                ? 'text-[var(--score-4)]'
                : concept.averageScore !== null && concept.averageScore >= 2
                ? 'text-[var(--score-3)]'
                : 'text-[var(--score-1)]'
            }`}
          >
            {averageDisplay}
          </span>
          <span className="text-xs">★</span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-2 pb-3">
          {concept.participants.length === 0 ? (
            <p className="text-xs text-[var(--figma-color-text-tertiary)] italic px-3 py-2">
              No participants found in this concept.
            </p>
          ) : (
            <div className="space-y-1">
              {concept.participants.map((participant) => (
                <ParticipantRow
                  key={participant.index}
                  participant={participant}
                  onHighlight={onHighlightNode}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
