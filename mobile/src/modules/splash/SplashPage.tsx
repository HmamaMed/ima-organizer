import BrandLogo from '../../shared/ui/BrandLogo';
import './SplashPage.css';

export default function SplashPage() {
  return (
    <div className="splash-screen">
      <BrandLogo variant="white" className="splash-screen__logo" />
      <p className="splash-screen__tag">made just for you</p>
    </div>
  );
}
