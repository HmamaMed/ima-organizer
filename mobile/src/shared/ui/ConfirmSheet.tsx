import { IonContent, IonModal } from '@ionic/react';
import AppButton from './AppButton';

export default function ConfirmSheet({
  open,
  title,
  detail,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy,
  destructive = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <IonModal
      className="lo-confirm"
      isOpen={open}
      onDidDismiss={onClose}
      canDismiss={!busy}
      aria-labelledby="confirm-title"
    >
      <IonContent>
        <div className="lo-confirm__body">
          <h2 id="confirm-title">{title}</h2>
          <p>{detail}</p>
          <AppButton variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </AppButton>
        </div>
      </IonContent>
    </IonModal>
  );
}
