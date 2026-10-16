import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';

// Runs the BUILT application (dist/main.js, the way the container runs it) on its own port against the TEST
// database and checks that SIGTERM shuts it down gracefully (Prisma disconnects). Port 3101 is reserved for this.

const API_DIR = join(__dirname, '..');
const PORT = 3101;

let child: ChildProcessWithoutNullStreams | undefined;
let output = '';

function portIsBusy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitFor(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}. Output so far:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** True when dist/main.js is missing or older than any file under src (a stale build would test old code). */
function buildIsStale(): boolean {
  const main = join(API_DIR, 'dist', 'main.js');
  if (!existsSync(main)) return true;
  const builtAt = statSync(main).mtimeMs;
  return readdirSync(join(API_DIR, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts'))
    .some((entry) => statSync(join(API_DIR, 'src', entry)).mtimeMs > builtAt);
}

beforeAll(() => {
  if (buildIsStale()) execFileSync('pnpm', ['--filter', 'api', 'build'], { cwd: API_DIR, stdio: 'ignore' });
}, 180_000);

afterAll(() => {
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
});

describe('graceful shutdown', () => {
  it('SIGTERM stops the built app and Prisma disconnects first', async () => {
    const databaseUrl = process.env.DATABASE_URL ?? '';
    const databaseName = new URL(databaseUrl).pathname.slice(1);
    expect(databaseName.endsWith('_test')).toBe(true);
    if (await portIsBusy(PORT)) throw new Error(`port ${PORT} is busy: it is reserved for the shutdown e2e test`);

    child = spawn(process.execPath, ['dist/main.js'], {
      cwd: API_DIR,
      env: {
        PATH: process.env.PATH ?? '',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
        JWT_EXPIRES_IN: '1h',
        API_PORT: String(PORT),
        NODE_ENV: 'production',
      },
    });
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));

    await waitFor(() => output.includes('Nest application successfully started'), 30_000, 'the startup line');

    const exited = new Promise<void>((resolve) => child?.once('exit', () => resolve()));
    child.kill('SIGTERM');
    await Promise.race([
      exited,
      new Promise<void>((_resolve, reject) => setTimeout(() => reject(new Error(`no exit within 15 s. Output:\n${output}`)), 15_000)),
    ]);

    expect(output).toContain('Prisma disconnected');
  }, 60_000);
});
