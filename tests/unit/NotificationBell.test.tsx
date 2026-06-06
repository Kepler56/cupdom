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

const notif = (id: string, readAt: string | null): Notification => ({
  id, recipientId: 'u1', type: 'task_overdue', contactId: 'c1',
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
});
