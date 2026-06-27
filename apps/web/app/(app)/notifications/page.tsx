import { Bell, Check } from 'lucide-react';
import { getNotifications } from '@/lib/notifications';
import { markAllReadAction } from './actions';

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
        {hasUnread && (
          <form action={markAllReadAction}>
            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
              <Check size={15} /> Mark all read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center text-[var(--muted)]">
          <Bell size={28} />
          <p className="text-sm">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className={`card ${!n.read_at ? 'border-brand/40 bg-brand-light/30' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-brand-light p-1.5 text-brand-dark">
                  <Bell size={15} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.body && <p className="text-sm text-[var(--muted)]">{n.body}</p>}
                  <p className="stat-label mt-0.5">
                    {new Date(n.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
                {!n.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-brand" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
