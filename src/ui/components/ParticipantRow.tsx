import React from 'react';
import type { Participant } from '../../types';
import { ScoreBadge } from './ScoreBadge';
import { FeatureList } from './FeatureList';

interface ParticipantRowProps {
  participant: Participant;
  onHighlight: (nodeId: string) => void;
}

export function ParticipantRow({ participant, onHighlight }: ParticipantRowProps) {
  return (
    <div className="ml-4 border-l border-[var(--figma-color-border)] pl-3 py-2">
      <div
        className="clickable-row flex items-center gap-2"
        onClick={() => onHighlight(participant.nodeId)}
        title="Click to highlight on canvas"
      >
        <ScoreBadge score={participant.conceptScore} />
        <span className="text-xs font-medium text-[var(--figma-color-text)]">
          Participant {participant.index}
        </span>
        <span className="text-[10px] text-[var(--figma-color-text-tertiary)]">
          {participant.features.length} feature{participant.features.length !== 1 ? 's' : ''}
        </span>
      </div>
      <FeatureList features={participant.features} />
    </div>
  );
}
