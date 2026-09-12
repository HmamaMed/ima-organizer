import HeartMark from '../../shared/ui/HeartMark';
import './SplashPage.css';

export default function SplashPage() {
  return (
    <div className="splash-screen">
      <div className="splash-screen__mark">
        <HeartMark />
      </div>
      <p className="splash-screen__word font-display-italic">Life Organizer</p>
      <p className="splash-screen__tag">made just for you</p>
    </div>
  );
}
