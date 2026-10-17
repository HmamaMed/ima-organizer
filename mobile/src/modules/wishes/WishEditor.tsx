import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IonIcon } from '@ionic/react';
import { cameraOutline, checkmarkOutline, closeOutline } from 'ionicons/icons';
import AppButton from '../../shared/ui/AppButton';
import { saveWish, uploadWishPhoto, WISH_CATEGORIES, type Wish, type WishCategory } from './wishesApi';

export default function WishEditor({ entry, token, onSaved, onClose, onBusyChange }: {
  entry: Wish | null; token: string; onSaved: (entry: Wish) => void; onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [category, setCategory] = useState<WishCategory>(entry?.category ?? 'OBJECT');
  const [details, setDetails] = useState(entry?.details ?? '');
  const [link, setLink] = useState(entry?.link ?? '');
  const [photoId, setPhotoId] = useState(entry?.photoId ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(entry?.photoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pending = useRef(false);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!title.trim()) { setError('Donnez un petit nom à cette envie.'); return; }
    if (link.trim()) {
      try {
        const url = new URL(link.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { setError('Ajoutez un lien complet commençant par https:// ou http://.'); return; }
    }
    pending.current = true; setBusy(true); onBusyChange(true); setError(null);
    try {
      let nextPhotoId = photoId;
      if (file) {
        if (uploaded.current?.file !== file) {
          setUploading(true);
          const photo = await uploadWishPhoto(token, file);
          uploaded.current = { file, id: photo.id };
          setUploading(false);
        }
        nextPhotoId = uploaded.current!.id;
      }
      onSaved(await saveWish(token, { title: title.trim(), category, details: details.trim() || null, link: link.trim() || null, photoId: nextPhotoId }, entry?.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer cette envie. Réessayez.'); }
    finally { pending.current = false; setBusy(false); setUploading(false); onBusyChange(false); }
  }
  return <form className="wish-editor__body" onSubmit={submit} lang="fr">
    <div className="wish-editor__top"><p className="lo-eyebrow">Une petite idée à garder</p>
      <button type="button" className="icon-btn" disabled={busy} aria-label="Fermer le formulaire" onClick={onClose}><IonIcon icon={closeOutline} /></button></div>
    <h2 id="wish-editor-title">{entry ? 'Affiner cette envie.' : 'Qu’est-ce qui vous ferait plaisir ?'}</h2>
    <fieldset disabled={busy} className="wish-fields">
      <label className="wish-field" htmlFor="wish-title"><span>Mon envie <span aria-hidden="true">*</span></span>
        <input id="wish-title" required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} placeholder="Un livre pour les dimanches…" autoComplete="off" /></label>
      <label className="wish-field" htmlFor="wish-category"><span>Catégorie</span>
        <select id="wish-category" value={category} onChange={event => setCategory(event.target.value as WishCategory)}>{WISH_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <div className="wish-photo-field">
        {preview && <img className="wish-photo-preview" src={preview} alt="Aperçu de l’envie" />}
        <label className="wish-photo-picker" htmlFor="wish-photo"><IonIcon icon={cameraOutline} aria-hidden="true" /><span>{preview ? 'Changer la photo' : 'Ajouter une photo'}<small>Facultatif · JPEG, PNG, WebP · 10 Mo max.</small></span>
          <input id="wish-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
            const picked = event.target.files?.[0];
            if (!picked) return;
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type) || picked.size === 0 || picked.size > 10 * 1024 * 1024) {
              setError('Choisissez une photo JPEG, PNG ou WebP de moins de 10 Mo.'); event.target.value = ''; return;
            }
            setError(null); uploaded.current = null; setFile(picked);
          }} /></label>
        {preview && <button type="button" className="wish-remove-photo" onClick={() => { setFile(null); setPhotoId(null); setPreview(null); uploaded.current = null; }}>Retirer la photo</button>}
      </div>
      <label className="wish-field" htmlFor="wish-link"><span>Le lien <small>facultatif</small></span>
        <input id="wish-link" type="url" maxLength={2000} value={link} onChange={event => setLink(event.target.value)} placeholder="https://…" inputMode="url" autoCapitalize="none" autoComplete="off" /></label>
      <label className="wish-field" htmlFor="wish-details"><span>Les petites précisions <small>facultatif</small></span>
        <textarea id="wish-details" rows={4} maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} placeholder="La couleur, la taille, une édition préférée…" /></label>
    </fieldset>
    {error && <p className="wish-error" role="alert">{error}</p>}
    <AppButton type="submit" icon={checkmarkOutline} busy={busy}>{uploading ? 'Envoi de la photo…' : entry ? 'Enregistrer les modifications' : 'Garder cette envie'}</AppButton>
    <p className="wish-editor__note">Vos envies sont visibles par votre partenaire, pour lui donner de jolies idées.</p>
  </form>;
}
