import type { RequestHandler } from './$types';
// The hook authenticates this route, including session expiry and revocation.
export const GET: RequestHandler = () => new Response(null, { status: 204 });
