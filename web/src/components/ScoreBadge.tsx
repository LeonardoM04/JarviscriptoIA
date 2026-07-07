import { scoreColor } from "../utils";
import type { Score } from "../types";

export default function ScoreBadge({ score, showLabel = true }: { score: Score; showLabel?: boolean }) {
  const color = scoreColor(score.score);
  return (
    <span className="score-badge" style={{ borderColor: color, color }}>
      <b>{score.score}</b>
      {showLabel && <span className="score-momentum">{score.momentum}</span>}
    </span>
  );
}
