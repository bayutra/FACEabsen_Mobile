/**
 * Brand RSU Darmayu Madiun: kotak teal + palang putih + garis nadi.
 * Geometri sama dengan Flutter `HospitalMark` (64 grid).
 */
export function HospitalMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Logo RSU Darmayu Madiun"
      className={className}
    >
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#0f766e" />
      <rect x="27" y="16" width="10" height="32" rx="2" fill="#ffffff" />
      <rect x="16" y="27" width="32" height="10" rx="2" fill="#ffffff" />
      <polyline
        points="20,32 26,32 29,24 33,40 36,32 44,32"
        fill="none"
        stroke="#0f766e"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
