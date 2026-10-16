/** Escapes LIKE/ILIKE wildcards so user input is matched literally (PostgreSQL default escape char is `\`). */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
