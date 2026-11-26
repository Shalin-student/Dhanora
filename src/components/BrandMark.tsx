import React from 'react';

export const BrandMark: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const dims =
    size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-9 w-9 rounded-xl';
  const svgSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-[#003527] via-[#064E3B] to-[#0F766E] text-[#b0f0d6] shadow-sm ring-1 ring-inset ring-white/20 ${dims} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={svgSize}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Architectural Roof / Family Shield */}
        <path
          d="M4 10.5L12 4L20 10.5V18.2C20 19.1941 19.1941 20 18.2 20H5.8C4.80589 20 4 19.1941 4 18.2V10.5Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        {/* Rising Compound Wealth Bars */}
        <path
          d="M8.5 16V13.5M12 16V11M15.5 16V9"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
};
