export const INVITATION_KEY = 'life-organizer.pending-invitation';
export function rememberInvitation(value: string) { if (/^[\w-]{43}$/.test(value)) sessionStorage.setItem(INVITATION_KEY, value); }
