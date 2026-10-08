import type { ButtonHTMLAttributes } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  busy?: boolean;
  icon?: string;
};

export default function AppButton({
  variant = 'primary',
  busy,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: AppButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`lo-button lo-button--${variant} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <IonSpinner name="crescent" aria-hidden="true" />
      ) : icon ? (
        <IonIcon icon={icon} aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
