import { ROLE_HOME } from './roles';
import type { Session } from './session';

export type RouteDecision =
  | { action: 'next'; clearCookie: boolean }
  | { action: 'redirect'; to: string; clearCookie: boolean };

const inArea = (pathname: string, base: string): boolean => pathname === base || pathname.startsWith(`${base}/`);
const isAdminArea = (pathname: string): boolean => inArea(pathname, '/admin');
const isEmployeeArea = (pathname: string): boolean => inArea(pathname, '/equipments') || inArea(pathname, '/requests');

/** Pure routing decision used by the middleware (UX only; the NestJS guards enforce access). */
export function decideRoute(pathname: string, session: Session): RouteDecision {
  const isLogin = pathname === '/login';

  switch (session.status) {
    case 'none':
      return isLogin ? { action: 'next', clearCookie: false } : { action: 'redirect', to: '/login', clearCookie: false };
    case 'invalid':
      return isLogin ? { action: 'next', clearCookie: true } : { action: 'redirect', to: '/login', clearCookie: true };
    case 'expired':
      return isLogin
        ? { action: 'next', clearCookie: true }
        : { action: 'redirect', to: '/login?expired=1', clearCookie: true };
    case 'valid': {
      const home = ROLE_HOME[session.role];
      if (pathname === '/' || isLogin) return { action: 'redirect', to: home, clearCookie: false };
      if (isAdminArea(pathname) && session.role !== 'ADMIN') {
        return { action: 'redirect', to: ROLE_HOME.EMPLOYEE, clearCookie: false };
      }
      if (isEmployeeArea(pathname) && session.role !== 'EMPLOYEE') {
        return { action: 'redirect', to: ROLE_HOME.ADMIN, clearCookie: false };
      }
      return { action: 'next', clearCookie: false };
    }
  }
}
