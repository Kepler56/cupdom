import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadForm } from '@/app/(public)/c/[slug]/LeadForm';
import { postFormView, postSubmit } from '@/lib/public/leadClient';

vi.mock('@/lib/public/leadClient', () => ({
  postFormView: vi.fn(),
  postSubmit: vi.fn(),
}));

const assign = vi.fn();

beforeEach(() => {
  (postFormView as Mock).mockReset().mockResolvedValue({ active: true, sponsor: 'Nike' });
  (postSubmit as Mock).mockReset().mockResolvedValue({ redirect: 'https://nike.fr/ete' });
  assign.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: { assign, href: '' } });
});

afterEach(() => vi.clearAllMocks());

async function fillValid() {
  fireEvent.change(await screen.findByLabelText('Prénom'), { target: { value: 'Marie' } });
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Curie' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'marie@x.fr' } });
  fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '06 12 34 56 78' } });
}

describe('LeadForm', () => {
  it('renders the four fields + one un-ticked consent + privacy link + button (AC-2)', async () => {
    render(<LeadForm slug="abcd23" />);
    expect(await screen.findByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Téléphone')).toBeInTheDocument();
    const consent = screen.getByRole('checkbox');
    expect(consent).not.toBeChecked(); // un-ticked
    expect(screen.getByRole('link', { name: 'Politique de confidentialité' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Recevoir l'offre" })).toBeInTheDocument();
  });

  it('fires postFormView once on mount, even under StrictMode (AC-3)', async () => {
    render(
      <StrictMode>
        <LeadForm slug="abcd23" />
      </StrictMode>,
    );
    await screen.findByLabelText('Prénom');
    expect(postFormView).toHaveBeenCalledTimes(1);
    expect(postFormView).toHaveBeenCalledWith('abcd23');
  });

  it('empty submit → French errors, postSubmit NOT called (AC-4)', async () => {
    render(<LeadForm slug="abcd23" />);
    await screen.findByLabelText('Prénom');
    fireEvent.click(screen.getByRole('button', { name: "Recevoir l'offre" }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(postSubmit).not.toHaveBeenCalled();
  });

  it('all fields valid but consent unticked → blocked, postSubmit NOT called (AC-5 hard gate)', async () => {
    render(<LeadForm slug="abcd23" />);
    await fillValid();
    fireEvent.click(screen.getByRole('button', { name: "Recevoir l'offre" }));
    expect(await screen.findByText("Vous devez accepter pour recevoir l'offre")).toBeInTheDocument();
    expect(postSubmit).not.toHaveBeenCalled();
  });

  it('valid + consent → postSubmit once with payload; redirect navigates (AC-6)', async () => {
    render(<LeadForm slug="abcd23" />);
    await fillValid();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: "Recevoir l'offre" }));

    await waitFor(() => expect(postSubmit).toHaveBeenCalledTimes(1));
    const payload = (postSubmit as Mock).mock.calls[0][0];
    expect(payload).toMatchObject({ slug: 'abcd23', firstName: 'Marie', email: 'marie@x.fr', consent: true, website: '' });
    expect(payload.consentVersion).toBeTruthy();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://nike.fr/ete'));
  });

  it('honeypot "website" is present, hidden, and included in the payload (AC-8)', async () => {
    const { container } = render(<LeadForm slug="abcd23" />);
    await fillValid();
    const honeypot = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot).toBeTruthy();
    expect(honeypot.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: "Recevoir l'offre" }));
    await waitFor(() => expect(postSubmit).toHaveBeenCalled());
    expect('website' in (postSubmit as Mock).mock.calls[0][0]).toBe(true);
  });

  it('inactive campaign → renders the branded ended notice, no form', async () => {
    (postFormView as Mock).mockResolvedValue({ active: false, sponsor: '' });
    render(<LeadForm slug="dead99" />);
    expect(await screen.findByText("Cette campagne n'est plus active")).toBeInTheDocument();
    expect(screen.queryByLabelText('Prénom')).not.toBeInTheDocument();
  });
});
