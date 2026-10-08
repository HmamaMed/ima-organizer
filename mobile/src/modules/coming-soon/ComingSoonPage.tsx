import { IonIcon, IonPage } from '@ionic/react';
import { addCircleOutline, lockClosedOutline } from 'ionicons/icons';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';

const UPCOMING = ['Shared calendar', 'Grocery & meal planning', 'Budget & bills', 'Travel plans'];

export default function ComingSoonPage() {
  return (
    <IonPage>
      <BrandHeader icon={addCircleOutline} title="More" accent="muted" showBack />
      <AppScreen
        title="More, in time."
        eyebrow="Future chapters"
        subtitle="A few possibilities for our little corner."
      >
        <div className="coming-soon">
          <p className="coming-soon__subtitle">
            Ideas for future chapters. They’ll find a place here when the time feels right.
          </p>
          <ul className="coming-soon__list">
            {UPCOMING.map((item) => (
              <li key={item}>
                <IonIcon icon={lockClosedOutline} />
                <span>{item}</span>
                <span className="tag-soon">Soon</span>
              </li>
            ))}
          </ul>
        </div>
      </AppScreen>
    </IonPage>
  );
}
