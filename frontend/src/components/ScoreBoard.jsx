import { useMemo } from "react";

const ScoreBoard = ({ score, flash }) => {
  const status = useMemo(() => {
    if (score <= 20) return "critical";
    if (score <= 50) return "warning";
    return "healthy";
  }, [score]);

  const colorClass =
    status === "critical"
      ? "text-red-300"
      : status === "warning"
        ? "text-orange-300"
        : "text-emerald-300";

  const pulseClass = status === "critical" ? "score-pulse" : "";
  const flashClass = flash ? "score-flash" : "";

  return (
    <div className="flex flex-col items-center">
      <div className={`text-xs uppercase tracking-[0.2em] text-slate-400`}>
        Resilienz-Score
      </div>
      <div
        className={`text-3xl sm:text-4xl font-bold ${colorClass} ${pulseClass} ${flashClass}`}
      >
        {score.toFixed(1)}%
      </div>
    </div>
  );
};

export default ScoreBoard;

