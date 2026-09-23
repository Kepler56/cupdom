import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationItem } from '@/components/molecules/NotificationItem';
import type { Notification } from '@/types/domain';

const scanDrop: Notification = {
  id: 'n1',
  recipientId: 'u1',
  type: 'scan_drop',
  contactId: null,
  campaignSlug: 'rex-club-2026',
  payload: {
    kind: 'scan_drop',
    campaignSlug: 'rex-club-2026',
    sponsorName: 'Nike',
    burstCount: 8,
    dropCount: 0,
    windowMinutes: 10,
    detectedAt: '2026-09-23T01:00:00Z',
  },
  createdAt: '2026-09-23T01:00:00Z',
  readAt: null,
};

const taskOverdue: Notification = {
  id: 'n2',
  recipientId: 'u1',
  type: 'task_overdue',
  contactId: 'c1',
  campaignSlug: null,
  payload: { kind: 'task_overdue', taskId: 't', label: 'Appeler', dueDate: '2026-01-01', company: 'Acme' },
  createdAt: '2026-09-23T01:00:00Z',
  readAt: null,
};

describe('NotificationItem — scan_drop', () => {
  it('renders the sponsor in the headline and the burst→drop counts as the tag', () => {
    render(<NotificationItem notification={scanDrop} onMarkRead={vi.fn()} />);
    expect(screen.getByText('Chute de scans : Nike')).toBeInTheDocument();
    expect(screen.getByText('8→0')).toBeInTheDocument();
  });

  it('links to the campaign, not a contact', () => {
    render(<NotificationItem notification={scanDrop} onMarkRead={vi.fn()} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/campagnes/rex-club-2026');
  });

  it('falls back to « campagne » when the sponsor name is missing', () => {
    render(
      <NotificationItem
        notification={{
          ...scanDrop,
          payload: {
            kind: 'scan_drop',
            campaignSlug: 'rex-club-2026',
            sponsorName: null,
            burstCount: 8,
            dropCount: 0,
            windowMinutes: 10,
            detectedAt: '2026-09-23T01:00:00Z',
          },
        }}
        onMarkRead={vi.fn()}
      />,
    );
    expect(screen.getByText('Chute de scans : campagne')).toBeInTheDocument();
  });

  it('still links a contact-keyed notification to its contact (unchanged behaviour)', () => {
    render(<NotificationItem notification={taskOverdue} onMarkRead={vi.fn()} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/contacts/c1');
  });
});
