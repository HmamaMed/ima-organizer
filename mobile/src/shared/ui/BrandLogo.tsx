import horizontalColor from '../../assets/brand/logo-horizontal-color.svg';
import stackedColor from '../../assets/brand/logo-stacked-color.svg';
import stackedWhite from '../../assets/brand/logo-stacked-white.svg';

const logos = { horizontal: horizontalColor, stacked: stackedColor, white: stackedWhite };

export default function BrandLogo({
  variant = 'horizontal',
  className = '',
}: {
  variant?: keyof typeof logos;
  className?: string;
}) {
  return <img src={logos[variant]} alt="Entre Nous" className={`brand-logo ${className}`} />;
}
