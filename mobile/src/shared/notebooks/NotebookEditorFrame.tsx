import { t, useI18n, getLanguage } from "../i18n";
import type { FormEvent, ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import AppButton from '../ui/AppButton';

export default function NotebookEditorFrame({ title, titleId, eyebrow, busy, error, submitLabel, onClose, onSubmit, children }: {
  title: string; titleId: string; eyebrow: string; busy: boolean; error: string | null; submitLabel: string;
  onClose: () => void; onSubmit: (event: FormEvent) => void; children: ReactNode;
}) {
  useI18n();
  return <form className="notebook-editor__body" onSubmit={onSubmit} lang={getLanguage()}>
    <div className="notebook-editor__top"><p className="lo-eyebrow">{eyebrow}</p>
      <button type="button" className="icon-btn" aria-label={t("Fermer le formulaire")} disabled={busy} onClick={onClose}><IonIcon icon={closeOutline} /></button></div>
    <h2 id={titleId}>{title}</h2>
    <fieldset className="notebook-fields" disabled={busy}>{children}</fieldset>
    {error && <p className="notebook-error" role="alert">{error}</p>}
    <AppButton type="submit" icon={checkmarkOutline} busy={busy}>{submitLabel}</AppButton>
  </form>;
}
