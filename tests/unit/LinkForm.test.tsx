import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkForm } from '@/components/molecules/LinkForm';

describe('LinkForm safe-scheme validation', () => {
  it('rejects a javascript: URL and does not submit', () => {
    const onSubmit = vi.fn();
    render(<LinkForm onSubmit={onSubmit} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(screen.getByText('URL non autorisée')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts an https URL and submits label + url', () => {
    const onSubmit = vi.fn();
    render(<LinkForm onSubmit={onSubmit} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Site' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://cupdom.fr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onSubmit).toHaveBeenCalledWith({ label: 'Site', url: 'https://cupdom.fr' });
  });
});
