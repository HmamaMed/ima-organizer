interface ProgressRingProps {
  done: number;
  total: number;
  size?: number;
}

/**
 * The session's progress dial — fills in gold as exercises get ticked.
 * Pure SVG so the sweep animates via a CSS transition on stroke-dashoffset,
 * with no animation library.
 */
export default function ProgressRing({ done, total, size = 132 }: ProgressRingProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : done / total;
  const complete = total > 0 && done === total;

  return (
    <div className={`progress-ring ${complete ? 'progress-ring--complete' : ''}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="progress-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="progress-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="progress-ring__label">
        <span className="progress-ring__count font-display">{done}<span className="progress-ring__of">/{total}</span></span>
        <span className="progress-ring__caption">{complete ? 'done ♥' : 'exercises'}</span>
      </div>
    </div>
  );
}
