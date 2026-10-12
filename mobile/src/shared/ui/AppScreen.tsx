import type { ComponentProps, ReactNode } from 'react';
import { IonContent } from '@ionic/react';

type AppScreenProps = ComponentProps<typeof IonContent> & {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Ionic fixed-slot elements (such as pull-to-refresh) must sit directly under IonContent. */
  fixedContent?: ReactNode;
};

/** Ionic remains responsible for scrolling, keyboard resize, and safe areas. */
export default function AppScreen({
  title,
  eyebrow,
  subtitle,
  action,
  fixedContent,
  children,
  className = '',
  ...props
}: AppScreenProps) {
  return (
    <IonContent {...props} className={`lo-screen ${className}`}>
      {fixedContent}
      <div className="lo-screen__inner">
        {title && (
          <div className="lo-screen__intro">
            {eyebrow && <p className="lo-eyebrow">{eyebrow}</p>}
            <h1 className="lo-screen__title">{title}</h1>
            {subtitle && <p className="lo-screen__subtitle">{subtitle}</p>}
            {action}
          </div>
        )}
        {children}
      </div>
    </IonContent>
  );
}
