import type { RequestHandler } from '@sveltejs/kit';
import { createSessionCookie, verifyIdToken } from '$lib/server/firebase';
import { ONE_WEEK_IN_SECONDS } from '$lib/constants';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const authHeader = request.headers.get('Authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return new Response('Invalid authorization header', { status: 401 });
  }

  try {
    const { sub, email } = await verifyIdToken(token);

    cookies.set(
      'session',
      await createSessionCookie(token, ONE_WEEK_IN_SECONDS),
      {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: ONE_WEEK_IN_SECONDS,
      }
    );

    const user = {
      id: sub,
      email,
    };

    return new Response(JSON.stringify(user), {
      status: 200,
    });
  } catch (error) {
    console.log(error);
    return new Response('Invalid token', { status: 401 });
  }
};

export const DELETE: RequestHandler = ({ cookies }) => {
  cookies.delete('session');
  return new Response(null, {
    status: 200,
  });
};
