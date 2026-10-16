import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';

const APP_DIR = join(__dirname, '..', '..', 'app');

/** Absolute paths of every file called `name` under apps/web/app. */
export function findFiles(name: string): string[] {
  return readdirSync(APP_DIR, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry === name || entry.endsWith(`/${name}`))
    .map((entry) => join(APP_DIR, entry))
    .sort();
}

export const relativeToApp = (path: string): string => path.slice(APP_DIR.length + 1);

export interface BoundaryProps {
  error: Error;
  reset: () => void;
}

export async function importDefault<Props>(path: string): Promise<(props: Props) => ReactElement> {
  const loaded: unknown = await import(/* @vite-ignore */ path);
  if (typeof loaded !== 'object' || loaded === null || !('default' in loaded) || typeof loaded.default !== 'function') {
    throw new Error(`${path} has no default function export`);
  }
  return loaded.default as (props: Props) => ReactElement;
}
