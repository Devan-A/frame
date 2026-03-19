import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && (
        <div className="mb-4 text-[var(--figma-color-text-tertiary)]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-[var(--figma-color-text)] mb-2">
        {title}
      </h3>
      <p className="text-xs text-[var(--figma-color-text-secondary)] max-w-[240px]">
        {description}
      </p>
    </div>
  );
}
