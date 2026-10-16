// Cloudflare Access JWT verification for /admin/*.
// Access already blocks unauthorised users at the edge; this is the second check
// so that the admin routes stay closed even if a route bypasses Access.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import type { Env } from './lib';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksFor = '';

function getJwks(teamDomain: string) {
  const base = teamDomain.replace(/\/+$/, '');
  if (!jwks || jwksFor !== base) {
    jwks = createRemoteJWKSet(new URL(`${base}/cdn-cgi/access/certs`));
    jwksFor = base;
  }
  return jwks;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export const requireAccess: MiddlewareHandler<{ Bindings: Env; Variables: { email: string } }> = async (c, next) => {
  const { ACCESS_TEAM_DOMAIN, ACCESS_AUD, DEV_ALLOW_INSECURE } = c.env;

  // Same-origin check for state-changing requests.
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== new URL(c.req.url).host) {
      return c.text('Cross-origin request blocked', 403);
    }
  }

  if (!ACCESS_AUD) {
    if (DEV_ALLOW_INSECURE === 'true') {
      c.set('email', 'dev@localhost');
      return next();
    }
    return c.text('Admin is not configured yet: set ACCESS_AUD (see README).', 503);
  }

  const token = c.req.header('cf-access-jwt-assertion') ?? readCookie(c.req.header('cookie'), 'CF_Authorization');
  if (!token) return c.text('Forbidden: no Cloudflare Access token', 403);

  try {
    const { payload } = await jwtVerify(token, getJwks(ACCESS_TEAM_DOMAIN), {
      issuer: ACCESS_TEAM_DOMAIN.replace(/\/+$/, ''),
      audience: ACCESS_AUD,
    });
    c.set('email', String(payload.email ?? 'unknown'));
  } catch {
    return c.text('Forbidden: invalid Cloudflare Access token', 403);
  }
  return next();
};
