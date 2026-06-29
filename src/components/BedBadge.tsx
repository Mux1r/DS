interface Props { bed: string; className?: string; }

export default function BedBadge({ bed, className = '' }: Props) {
  const m = bed.trim().match(/^(8|9|1[0-9]|2[01])(\d{2})(\d?)$/);
  if (!m) return <span className={className}>{bed}</span>;
  return (
    <span className={className}>
      <span>{m[1]}</span>
      <span style={{ fontSize: '0.75em', opacity: 0.5, marginLeft: 2, letterSpacing: 0 }}>{m[2]}</span>
      {m[3] && <span style={{ fontSize: '0.65em', opacity: 0.35, marginLeft: 1 }}>-{m[3]}</span>}
    </span>
  );
}
