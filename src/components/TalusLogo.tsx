interface TalusLogoProps {
  className?: string;
  size?: number;
}

export function TalusLogo({ className = "", size = 32 }: TalusLogoProps) {
  return (
    <img
      src="/talus-logo.png"
      alt="Talus"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
}

export function TalusWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold text-xl tracking-tight ${className}`}>
      Talus
    </span>
  );
}
