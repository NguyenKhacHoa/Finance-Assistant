/**
 * NotificationBell — Real-time transaction feed popover.
 * Stores notifications in localStorage under key `fa_notifications`.
 * Other parts of app can push notifications via `notificationBus.push(...)`.
 */

const NOTIF_KEY = 'fa_notifications';
const MAX_NOTIFS = 50;

export interface Notification {
  id: string;
  message: string;
  type: 'income' | 'expense' | 'badge' | 'info';
  amount?: number;
  ts: number;
  read: boolean;
}

// ── Notification Bus (singleton) ──────────────────────────────────────────────
class NotificationBusClass {
  private listeners: (() => void)[] = [];

  push(notif: Omit<Notification, 'id' | 'ts' | 'read'>) {
    const all = this.load();
    const newNotif: Notification = {
      ...notif,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      read: false,
    };
    const updated = [newNotif, ...all].slice(0, MAX_NOTIFS);
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
    this.listeners.forEach((fn) => fn());
  }

  load(): Notification[] {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  markAllRead() {
    const all = this.load().map((n) => ({ ...n, read: true }));
    localStorage.setItem(NOTIF_KEY, JSON.stringify(all));
    this.listeners.forEach((fn) => fn());
  }

  clear() {
    localStorage.removeItem(NOTIF_KEY);
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
}

export const notificationBus = new NotificationBusClass();
