import { useTestApp } from './support/create-test-app';

const getCtx = useTestApp();

async function indexDefinition(name: string): Promise<string | undefined> {
  const rows = await getCtx().prisma.$queryRaw<{ indexdef: string }[]>`
    SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ${name}`;
  return rows[0]?.indexdef;
}

describe('list ordering indexes', () => {
  it('equipments_name_id_idx covers (name, id) for ORDER BY name, id', async () => {
    const definition = await indexDefinition('equipments_name_id_idx');
    expect(definition).toBeDefined();
    expect(definition).toContain('ON public.equipments');
    expect(definition).toContain('(name, id)');
  });

  it('requests_created_at_id_idx covers (created_at DESC, id DESC)', async () => {
    const definition = await indexDefinition('requests_created_at_id_idx');
    expect(definition).toBeDefined();
    expect(definition).toContain('ON public.requests');
    expect(definition).toContain('(created_at DESC, id DESC)');
  });

  it('the unique name index and the status index are still there', async () => {
    expect(await indexDefinition('equipments_name_key_idx')).toContain('lower(btrim');
    expect(await indexDefinition('requests_status_created_at_idx')).toBeDefined();
  });
});
