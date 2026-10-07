import { useId } from 'react';

/** The "Neon Cat Heist" showcase scene, drawn as vector art (same look the engine produces). */
export function NeonCityScene({ className = '', title = 'Neon Cat Heist gameplay' }) {
  const id = useId();
  const sky = `${id}-sky`;
  const sun = `${id}-sun`;
  return (
    <svg viewBox="0 0 640 360" className={`block h-auto w-full ${className}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140830" />
          <stop offset="0.55" stopColor="#4A1670" />
          <stop offset="1" stopColor="#FF5CA8" />
        </linearGradient>
        <radialGradient id={sun} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD166" />
          <stop offset="1" stopColor="#FF5C8A" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${sky})`} />
      <circle cx="440" cy="200" r="90" fill={`url(#${sun})`} opacity="0.9" />
      <g fill="#2A1650">
        <rect x="0" y="170" width="70" height="190" />
        <rect x="80" y="140" width="50" height="220" />
        <rect x="300" y="160" width="60" height="200" />
        <rect x="540" y="120" width="100" height="240" />
      </g>
      <g fill="#120A24">
        <rect x="20" y="220" width="110" height="140" />
        <rect x="170" y="190" width="90" height="170" />
        <rect x="390" y="210" width="120" height="150" />
      </g>
      <g fill="#22D3EE">
        <rect x="34" y="236" width="6" height="6" />
        <rect x="58" y="260" width="6" height="6" />
        <rect x="186" y="210" width="6" height="6" />
        <rect x="410" y="232" width="6" height="6" />
      </g>
      <g fill="#FF5CA8">
        <rect x="90" y="250" width="6" height="6" />
        <rect x="226" y="240" width="6" height="6" />
        <rect x="450" y="260" width="6" height="6" />
      </g>
      <rect x="0" y="300" width="640" height="60" fill="#0B0618" />
      <rect x="0" y="300" width="640" height="3" fill="#22D3EE" />
      <rect x="200" y="250" width="120" height="10" rx="3" fill="#1C1F28" stroke="#22D3EE" strokeWidth="2" />
      <g transform="translate(240 262)">
        <ellipse cx="18" cy="24" rx="22" ry="15" fill="#7C5CFF" />
        <circle cx="38" cy="10" r="14" fill="#7C5CFF" />
        <path d="M28 0 L31 -12 L38 -2 Z M40 -2 L48 -12 L49 2 Z" fill="#7C5CFF" />
        <circle cx="43" cy="9" r="3" fill="#22D3EE" />
        <path d="M-2 24 Q-16 10 -10 0" stroke="#7C5CFF" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      <g transform="translate(470 100)">
        <ellipse cx="0" cy="0" rx="22" ry="9" fill="#1C1F28" stroke="#FF5CA8" strokeWidth="3" />
        <circle cx="0" cy="10" r="4" fill="#FF5CA8" />
      </g>
      <path d="M466 112 L330 250" stroke="#FF5CA8" strokeWidth="3" opacity="0.9" />
      <text x="20" y="34" fill="#FFFFFF" fontFamily="JetBrains Mono, monospace" fontSize="16">
        SCORE 04210
      </text>
    </svg>
  );
}

const thumbs = {
  pastel: (
    <>
      <rect width="320" height="180" fill="#E9F6EF" />
      <ellipse cx="80" cy="190" rx="140" ry="70" fill="#A8E6CF" />
      <ellipse cx="260" cy="200" rx="140" ry="80" fill="#88D8B0" />
      <g fill="#FF8FB1">
        <circle cx="120" cy="128" r="7" />
        <circle cx="140" cy="122" r="7" />
        <circle cx="200" cy="134" r="7" />
      </g>
      <ellipse cx="160" cy="130" rx="16" ry="12" fill="#B5A8FF" />
    </>
  ),
  space: (
    <>
      <rect width="320" height="180" fill="#05060F" />
      <g fill="#FFFFFF">
        <circle cx="20" cy="20" r="1" />
        <circle cx="80" cy="50" r="1.4" />
        <circle cx="150" cy="16" r="1" />
        <circle cx="290" cy="30" r="1" />
        <circle cx="40" cy="150" r="1" />
      </g>
      <circle cx="250" cy="60" r="34" fill="#3B2A8F" />
      <ellipse cx="250" cy="60" rx="56" ry="10" fill="none" stroke="#22D3EE" strokeWidth="2" opacity="0.6" />
      <path d="M120 120 L140 110 L160 120 L140 128 Z" fill="#22D3EE" />
      <rect x="200" y="118" width="14" height="3" rx="1.5" fill="#FF5CA8" />
    </>
  ),
  ink: (
    <>
      <rect width="320" height="180" fill="#F3EBDD" />
      <circle cx="230" cy="62" r="40" fill="#D94F3D" />
      <path d="M0 130 Q60 96 120 124 T240 116 T320 126 L320 180 L0 180 Z" fill="#2B2B2B" />
      <path d="M0 146 Q80 128 160 144 T320 140 L320 180 L0 180 Z" fill="#111111" />
      <circle cx="150" cy="96" r="6" fill="#111111" />
      <path d="M144 102 L156 102 L158 122 L142 122 Z" fill="#111111" />
    </>
  ),
};

export function GameThumb({ kind, title }: { kind: keyof typeof thumbs; title: string }) {
  return (
    <svg viewBox="0 0 320 180" className="block h-auto w-full" role="img" aria-label={title}>
      {thumbs[kind]}
    </svg>
  );
}
