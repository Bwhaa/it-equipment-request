const TEST_DATABASE_NAME = /^[a-z0-9_]+_test$/;

/** Returns the database name of `url`; throws unless it is a dedicated `*_test` database. */
export function assertTestDatabaseUrl(url: string): string {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('Refusing to run e2e: DATABASE_URL is not a valid URL');
  }
  if (!TEST_DATABASE_NAME.test(name)) {
    throw new Error(
      `Refusing to run e2e: database name "${name}" must match ${TEST_DATABASE_NAME} (e.g. it_equipment_test)`,
    );
  }
  return name;
}
