import type { Account, Credentials } from '../../couples/sessionContext';

export interface SessionPersistence {
  read(): Promise<{ token: string | null; restore: boolean }>;
  write(token: string | null): Promise<void>;
  clear(): Promise<void>;
}
export interface SessionTransport {
  login(email: string, password: string): Promise<Credentials>;
  refresh(token: string | null): Promise<Credentials>;
  logout(token: string | null): Promise<void>;
}
export interface SessionSnapshot {
  credentials: Credentials | null;
  status: 'restoring' | 'ready' | 'unavailable';
}
const unauthorized = (error: unknown) => !!error && typeof error === 'object' && 'status' in error && error.status === 401;

/** Serializes rotation and disk writes, including logout while a refresh is in flight. */
export class SessionManager {
  private snapshot: SessionSnapshot = { credentials: null, status: 'restoring' };
  private listeners = new Set<() => void>();
  private operations: Promise<unknown> = Promise.resolve();
  private started: Promise<void> | null = null;
  private renewing: Promise<string | null> | null = null;
  private generation = 0;
  private refreshToken: string | null = null;
  private previousTokens = new Set<string>();
  private persistence: SessionPersistence;
  private transport: SessionTransport;

  constructor(persistence: SessionPersistence, transport: SessionTransport) { this.persistence = persistence; this.transport = transport; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(credentials: Credentials | null, status: SessionSnapshot['status'] = 'ready') {
    this.snapshot = { credentials, status };
    this.listeners.forEach(listener => listener());
  }
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.operations.then(task);
    this.operations = result.catch(() => {});
    return result;
  }
  private async accept(credentials: Credentials, version: number) {
    this.refreshToken = credentials.refreshToken;
    if (version !== this.generation) return;
    try { await this.persistence.write(credentials.refreshToken); }
    catch (error) {
      // Rotation has already happened on the server. Never keep using an obsolete disk token.
      this.refreshToken = null; this.publish(null);
      try { await this.persistence.clear(); }
      finally { await this.transport.logout(credentials.refreshToken).catch(() => {}); }
      throw error;
    }
    if (version === this.generation) this.publish(credentials);
  }
  start = () => this.started ??= this.restore();
  restore = () => {
    const version = this.generation;
    this.publish(null, 'restoring');
    return this.enqueue(async () => {
      if (version !== this.generation) return;
      try {
        const saved = await this.persistence.read();
        this.refreshToken = saved.token;
        if (!saved.restore) { if (version === this.generation) this.publish(null); return; }
        await this.accept(await this.transport.refresh(saved.token), version);
      } catch (error) {
        if (version !== this.generation) return;
        if (unauthorized(error)) {
          this.refreshToken = null; this.publish(null);
          try { await this.persistence.clear(); }
          catch { this.publish(null, 'unavailable'); }
        } else this.publish(null, 'unavailable');
      }
    });
  };
  login = (email: string, password: string) => {
    const version = ++this.generation;
    return this.enqueue(async () => {
      const credentials = await this.transport.login(email, password);
      this.previousTokens.clear();
      await this.accept(credentials, version);
    });
  };
  logout = () => {
    ++this.generation; this.previousTokens.clear(); this.publish(null);
    return this.enqueue(async () => {
      // Also creates a non-secret browser sign-out marker for an offline logout.
      const token = this.refreshToken; this.refreshToken = null;
      try { await this.persistence.clear(); }
      catch (error) { this.publish(null, 'unavailable'); throw error; }
      finally { await this.transport.logout(token).catch(() => {}); }
    });
  };
  invalidate = (usedToken?: string) => {
    if (!usedToken || (this.snapshot.credentials?.token !== usedToken && !this.previousTokens.has(usedToken))) return;
    void this.logout().catch(() => {}); // A vault failure is exposed through the unavailable state.
  };
  recover = (usedToken: string): Promise<string | null> => {
    const active = this.snapshot.credentials;
    if (!active) return Promise.resolve(null);
    if (usedToken !== active.token) return Promise.resolve(this.previousTokens.has(usedToken) ? active.token : null);
    if (this.renewing) return this.renewing;
    const version = this.generation;
    const operation = this.enqueue(async () => {
      if (version !== this.generation) return null;
      try {
        const next = await this.transport.refresh(this.refreshToken);
        this.previousTokens.add(active.token);
        await this.accept(next, version);
        return version === this.generation ? next.token : null;
      } catch (error) {
        if (unauthorized(error) && version === this.generation) {
          ++this.generation; this.refreshToken = null; this.previousTokens.clear(); this.publish(null);
          try { await this.persistence.clear(); }
          catch { this.publish(null, 'unavailable'); }
        }
        throw error;
      }
    });
    this.renewing = operation;
    void operation.finally(() => { if (this.renewing === operation) this.renewing = null; }).catch(() => {});
    return operation;
  };
  updateUser(user: Account) {
    if (this.snapshot.credentials?.user.userId === user.userId) this.publish({ ...this.snapshot.credentials, user });
  }
}
