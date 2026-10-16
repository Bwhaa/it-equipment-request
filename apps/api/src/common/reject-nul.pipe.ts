import { BadRequestException, PipeTransform } from '@nestjs/common';

const NUL = '\u0000';
// A high surrogate not followed by a low one, or a low surrogate not preceded by a high one.
const UNPAIRED_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const isUnstorable = (text: string): boolean => text.includes(NUL) || UNPAIRED_SURROGATE.test(text);

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Rejects text that cannot be stored: a NUL character (Postgres refuses it) or an unpaired UTF-16 surrogate
 * (the Prisma engine refuses it). Every string value, array element and object property NAME is checked.
 * The walk is iterative (explicit stack) so a deeply nested body cannot overflow the call stack.
 * Runs before the ValidationPipe so the answer is a 400 instead of a 500.
 */
export class RejectNulCharactersPipe implements PipeTransform {
  transform(value: unknown): unknown {
    const stack: unknown[] = [value];
    const seen = new WeakSet<object>();

    while (stack.length > 0) {
      const current = stack.pop();
      if (typeof current === 'string') {
        if (isUnstorable(current)) this.reject();
      } else if (Array.isArray(current)) {
        if (!seen.has(current)) {
          seen.add(current);
          for (const item of current) stack.push(item);
        }
      } else if (typeof current === 'object' && current !== null && isPlainObject(current)) {
        if (!seen.has(current)) {
          seen.add(current);
          for (const [key, item] of Object.entries(current)) {
            if (isUnstorable(key)) this.reject();
            stack.push(item);
          }
        }
      }
    }
    return value;
  }

  private reject(): never {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Null characters and unpaired surrogates are not allowed',
    });
  }
}
