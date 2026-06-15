interface BrandLogoProps {
  className?: string;
  size?: number;
}

/** Simplified APIScope mark — magnifying glass with stacked blocks. */
export function BrandLogo({ className, size = 24 }: BrandLogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="32" height="32" rx="7" className="brand-logo-bg" />
      <circle
        cx="14"
        cy="14"
        r="7.5"
        className="brand-logo-ring"
        strokeWidth="2.2"
        fill="none"
      />
      <path
        d="M19.5 19.5L24 24"
        className="brand-logo-ring-stroke"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="10.5" y="10" width="7" height="2.2" rx="0.6" className="brand-logo-block-light" />
      <rect x="10.5" y="13" width="7" height="2.2" rx="0.6" className="brand-logo-block-accent" />
      <rect x="10.5" y="16" width="7" height="2.2" rx="0.6" className="brand-logo-block-cyan" />
      <path
        d="M4 14h3M4 11.5h4.5M4 16.5h3.5"
        className="brand-logo-speed-stroke"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
