import type { NextFunction, Request, Response } from 'express';

/** Every API response: no MIME sniffing, and nothing (tokens, personal data) is cached by a browser or proxy. */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  next();
}
