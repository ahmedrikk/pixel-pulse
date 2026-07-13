interface TalusLogoProps {
  className?: string;
  size?: number;
}

export function TalusLogo({ className = "", size = 32 }: TalusLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Talus"
    >
      {/* Pixelated T icon */}
      <rect x="4" y="4" width="24" height="6" rx="1" className="fill-primary" />
      <rect x="10" y="10" width="12" height="4" rx="1" className="fill-primary" />
      <rect x="13" y="14" width="6" height="14" rx="1" className="fill-primary" />
    </svg>
  );
}

export function TalusWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold text-xl tracking-tight ${className}`}>
      Talus
    </span>
  );
}
