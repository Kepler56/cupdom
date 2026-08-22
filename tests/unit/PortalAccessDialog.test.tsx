import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalAccessDialog } from '@/components/molecules/PortalAccessDialog';

// vi.mock is hoisted above this file's own top-level declarations, so its
// factory cannot reference a plain `const x = vi.fn()` declared below it
// (TDZ: "Cannot access 'x' before initialization"). vi.hoisted() is Vitest's
// documented fix — it hoists the declaration itself alongside the mock.
const { grantPortalAccess, resetPortalPassword } = vi.hoisted(() => ({
  grantPortalAccess: vi.fn(),
  resetPortalPassword: vi.fn(),
}));
vi.mock('@/lib/clientAccess', () => ({ grantPortalAccess, resetPortalPassword }));

const onClose = vi.fn();
const onGranted = vi.fn();

beforeEach(() => {
  grantPortalAccess.mockReset();
  resetPortalPassword.mockReset();
  onGranted.mockReset();
});

const open = () =>
  render(<PortalAccessDialog contactId="c1" contactName="Nike" onClose={onClose} onGranted={onGranted} />);

describe('PortalAccessDialog', () => {
  it('does not grant anything until the member confirms', () => {
    open();
    expect(grantPortalAccess).not.toHaveBeenCalled();
  });

  it('shows the password once, with a warning that it cannot be retrieved', async () => {
    grantPortalAccess.mockResolvedValue({ ok: true, email: 'nike@example.test', password: 'AbCdEfGhJkMnPqRs' });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));

    expect(await screen.findByText('AbCdEfGhJkMnPqRs')).toBeInTheDocument();
    expect(screen.getByText(/ne pourra plus être affiché/i)).toBeInTheDocument();
  });

  it('reports the grant to its caller WITHOUT the password', async () => {
    // The history entry records that access was granted. Spec §5.9: the password
    // is never stored, and contact_history is storage.
    grantPortalAccess.mockResolvedValue({ ok: true, email: 'nike@example.test', password: 'AbCdEfGhJkMnPqRs' });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));
    await screen.findByText('AbCdEfGhJkMnPqRs');

    expect(onGranted).toHaveBeenCalledTimes(1);
    const summary = onGranted.mock.calls[0][0];
    expect(summary).not.toContain('AbCdEfGhJkMnPqRs');
    expect(summary).toMatch(/nike@example\.test/i);
  });

  it('renders a refusal in French and offers no password', async () => {
    grantPortalAccess.mockResolvedValue({
      ok: false,
      reason: 'auth_user_exists',
      message: 'Un compte existe déjà pour cette adresse. Réinitialisez plutôt son mot de passe.',
    });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Un compte existe déjà/);
    expect(onGranted).not.toHaveBeenCalled();
  });

  it('offers the reset path when an account already exists', async () => {
    // 'already_provisioned' — a client_accounts row already exists — is the
    // one refusal client-reset-password can actually resolve.
    grantPortalAccess.mockResolvedValue({ ok: false, reason: 'already_provisioned', message: 'Ce contact a déjà un accès au portail.' });
    resetPortalPassword.mockResolvedValue({ ok: true, email: 'nike@example.test', password: 'ZzYyXxWwVvUuTtSs' });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }));
    expect(await screen.findByText('ZzYyXxWwVvUuTtSs')).toBeInTheDocument();
    expect(resetPortalPassword).toHaveBeenCalledWith('c1');
  });

  it('reports a reissue to its caller, also without the password', async () => {
    // contact_history is storage, and Spec §5.9 says the password is never
    // stored — so a reset's summary is subject to the same rule as a grant's.
    grantPortalAccess.mockResolvedValue({ ok: false, reason: 'already_provisioned', message: 'Ce contact a déjà un accès au portail.' });
    resetPortalPassword.mockResolvedValue({ ok: true, email: 'nike@example.test', password: 'ZzYyXxWwVvUuTtSs' });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }));
    await screen.findByText('ZzYyXxWwVvUuTtSs');

    expect(onGranted).toHaveBeenCalledTimes(1);
    const summary = onGranted.mock.calls[0][0];
    expect(summary).not.toContain('ZzYyXxWwVvUuTtSs');
    expect(summary).toMatch(/réinitialisé/i);
  });

  it('surfaces a warning alongside a password that did change', async () => {
    resetPortalPassword.mockResolvedValue({
      ok: true,
      email: 'nike@example.test',
      password: 'ZzYyXxWwVvUuTtSs',
      warning: 'Mot de passe changé, mais…',
    });
    grantPortalAccess.mockResolvedValue({ ok: false, reason: 'already_provisioned', message: 'Ce contact a déjà un accès au portail.' });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }));

    expect(await screen.findByText('ZzYyXxWwVvUuTtSs')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Mot de passe changé/);
  });

  it('offers the reset for a sponsor who already has access — the case where it actually works', async () => {
    grantPortalAccess.mockResolvedValue({ ok: false, reason: 'already_provisioned', message: 'Ce contact a déjà un accès au portail.' });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: /Réinitialiser/ })).toBeInTheDocument();
  });

  it('does NOT offer the reset for an orphan auth user, where it could only fail', async () => {
    // auth_user_exists means no client_accounts row, so client-reset-password
    // would answer not_provisioned. A button that can only produce a
    // contradictory refusal is worse than no button.
    grantPortalAccess.mockResolvedValue({ ok: false, reason: 'auth_user_exists', message: 'Un compte d’authentification existe déjà…' });
    open();
    await userEvent.click(screen.getByRole('button', { name: /Donner l’accès/ }));
    await screen.findByRole('alert');

    expect(screen.queryByRole('button', { name: /Réinitialiser/ })).toBeNull();
  });

  it('is a modal dialog, so a keyboard user is not left behind the overlay', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
