interface Props {
  data: number[];
  width?: number;
  height?: number;
}

export default function Sparkline({ data, width = 100, height = 32 }: Props) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`);
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} className="sparkline">
      <polyline points={points.join(" ")} fill="none" stroke={up ? "#2ebd85" : "#e04f5f"} strokeWidth={1.5} />
    </svg>
  );
}
