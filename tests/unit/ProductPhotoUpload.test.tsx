import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProductPhotoUpload } from '@/components/molecules/ProductPhotoUpload';

const PUBLIC = 'https://uqkbvwyspeqwlbulgzkj.supabase.co/storage/v1/object/public/sponsor-media/products/s1/1.png';

const upload = vi.fn();
const setProductImageUrl = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: PUBLIC } }) }) },
  }),
}));
const resizePhoto = vi.fn();
vi.mock('@/lib/campaigns/resizePhoto', () => ({ resizePhoto: (f: File) => resizePhoto(f) }));
vi.mock('@/lib/campaigns/campaigns', () => ({
  setProductImageUrl: (...a: unknown[]) => setProductImageUrl(...a),
}));

function fileOf(type: string, size: number) {
  const f = new File(['x'], 'photo', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}
const input = () => screen.getByLabelText('Fichier photo du produit') as HTMLInputElement;

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  setProductImageUrl.mockReset().mockResolvedValue(undefined);
  resizePhoto.mockReset().mockImplementation(async (f: File) => f);
});

describe('ProductPhotoUpload', () => {
  it('shows an empty drop zone and « Ajouter » when there is no photo', () => {
    render(<ProductPhotoUpload slug="s1" url={null} onChanged={() => {}} />);
    expect(screen.getByText('Glissez une photo ici')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();
  });

  it('shows the current photo with Remplacer / Retirer', () => {
    render(<ProductPhotoUpload slug="s1" url={PUBLIC} onChanged={() => {}} />);
    expect(screen.getByRole('img', { name: 'Photo du produit' })).toHaveAttribute('src', PUBLIC);
    expect(screen.getByRole('button', { name: 'Remplacer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirer' })).toBeInTheDocument();
  });

  it('rejects a wrong type or an oversize file before uploading', async () => {
    render(<ProductPhotoUpload slug="s1" url={null} onChanged={() => {}} />);
    fireEvent.change(input(), { target: { files: [fileOf('image/svg+xml', 100)] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/PNG, JPEG ou WebP/);
    fireEvent.change(input(), { target: { files: [fileOf('image/png', 3 * 1024 * 1024)] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/2 Mo/));
    expect(upload).not.toHaveBeenCalled();
    expect(setProductImageUrl).not.toHaveBeenCalled();
  });

  it('uploads to products/{slug}/{timestamp}.{ext}, saves the public URL, then reloads', async () => {
    const onChanged = vi.fn();
    render(<ProductPhotoUpload slug="s1" url={null} onChanged={onChanged} />);
    fireEvent.change(input(), { target: { files: [fileOf('image/webp', 1000)] } });

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(upload.mock.calls[0][0]).toMatch(/^products\/s1\/\d+\.webp$/);
    expect(upload.mock.calls[0][2]).toMatchObject({ upsert: true, contentType: 'image/webp' });
    expect(setProductImageUrl).toHaveBeenCalledWith('s1', PUBLIC);
  });

  it('reports a storage failure without touching the campaign', async () => {
    upload.mockResolvedValue({ error: { message: 'boom' } });
    const onChanged = vi.fn();
    render(<ProductPhotoUpload slug="s1" url={null} onChanged={onChanged} />);
    fireEvent.change(input(), { target: { files: [fileOf('image/png', 1000)] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Envoi de la photo impossible. Réessayez.');
    expect(setProductImageUrl).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('Retirer clears the photo and reloads', async () => {
    const onChanged = vi.fn();
    render(<ProductPhotoUpload slug="s1" url={PUBLIC} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }));
    await waitFor(() => expect(setProductImageUrl).toHaveBeenCalledWith('s1', null));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('uploads the downscaled file, so a big phone photo passes the 2 Mo check', async () => {
    const big = fileOf('image/jpeg', 6 * 1024 * 1024);
    const small = fileOf('image/webp', 400 * 1024);
    resizePhoto.mockResolvedValue(small);
    const onChanged = vi.fn();
    render(<ProductPhotoUpload slug="s1" url={null} onChanged={onChanged} />);
    fireEvent.change(input(), { target: { files: [big] } });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(resizePhoto).toHaveBeenCalledWith(big);
    expect(upload.mock.calls[0][1]).toBe(small);
    expect(upload.mock.calls[0][0]).toMatch(/\.webp$/);
  });

  it('never renders a non-http preview src', () => {
    render(<ProductPhotoUpload slug="s1" url="javascript:alert(1)" onChanged={() => {}} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Glissez une photo ici')).toBeInTheDocument();
  });
});
