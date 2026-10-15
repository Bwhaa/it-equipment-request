import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Load the ROOT .env for dev, build and start (cwd is apps/web for every pnpm --filter script).
// forceReload is required: Next has already loaded (and cached) the env of apps/web itself, which has no .env files.
// Never expose secrets through the `env` option or NEXT_PUBLIC_ variables.
loadEnvConfig(path.resolve(process.cwd(), '../..'), process.env.NODE_ENV !== 'production', console, true);

const nextConfig: NextConfig = {};

export default nextConfig;
