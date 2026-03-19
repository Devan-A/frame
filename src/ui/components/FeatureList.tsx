import React from 'react';
import type { Feature } from '../../types';

interface FeatureListProps {
  features: Feature[];
}

export function FeatureList({ features }: FeatureListProps) {
  if (features.length === 0) {
    return (
      <p className="text-xs text-[var(--figma-color-text-tertiary)] italic pl-6 py-1">
        No features found
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-1">
      {features.map((feature) => (
        <div key={feature.index} className="feature-item">
          <div className="flex items-start gap-2">
            <span className="text-[10px] text-[var(--figma-color-text-tertiary)] font-mono mt-0.5">
              {feature.index}.
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--figma-color-text)] break-words">
                {feature.title}
              </p>
              <p className="text-xs text-[var(--figma-color-text-secondary)] break-words mt-0.5">
                {feature.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
