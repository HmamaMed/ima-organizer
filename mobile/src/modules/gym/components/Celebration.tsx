import { useEffect, useState } from 'react';

/** Rose / gold / plum, so the confetti stays inside the app's palette. */
const COLORS = ['#C65D7B', '#B8935A', '#4A1942', '#E8B4C4'];
const PIECES = 42;

interface CelebrationProps {
  show: boolean;
  message: string;
  onDone: () => void;
}

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
}

/**
 * The payoff when she finishes a session — confetti plus a line from the app.
 * Hand-rolled: 42 absolutely-positioned divs on a CSS keyframe beats pulling in
 * a canvas confetti dependency for one moment.
 */
export default function Celebration({ show, message, onDone }: CelebrationProps) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!show) return;

    setPieces(
      Array.from({ length: PIECES }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.8 + Math.random() * 1.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      })),
    );

    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="celebration" role="status">
      <div className="celebration__confetti" aria-hidden="true">
        {pieces.map((piece, i) => (
          <span
            key={i}
            className="celebration__piece"
            style={{
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size * 0.6}px`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              transform: `rotate(${piece.rotation}deg)`,
            }}
          />
        ))}
      </div>
      <div className="celebration__card">
        <span className="celebration__emoji">🎉</span>
        <p className="celebration__text font-display-italic">{message}</p>
      </div>
    </div>
  );
}
