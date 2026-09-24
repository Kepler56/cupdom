import { describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBell } from '@/components/organisms/NotificationBell';
import { useNotifications } from '@/lib/notifications';
import type { Notification } from '@/types/domain';

vi.mock('next/link', () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/notifications', () => ({ useNotifications: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/apercu' }));

const notif = (id: string, readAt: string | null): Notification => ({
  id, recipientId: 'u1', type: 'task_overdue', contactId: 'c1', campaignSlug: null,
  payload: { kind: 'task_overdue', taskId: 't', label: 'Appeler', dueDate: '2026-01-01', company: 'Acme' },
  createdAt: new Date().toISOString(), readAt,
});

function setup(over: Partial<ReturnType<typeof useNotifications>> = {}) {
  const markRead = vi.fn();
  const markAllRead = vi.fn();
  (useNotifications as Mock).mockReturnValue({
    items: [notif('n1', null), notif('n2', null)],
    unreadCount: 2,
    loading: false,
    markRead,
    markAllRead,
    refresh: vi.fn(),
    ...over,
  });
  return { markRead, markAllRead };
}

describe('NotificationBell', () => {
  it('shows the unread count badge', () => {
    setup();
    render(<NotificationBell />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('hides the badge when there are no unread items', () => {
    setup({ items: [], unreadCount: 0 });
    render(<NotificationBell />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('opens the dropdown, lists items, and "Tout marquer comme lu" calls markAllRead', () => {
    const { markAllRead } = setup();
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getAllByText(/Tâche en retard/)).toHaveLength(2);
    fireEvent.click(screen.getByText('Tout marquer comme lu'));
    expect(markAllRead).toHaveBeenCalled();
  });

  it('clicking an item marks it read', () => {
    const { markRead } = setup();
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    fireEvent.click(screen.getAllByText(/Tâche en retard/)[0]);
    expect(markRead).toHaveBeenCalledWith('n1');
  });

  it('pins an unread scan-drop as an in-app alert; opening the campaign marks it read (#6)', () => {
    const drop: Notification = {
      id: 'd1', recipientId: 'u1', type: 'scan_drop', contactId: null, campaignSlug: 'rex',
      payload: { kind: 'scan_drop', campaignSlug: 'rex', sponsorName: 'Boulanger', burstCount: 8, dropCount: 0, windowMinutes: 10, detectedAt: '2026-09-24T01:00:00Z' },
      createdAt: '2026-09-24T01:00:00Z', readAt: null,
    };
    const { markRead } = setup({ items: [drop], unreadCount: 1 });
    render(<NotificationBell />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Chute de scans : Boulanger');
    expect(alert).toHaveTextContent('8 scans puis 0');
    fireEvent.click(screen.getByRole('link', { name: 'Voir la campagne' }));
    expect(markRead).toHaveBeenCalledWith('d1');
  });

  it('dismissing the alert marks it read', () => {
    const drop: Notification = {
      id: 'd2', recipientId: 'u1', type: 'scan_drop', contactId: null, campaignSlug: 'rex',
      payload: { kind: 'scan_drop', campaignSlug: 'rex', sponsorName: 'Boulanger', burstCount: 8, dropCount: 0, windowMinutes: 10, detectedAt: '2026-09-24T01:00:00Z' },
      createdAt: '2026-09-24T01:00:00Z', readAt: null,
    };
    const { markRead } = setup({ items: [drop], unreadCount: 1 });
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Ignorer l’alerte'));
    expect(markRead).toHaveBeenCalledWith('d2');
  });

  it('shows no in-app alert when there is no unread scan-drop', () => {
    setup();
    render(<NotificationBell />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
