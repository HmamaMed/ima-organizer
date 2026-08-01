import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const UPCOMING = [
  'Shared calendar',
  'Grocery & meal planning',
  'Budget & bills',
  'Travel plans',
];

export default function ComingSoonPage() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>More</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="coming-soon">
          <h2 className="coming-soon__title font-display">More is on the way</h2>
          <p className="coming-soon__subtitle">
            New modules are being added to Life Organizer. Here's what's coming next:
          </p>
          <ul className="coming-soon__list">
            {UPCOMING.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </IonContent>
    </IonPage>
  );
}
