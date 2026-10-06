/**
 * Safely parse JSON response from fetch calls.
 * Prevents "Unexpected token '<', '<!DOCTYPE '... is not valid JSON" errors
 * when server returns HTML (e.g. 404/500 pages, proxy errors, or route fallbacks).
 */
export async function safeFetchJson<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.warn(`[safeFetchJson] Expected JSON but received ${contentType || 'non-JSON'} (status ${res.status}):`, text.slice(0, 150));
    return {
      error: `Server returned status ${res.status} (${res.statusText || 'Error'})`,
      ok: false,
    } as unknown as T;
  }

  try {
    return await res.json();
  } catch (err: any) {
    console.error('[safeFetchJson] JSON parse exception:', err);
    return {
      error: 'Invalid JSON payload received from server',
      ok: false,
    } as unknown as T;
  }
}
