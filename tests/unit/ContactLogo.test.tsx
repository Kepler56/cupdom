import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContactLogo } from '@/components/molecules/ContactLogo';

const PUBLIC = 'https://uqkbvwyspeqwlbulgzkj.supabase.co/storage/v1/object/public/sponsor-media/logos/c1/logo-x.png';

let current: string | null = null;
const upload = vi.fn();
const update = vi.fn();
const updateEq = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { sponsor_logo_url: current } }) }) }),
      update: (v: unknown) => {
        update(v);
        return { eq: (...a: unknown[]) => { updateEq(...a); return Promise.resolve({ error: null }); } };
      },
    }),
    storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: PUBLIC } }) }) },
  }),
}));

function fileOf(type: string, size: number) {
  const f = new File(['x'], 'logo', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}
const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  current = null;
  upload.mockReset().mockResolvedValue({ error: null });
  update.mockReset();
  updateEq.mockReset();
});

describe('ContactLogo', () => {
  it('shows the saved logo', async () => {
    current = PUBLIC;
    render(<ContactLogo contactId="c1" canEdit={false} />);
    expect(await screen.findByRole('img', { name: 'Logo du client' })).toHaveAttribute('src', PUBLIC);
  });

  it('hides the upload controls from a member who does not own the contact', async () => {
    render(<ContactLogo contactId="c1" canEdit={false} />);
    expect(await screen.findByText('Aucun')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter un logo/ })).not.toBeInTheDocument();
  });

  it('rejects a non-image or an oversize file before uploading', async () => {
    render(<ContactLogo contactId="c1" canEdit />);
    await screen.findByText('Aucun');
    fireEvent.change(input(), { target: { files: [fileOf('image/svg+xml', 100)] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/PNG, JPEG ou WebP/);
    fireEvent.change(input(), { target: { files: [fileOf('image/png', 3 * 1024 * 1024)] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/2\s?Mo/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads to logos/{contactId}/ and saves the public URL on the contact', async () => {
    render(<ContactLogo contactId="c1" canEdit />);
    await screen.findByText('Aucun');
    fireEvent.change(input(), { target: { files: [fileOf('image/png', 1000)] } });

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(upload.mock.calls[0][0]).toMatch(/^logos\/c1\/logo-[a-z0-9]+\.png$/);
    await waitFor(() => expect(update).toHaveBeenCalledWith({ sponsor_logo_url: PUBLIC }));
    expect(updateEq).toHaveBeenCalledWith('id', 'c1');
    expect(await screen.findByRole('img', { name: 'Logo du client' })).toHaveAttribute('src', PUBLIC);
  });

  it('can remove the logo', async () => {
    current = PUBLIC;
    render(<ContactLogo contactId="c1" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ sponsor_logo_url: null }));
  });
});
