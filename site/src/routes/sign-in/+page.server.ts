import { ownerAuth } from '#lib/server/owner-auth.js';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ url }) => ({ configured: ownerAuth.ready, error: url.searchParams.get('error') });
