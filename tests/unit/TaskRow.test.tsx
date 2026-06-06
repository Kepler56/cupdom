import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskRow } from '@/components/molecules/TaskRow';
import type { Task } from '@/types/domain';

const base: Task = {
  id: 't1', contactId: 'c1', label: 'Appeler', dueDate: '2020-01-01', doneAt: null,
  createdAt: '', updatedAt: '',
};

describe('TaskRow', () => {
  it('overdue + not done → En retard chip, checkbox unchecked', () => {
    render(<TaskRow task={base} canEdit onToggle={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('En retard')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('done → faded strikethrough + checked, no overdue chip', () => {
    render(
      <TaskRow task={{ ...base, doneAt: '2026-06-01T00:00:00Z' }} canEdit onToggle={() => {}} onDelete={() => {}} />,
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Appeler')).toHaveClass('line-through');
    expect(screen.queryByText('En retard')).toBeNull();
  });

  it('read-only → checkbox disabled, no delete control', () => {
    render(<TaskRow task={base} canEdit={false} onToggle={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.queryByLabelText(/^Supprimer /)).toBeNull();
  });
});
