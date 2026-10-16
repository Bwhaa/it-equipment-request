/** CSRF defence for cookie-setting endpoints: browsers send Origin on cross-site POSTs. */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (origin === null) return true; // non-browser clients (curl, server-to-server)
  try {
    return new URL(origin).host === headers.get('host');
  } catch {
    return false;
  }
}
