import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
  console.log(platform);
  return { user: locals.user };
};
