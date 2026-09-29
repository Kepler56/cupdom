import { describe, expect, it, vi } from 'vitest';
import { RESEND_TIMEOUT_MS, sendEmail } from '@/supabase/functions/_shared/resend';

const msg = { to: 'a@b.fr', subject: 'S', html: '<p>h</p>', text: 't' };

describe('sendEmail', () => {
  it('POSTs to Resend with the bearer key and returns ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const r = await sendEmail(msg, { apiKey: 'k', from: 'Cupdom <crm@cupdom.fr>', fetchImpl });
    expect(r).toEqual({ ok: true, status: 200 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(JSON.parse(init.body)).toEqual({ from: 'Cupdom <crm@cupdom.fr>', ...msg });
  });

  it('reports a non-2xx without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('domain not verified', { status: 403 }));
    expect(await sendEmail(msg, { apiKey: 'k', from: 'f', fetchImpl })).toEqual({
      ok: false,
      status: 403,
      error: 'domain not verified',
    });
  });

  it('reports a network error without throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await sendEmail(msg, { apiKey: 'k', from: 'f', fetchImpl })).toEqual({ ok: false, status: 0, error: 'offline' });
  });

  it('passes a 5 s abort signal to fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await sendEmail(msg, { apiKey: 'k', from: 'f', fetchImpl });
    expect(RESEND_TIMEOUT_MS).toBe(5000);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('reports a timeout (AbortError) without throwing', async () => {
    const abort = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'AbortError' });
    const fetchImpl = vi.fn().mockRejectedValue(abort);
    expect(await sendEmail(msg, { apiKey: 'k', from: 'f', fetchImpl })).toEqual({
      ok: false,
      status: 0,
      error: 'The operation was aborted due to timeout',
    });
  });

  it('reports a DOMException TimeoutError without throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'));
    // Test env's DOMException may not extend Error, so only the message is pinned loosely.
    const r = await sendEmail(msg, { apiKey: 'k', from: 'f', fetchImpl });
    expect(r).toMatchObject({ ok: false, status: 0 });
    expect(r.error).toContain('signal timed out');
  });

  it('refuses to send without a key', async () => {
    const fetchImpl = vi.fn();
    expect(await sendEmail(msg, { apiKey: '', from: 'f', fetchImpl })).toEqual({ ok: false, status: 0, error: 'missing RESEND_API_KEY' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
