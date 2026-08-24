import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PHONE_COUNTRIES, PhoneField, type PhoneValue } from '@/components/public/PhoneField';

/**
 * PhoneField is controlled, so the test must hold the state the way the form does — otherwise
 * every keystroke is applied to a stale empty value and only the last character survives.
 */
function setup(initial: Partial<PhoneValue> & { error?: string } = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState<PhoneValue>({
      country: initial.country ?? 'FR',
      national: initial.national ?? '',
    });
    return (
      <PhoneField
        {...value}
        error={initial.error}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange };
}

describe('PHONE_COUNTRIES', () => {
  it('leads with France, then the other likely markets', () => {
    expect(PHONE_COUNTRIES[0].code).toBe('FR');
    expect(PHONE_COUNTRIES.slice(0, 6).map((c) => c.code)).toContain('BE');
  });

  it('covers every country libphonenumber knows, without duplicates', () => {
    const codes = PHONE_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThan(200);
  });

  it('carries the dial code for each country', () => {
    expect(PHONE_COUNTRIES.find((c) => c.code === 'FR')?.dial).toBe('33');
    expect(PHONE_COUNTRIES.find((c) => c.code === 'US')?.dial).toBe('1');
  });
});

describe('PhoneField', () => {
  it('renders a labelled number input and an accessible country select', () => {
    setup();
    expect(screen.getByLabelText('Téléphone')).toBeInTheDocument();
    expect(screen.getByLabelText('Indicatif pays')).toBeInTheDocument();
  });

  it('shows the selected dial code', () => {
    setup({ country: 'BE' });
    expect((screen.getByLabelText('Indicatif pays') as HTMLSelectElement).value).toBe('BE');
    expect(screen.getByText('+32')).toBeInTheDocument();
  });

  it('reports the country back when the select changes, keeping the typed digits', async () => {
    const { onChange } = setup({ national: '612345678' });
    await userEvent.selectOptions(screen.getByLabelText('Indicatif pays'), 'BE');
    expect(onChange).toHaveBeenCalledWith({ country: 'BE', national: '612345678' });
  });

  it('reports typed digits back, formatted for the selected country', async () => {
    const { onChange } = setup();
    await userEvent.type(screen.getByLabelText('Téléphone'), '0612345678');
    expect(onChange).toHaveBeenLastCalledWith({ country: 'FR', national: '06 12 34 56 78' });
  });

  it('marks the input invalid and shows the message when given an error', () => {
    render(<PhoneField country="FR" national="" onChange={vi.fn()} error="Numéro de téléphone invalide" />);
    expect(screen.getByLabelText('Téléphone')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Numéro de téléphone invalide');
  });

  it('uses tel semantics so mobile keyboards show digits', () => {
    setup();
    const input = screen.getByLabelText('Téléphone');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('inputMode', 'tel');
  });
});
