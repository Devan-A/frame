import React from 'react';

interface BoardIconProps {
  className?: string;
}

export function BoardIcon({ className }: BoardIconProps) {
  return (
    <svg
      className={className}
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="10" y="10" width="12" height="8" rx="2" fill="currentColor" fillOpacity="0.3" />
      <rect x="26" y="10" width="12" height="8" rx="2" fill="currentColor" fillOpacity="0.3" />
      <rect x="10" y="22" width="12" height="8" rx="2" fill="currentColor" fillOpacity="0.3" />
      <rect x="26" y="22" width="12" height="8" rx="2" fill="currentColor" fillOpacity="0.3" />
      <rect x="10" y="34" width="28" height="4" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}
