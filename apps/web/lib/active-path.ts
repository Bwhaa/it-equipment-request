/** Active when the path equals the href or is below it (segment boundary, not a string prefix). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
