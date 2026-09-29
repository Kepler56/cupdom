import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeriodSwitch } from '@/components/molecules/PeriodSwitch';

describe('PeriodSwitch', () => {
  it('marks the current period and reports a change', () => {
    const onChange = vi.fn();
    render(<PeriodSwitch value="30j" onChange={onChange} />);
    expect(screen.getByRole('button', { name: '30 jours' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '7 jours' }));
    expect(onChange).toHaveBeenCalledWith('7j');
  });
});
