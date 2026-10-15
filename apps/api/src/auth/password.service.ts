import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { compare, hashSync } from 'bcryptjs';

const BCRYPT_COST = 10; // same cost as the seed

@Injectable()
export class PasswordService {
  /** Hash of a random string, used so login always performs one bcrypt compare. */
  readonly dummyHash: string = hashSync(randomBytes(16).toString('hex'), BCRYPT_COST);

  compare(plain: string, hash: string): Promise<boolean> {
    return compare(plain, hash);
  }
}
