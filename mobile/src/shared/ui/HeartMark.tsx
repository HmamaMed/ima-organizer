import { useId } from 'react';

/** The two-tone heart mark from icon.svg / logo.svg — rose on one half, gold on the other. */
export default function HeartMark({ className }: { className?: string }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d="M100 172 C 44 128, 14 90, 14 58 C 14 26, 38 8, 64 8 C 82 8, 94 18, 100 32 C 106 18, 118 8, 136 8 C 162 8, 186 26, 186 58 C 186 90, 156 128, 100 172 Z" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="100" height="200" fill="#C65D7B" clipPath={`url(#${clipId})`} />
      <rect x="100" y="0" width="100" height="200" fill="#B8935A" clipPath={`url(#${clipId})`} />
    </svg>
  );
}
