import markColor from '../../assets/brand/mark-color.svg';
import markWhite from '../../assets/brand/mark-white.svg';

/** Decorative two-page symbol; use BrandLogo when the app name is needed. */
export default function HeartMark({
  className,
  variant = 'color',
}: {
  className?: string;
  variant?: 'color' | 'white';
}) {
  return (
    <img
      src={variant === 'white' ? markWhite : markColor}
      className={className ? `brand-mark ${className}` : 'brand-mark'}
      alt=""
      aria-hidden="true"
    />
  );
}
