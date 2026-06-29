import { cn } from "@/lib/utils";

const getScoreTone = (score) => {
  const value = Number(score);

  if (Number.isNaN(value)) {
    return "muted";
  }

  if (value >= 0.7) {
    return "good";
  }

  if (value >= 0.4) {
    return "medium";
  }

  return "low";
};

const toneStyles = {
  good: {
    bar: "bg-emerald-500",
    track: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  medium: {
    bar: "bg-amber-500",
    track: "bg-amber-500/15",
    text: "text-amber-800 dark:text-amber-300",
  },
  low: {
    bar: "bg-red-500",
    track: "bg-red-500/15",
    text: "text-red-700 dark:text-red-400",
  },
  muted: {
    bar: "bg-muted-foreground/40",
    track: "bg-muted/40",
    text: "text-muted-foreground",
  },
};

const AiScoreMeter = ({ score, label, className }) => {
  const numericScore = Number(score);
  const safeScore = Number.isNaN(numericScore) ? 0 : numericScore;
  const percent = Math.round(Math.min(1, Math.max(0, safeScore)) * 100);
  const tone = getScoreTone(safeScore);
  const styles = toneStyles[tone];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className={cn("font-semibold tabular-nums", styles.text)} dir="ltr">
          {safeScore.toFixed(2)}
        </span>
      </div>
      <div
        className={cn("h-2 overflow-hidden rounded-full", styles.track)}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", styles.bar)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export { getScoreTone };
export default AiScoreMeter;
