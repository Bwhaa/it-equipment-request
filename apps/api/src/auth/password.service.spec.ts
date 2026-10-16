import { compareSync, hashSync } from 'bcryptjs';
import { PasswordService } from './password.service';

// Characterisation of the installed bcryptjs (3.0.3): it neither throws nor warns for long passwords, it
// silently ignores everything after the first 72 BYTES. LoginDto caps passwords at 128 characters; that does
// not change this, and it is documented as a known limitation.
describe('bcryptjs behaviour for passwords longer than 72 bytes', () => {
  it('ASCII: a 72-byte password still matches when characters are appended (silent truncation, no throw)', () => {
    const password = 'a'.repeat(72);
    const hash = hashSync(password, 4);
    expect(compareSync(password, hash)).toBe(true);
    expect(compareSync(`${password}EXTRA`, hash)).toBe(true);
    expect(() => hashSync(`${password}EXTRA`, 4)).not.toThrow();
  });

  it('Thai: 25 characters are 75 bytes; the first 72 bytes (24 characters) decide', () => {
    const password = 'ก'.repeat(25);
    expect(Buffer.byteLength(password)).toBe(75);
    const hash = hashSync(password, 4);
    expect(compareSync(password, hash)).toBe(true);
    expect(compareSync(`${password}xyz`, hash)).toBe(true);
    expect(compareSync('ก'.repeat(24), hash)).toBe(true);
    expect(compareSync('ก'.repeat(23), hash)).toBe(false);
  });
});

describe('PasswordService', () => {
  it('compares against the dummy hash without matching a real password', async () => {
    const service = new PasswordService();
    expect(await service.compare('Admin@123', service.dummyHash)).toBe(false);
  });
});
