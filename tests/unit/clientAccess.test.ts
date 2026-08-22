import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';

const invoke = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ functions: { invoke } }) }));

const { grantPortalAccess, resetPortalPassword } = await import('@/lib/clientAccess');

beforeEach(() => invoke.mockReset());

/**
 * @supabase/functions-js turns ANY non-2xx Edge Function response into `error`
 * (a FunctionsHttpError carrying the raw Response as `context`), never into
 * `data`. Every refusal these two functions issue is a non-2xx response, so
 * this is the shape `invoke()` actually produces for every failure case —
 * not `{ data: { ok: false, ... }, error: null }`.
 */
const httpFailure = (body: unknown, status = 400) => ({
  data: null,
  error: new FunctionsHttpError(new Response(JSON.stringify(body), { status })),
});

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

  it('names an orphan auth user distinctly — no client_accounts row exists, so a reset cannot help', async () => {
    // auth_user_exists means an auth user was created with no client_accounts
    // row (a half-failed provision). client-reset-password looks that row up
    // by contact_id and would only answer not_provisioned, so the message
    // must not promise a reset — it must say what actually resolves this.
    invoke.mockResolvedValue(httpFailure({ ok: false, error: 'auth_user_exists' }, 409));
    const result = await grantPortalAccess('contact-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('auth_user_exists');
      expect(result.message).toMatch(/Supabase/i);
      expect(result.message).not.toMatch(/réinitialis/i);
    }
  });

  it('names a contact with no e-mail as its own case', async () => {
    invoke.mockResolvedValue(httpFailure({ ok: false, error: 'contact_has_no_email' }, 400));
    const result = await grantPortalAccess('contact-1');
    if (!result.ok) expect(result.reason).toBe('contact_has_no_email');
  });

  it('reads the refusal out of a non-2xx response, rather than calling the function unavailable', async () => {
    // @supabase/functions-js reports every non-2xx as `error`, so a structured
    // refusal arrives as a FunctionsHttpError carrying the body. Before this was
    // handled, every typed refusal collapsed into 'unavailable' and the
    // reset-offering path Spec §5.9 requires was unreachable.
    invoke.mockResolvedValue(httpFailure({ ok: false, error: 'auth_user_exists' }, 409));
    const result = await grantPortalAccess('contact-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('auth_user_exists');
      expect(result.reason).not.toBe('unavailable');
    }
  });

  it('says the service is unreachable, in wording true of any transport failure — not just an undeployed function', async () => {
    // Until the product owner deploys, invoke() errors at the transport layer
    // — a FunctionsFetchError/FunctionsRelayError, NOT a FunctionsHttpError,
    // because there is no HTTP response at all to carry a structured body.
    // « Action impossible » would send someone hunting for a bug in the CRM.
    // The message must not describe an undeployed function specifically — it
    // stays the same error a network blip produces long after deployment.
    invoke.mockResolvedValue({ data: null, error: new Error('Function not found') });
    const result = await grantPortalAccess('contact-1');
    if (!result.ok) {
      expect(result.reason).toBe('unavailable');
      expect(result.message).toMatch(/injoignable/i);
      expect(result.message).not.toMatch(/déploiement/i);
    }
  });

  it('never lets a raw Supabase message reach the user', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('FunctionsHttpError: boom at line 42') });
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
    // flag_not_set is a 500, so it arrives as a FunctionsHttpError too.
    invoke.mockResolvedValue(httpFailure({ ok: false, error: 'flag_not_set', email: 'a@b.test', password: 'x' }, 500));
    const result = await resetPortalPassword('contact-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.password).toBe('x');
      expect(result.warning).toBeTruthy();
    }
  });

  it('names a contact that was never provisioned', async () => {
    invoke.mockResolvedValue(httpFailure({ ok: false, error: 'not_provisioned' }, 404));
    const result = await resetPortalPassword('contact-1');
    if (!result.ok) expect(result.reason).toBe('not_provisioned');
  });
});
