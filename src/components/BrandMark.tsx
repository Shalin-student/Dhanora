import React from 'react';

export type BrandSize = 'sm' | 'md' | 'lg';

export const BrandMark: React.FC<{
  size?: BrandSize;
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const dims =
    size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const svgPx = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  const svgSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-[#003527] via-[#064E3B] to-[#0F766E] text-[#b0f0d6] shadow-sm ring-1 ring-inset ring-white/20 ${dims} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={svgPx}
        height={svgPx}
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
        {/* Marigold Heirloom Coin Accent */}
        <circle cx="18" cy="5.5" r="2" fill="#D97706" />
      </svg>
    </span>
  );
};

export const BrandWordmark: React.FC<{
  size?: BrandSize;
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
  subtitleClassName?: string;
  forceLight?: boolean;
}> = ({
  size = 'md',
  showSubtitle = false,
  subtitle,
  className = '',
  subtitleClassName = '',
  forceLight = false,
}) => {
  const titleSize =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg sm:text-xl' : 'text-[15px] sm:text-base';

  return (
    <span className={`block min-w-0 ${className}`}>
      <span dir="ltr" className={`block truncate leading-tight ${titleSize}`}>
        <span
          className={`font-extrabold tracking-[-0.03em] text-[#131b2e]${
            forceLight ? '' : ' dark:text-white'
          }`}
          style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
          Dhanora
        </span>
        {' '}
        <span
          className={`font-semibold text-[#064E3B]${forceLight ? '' : ' dark:text-[#b0f0d6]'}`}
          style={{ fontFamily: "'Noto Sans Gujarati', 'Plus Jakarta Sans', sans-serif" }}
        >
          (ધનોરા)
        </span>
      </span>
      {showSubtitle && subtitle ? (
        <span
          className={`block truncate text-[11px] font-medium text-[#0F766E]${
            forceLight ? '' : ' dark:text-[#80bea6]'
          } ${subtitleClassName}`}
        >
          {subtitle}
        </span>
      ) : null}
    </span>
  );
};

export const BrandLogoButton: React.FC<{
  onClick?: () => void;
  size?: BrandSize;
  ariaLabel?: string;
  className?: string;
  subtitle?: string;
  showSubtitle?: boolean;
  subtitleClassName?: string;
  forceLight?: boolean;
}> = ({
  onClick,
  size = 'md',
  ariaLabel = 'Dhanora (ધનોરા)',
  className = '',
  subtitle,
  showSubtitle,
  subtitleClassName = '',
  forceLight = false,
}) => {
  const displaySubtitle = showSubtitle ?? Boolean(subtitle);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex min-h-[44px] min-w-[44px] max-w-full cursor-pointer items-center gap-2.5 rounded-xl px-1 py-1 text-left transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${className}`}
    >
      <BrandMark size={size} />
      <BrandWordmark
        size={size}
        showSubtitle={displaySubtitle}
        subtitle={subtitle}
        subtitleClassName={subtitleClassName}
        forceLight={forceLight}
      />
    </button>
  );
};

export const BrandLockup = BrandLogoButton;
