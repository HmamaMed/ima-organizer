import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { addCircleOutline, lockClosedOutline } from 'ionicons/icons';
import BrandHeader from '../../shared/ui/BrandHeader';

const UPCOMING = [
  'Shared calendar',
  'Grocery & meal planning',
  'Budget & bills',
  'Travel plans',
];

export default function ComingSoonPage() {
  return (
    <IonPage>
      <BrandHeader icon={addCircleOutline} title="More" accent="muted" showBack />
      <IonContent className="ion-padding">
        <div className="coming-soon">
          <h2 className="coming-soon__title font-display">More is on the way</h2>
          <p className="coming-soon__subtitle">
            New modules are being added to Life Organizer. Here's what's coming next:
          </p>
          <ul className="coming-soon__list">
            {UPCOMING.map((item) => (
              <li key={item}>
                <IonIcon icon={lockClosedOutline} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </IonContent>
    </IonPage>
  );
}
