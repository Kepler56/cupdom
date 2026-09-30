import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CampaignCreateForm } from '@/components/organisms/CampaignCreateForm';

const uploadProductPhoto = vi.fn();
const createCampaign = vi.fn();

vi.mock('@/lib/scope', () => ({ useScope: () => ({ myId: 'me' }) }));
vi.mock('@/lib/contacts', () => ({
  listContactsWithStatus: () => Promise.resolve([{ id: 'c1', ownerId: 'me', archivedAt: null, company: 'On' }]),
  contactDisplayName: () => 'On',
}));
vi.mock('@/lib/deals', () => ({ listDeals: () => Promise.resolve([{ id: 'd1', title: 'Deal On' }]) }));
vi.mock('@/lib/campaigns/campaigns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/campaigns/campaigns')>()),
  createCampaign: (...a: unknown[]) => createCampaign(...a),
  setCampaignState: vi.fn(),
}));
vi.mock('@/lib/campaigns/productPhotoUpload', () => ({ uploadProductPhoto: (...a: unknown[]) => uploadProductPhoto(...a) }));
vi.mock('@/lib/campaigns/resizePhoto', () => ({ resizePhoto: async (f: File) => f }));

beforeEach(() => {
  uploadProductPhoto.mockReset().mockRejectedValue(new Error('boom'));
  createCampaign.mockReset().mockResolvedValue({ status: 'ok', campaign: { slug: 's1' } });
});

async function createWithPhoto(onCreated: () => void, onClose: () => void) {
  render(<CampaignCreateForm onCreated={onCreated} onClose={onClose} />);
  await screen.findByRole('option', { name: 'On' });
  fireEvent.change(screen.getByLabelText('Contact'), { target: { value: 'c1' } });
  await screen.findByRole('option', { name: 'Deal On' });
  fireEvent.change(screen.getByLabelText('Deal'), { target: { value: 'd1' } });
  const file = new File(['x'], 'p.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Photo du produit (optionnel)'), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Créer' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Campagne créée/);
}

describe('CampaignCreateForm — campaign created, photo failed', () => {
  it('uploads after creation with the new slug', async () => {
    await createWithPhoto(vi.fn(), vi.fn());
    expect(uploadProductPhoto).toHaveBeenCalledWith('s1', expect.any(File));
  });

  it('Fermer refreshes the list', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    await createWithPhoto(onCreated, onClose);
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape also refreshes the list instead of a plain close', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    await createWithPhoto(onCreated, onClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('before creation, Escape is a plain close', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<CampaignCreateForm onCreated={onCreated} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
