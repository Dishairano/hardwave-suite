interface Props {
  size?: number;
  glow?: boolean;
}

export function HwLogo({ size = 64, glow = false }: Props) {
  const filter = glow ? "drop-shadow(0 0 24px rgba(232, 93, 0, 0.6))" : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter }}
    >
      <defs>
        <linearGradient id="hw-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff7a1f" />
          <stop offset="60%" stopColor="#e85d00" />
          <stop offset="100%" stopColor="#b84600" />
        </linearGradient>
      </defs>
      <rect
        x="10"
        y="10"
        width="100"
        height="100"
        rx="24"
        fill="url(#hw-grad)"
      />
      {/* Stylized H */}
      <path
        d="M40 38 L40 82 M80 38 L80 82 M40 60 L80 60"
        stroke="#08080c"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
