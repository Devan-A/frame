import React from 'react';

interface ScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md';
}

export function ScoreBadge({ score, size = 'sm' }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-[var(--figma-color-border)] text-[var(--figma-color-text-secondary)] font-medium ${
          size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'
        }`}
      >
        N/A
      </span>
    );
  }

  const scoreClass = `score-${score}`;

  return (
    <span
      className={`score-badge ${scoreClass} ${
        size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'
      }`}
    >
      {score}
    </span>
  );
}
