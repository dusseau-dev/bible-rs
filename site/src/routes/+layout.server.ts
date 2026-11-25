import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = ({ locals }) => ({ ownerEmail: locals.ownerEmail ?? null });
