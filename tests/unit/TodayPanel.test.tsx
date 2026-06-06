import { describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodayPanel } from '@/components/organisms/TodayPanel';
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

const reminder: Notification = {
  id: 'r1', recipientId: 'u1', type: 'reminder_due', contactId: 'c1',
  payload: { kind: 'reminder_due', reminderId: 'x', note: 'Relancer', remindOn: '2026-06-01', company: 'Acme' },
  createdAt: new Date().toISOString(), readAt: null,
};
const task: Notification = {
  id: 't1', recipientId: 'u1', type: 'task_overdue', contactId: 'c2',
  payload: { kind: 'task_overdue', taskId: 'y', label: 'Appeler', dueDate: '2026-05-01', company: 'Globex' },
  createdAt: new Date().toISOString(), readAt: null,
};

function setup(items: Notification[]) {
  const markRead = vi.fn();
  (useNotifications as Mock).mockReturnValue({
    items, unreadCount: items.filter((n) => n.readAt == null).length, loading: false,
    markRead, markAllRead: vi.fn(), refresh: vi.fn(),
  });
  return { markRead };
}

describe('TodayPanel', () => {
  it('groups pending items under French subheaders', () => {
    setup([reminder, task]);
    render(<TodayPanel />);
    expect(screen.getByText('Rappels du jour')).toBeInTheDocument();
    expect(screen.getByText('Tâches en retard')).toBeInTheDocument();
    expect(screen.queryByText('À relancer')).toBeNull(); // no gone_quiet items
  });

  it('shows the empty state when nothing is pending', () => {
    setup([{ ...task, readAt: new Date().toISOString() }]); // read → not pending
    render(<TodayPanel />);
    expect(screen.getByText(/Rien à traiter aujourd/)).toBeInTheDocument();
  });

  it('clicking an item marks it read', () => {
    const { markRead } = setup([reminder]);
    render(<TodayPanel />);
    fireEvent.click(screen.getByText(/Relancer/));
    expect(markRead).toHaveBeenCalledWith('r1');
  });
});
