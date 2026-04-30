type LogoProps = {
  className?: string;
  ariaLabel?: string;
};

export default function Logo({ className = '', ariaLabel = 'EduNav logo' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      role="img"
      aria-label={ariaLabel}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="64" cy="64" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
      <circle cx="64" cy="64" r="36" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="64" y1="8" x2="64" y2="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="64" y1="108" x2="64" y2="120" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="8" y1="64" x2="20" y2="64" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="108" y1="64" x2="120" y2="64" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="36" y1="92" x2="90" y2="38" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <polygon points="90 38 110 30 104 52" fill="currentColor" />
      <circle cx="96" cy="38" r="4" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
