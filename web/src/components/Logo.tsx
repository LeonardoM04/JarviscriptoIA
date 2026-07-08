// Marca Quad₿lock recriada em SVG (moldura de 4 cantos + ₿), pra poder animar.
// Usa currentColor, então herda a cor do contexto.

export default function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={`qb-logo ${className}`} aria-label="Quad Block">
      <path className="qb-bracket" d="M12 40 L12 20 Q12 12 20 12 L40 12" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path className="qb-bracket" d="M60 12 L80 12 Q88 12 88 20 L88 40" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path className="qb-bracket" d="M88 60 L88 80 Q88 88 80 88 L60 88" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path className="qb-bracket" d="M40 88 L20 88 Q12 88 12 80 L12 60" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <text className="qb-b" x="50" y="54" textAnchor="middle" dominantBaseline="central"
        fontSize="46" fontWeight="800" fill="currentColor" fontFamily="'Segoe UI', system-ui, sans-serif">₿</text>
    </svg>
  );
}
