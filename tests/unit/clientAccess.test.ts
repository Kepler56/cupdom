import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ functions: { invoke } }) }));

const { grantPortalAccess, resetPortalPassword } = await import('@/lib/clientAccess');

beforeEach(() => invoke.mockReset());

describe('grantPortalAccess', () => {
  it('returns the password exactly as the function issued it', async () => {
    invoke.mockResolvedValue({ data: { ok: true, email: 'a@b.test', password: 'AbCdEfGhJkMnPqRs' }, error: null });
    const result = await grantPortalAccess('contact-1');
    expect(result).toEqual({ ok: true, email: 'a@b.test', password: 'AbCdEfGhJkMnPqRs' });
  });

  it('sends the contact id to the right function', async () => {
    invoke.mockResolvedValue({ data: { ok: true, email: 'a@b.test', password: 'x' }, error: null });
    await grantPortalAccess('contact-1');
    expect(invoke).toHaveBeenCalledWith('client-provision', { body: { contactId: 'contact-1' } });
  });

  it('offers a reset when an auth user already exists, rather than failing opaquely', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'auth_user_exists' }, error: null });
    const result = await grantPortalAccess('contact-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('auth_user_exists');
      expect(result.message).toMatch(/réinitialis/i);
    }
  });

  it('names a contact with no e-mail as its own case', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'contact_has_no_email' }, error: null });
    const result = await grantPortalAccess('contact-1');
    if (!result.ok) expect(result.reason).toBe('contact_has_no_email');
  });

  it('says the feature is unavailable when the function is not deployed', async () => {
    // Until the product owner deploys, invoke() errors at the transport layer.
    // « Action impossible » would send someone hunting for a bug in the CRM.
    invoke.mockResolvedValue({ data: null, error: { message: 'Function not found' } });
    const result = await grantPortalAccess('contact-1');
    if (!result.ok) {
      expect(result.reason).toBe('unavailable');
      expect(result.message).toMatch(/pas encore disponible|indisponible/i);
    }
  });

  it('never lets a raw Supabase message reach the user', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'FunctionsHttpError: boom at line 42' } });
    const result = await grantPortalAccess('contact-1');
    if (!result.ok) {
      expect(result.message).not.toContain('FunctionsHttpError');
      expect(result.message).not.toContain('line 42');
    }
  });
});

describe('resetPortalPassword', () => {
  it('calls the reset function, not the provisioning one', async () => {
    invoke.mockResolvedValue({ data: { ok: true, email: 'a@b.test', password: 'x' }, error: null });
    await resetPortalPassword('contact-1');
    expect(invoke).toHaveBeenCalledWith('client-reset-password', { body: { contactId: 'contact-1' } });
  });

  it('treats flag_not_set as a SUCCESS carrying a warning, because the password did change', async () => {
    // Reporting failure here would send the team chasing a password that works.
    invoke.mockResolvedValue({ data: { ok: false, error: 'flag_not_set', email: 'a@b.test', password: 'x' }, error: null });
    const result = await resetPortalPassword('contact-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.password).toBe('x');
      expect(result.warning).toBeTruthy();
    }
  });

  it('names a contact that was never provisioned', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'not_provisioned' }, error: null });
    const result = await resetPortalPassword('contact-1');
    if (!result.ok) expect(result.reason).toBe('not_provisioned');
  });
});
