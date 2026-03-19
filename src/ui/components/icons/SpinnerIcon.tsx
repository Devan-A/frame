import React from 'react';

interface SpinnerIconProps {
  className?: string;
}

export function SpinnerIcon({ className }: SpinnerIconProps) {
  return (
    <svg
      className={`animate-spin ${className || ''}`}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M10 2C14.4183 2 18 5.58172 18 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
