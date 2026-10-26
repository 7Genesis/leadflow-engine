import 'reflect-metadata';
import { PrismaService } from '../src/prisma/prisma.service';
import { LeadsService } from '../src/leads/leads.service';
import { criarVendedores, distribuirLeads } from './helpers/rodizio';

// O teste apaga vendedores e leads, então só roda contra um banco cujo nome termina em "_test".
const nomeBanco =
  (process.env.DATABASE_URL ?? '').split('/').pop()?.split('?')[0] ?? '';
const rodar = nomeBanco.endsWith('_test');

(rodar ? describe : describe.skip)('Rodízio de leads sob concorrência', () => {
  let prisma: PrismaService;
  let service: LeadsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.db.$connect();
    // a fila não participa da atribuição: um stub basta
    service = new LeadsService(
      { add: () => Promise.resolve({}) } as never,
      prisma,
    );
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('distribui 300 leads, 10 por vez, sem desequilibrar os vendedores', async () => {
    await criarVendedores(prisma);
    const total = 300;
    const contagem = await distribuirLeads(service, total, 10);

    const valores = Object.values(contagem);
    const diferenca = Math.max(...valores) - Math.min(...valores);
    expect(valores.reduce((a, b) => a + b, 0)).toBe(total);
    // Com SKIP LOCKED a diferença fica em poucos leads; veja `npm run bench:rodizio` para a comparação com FOR UPDATE.
    expect(diferenca).toBeLessThanOrEqual(12);
  }, 60000);

  it('atribui em rodízio quando os leads chegam um de cada vez', async () => {
    await criarVendedores(prisma);
    const ordem: string[] = [];
    for (let i = 0; i < 6; i++) {
      const { user } = await service.processAndAssignLead({
        name: `Lead ${i}`,
        email: `serial${i}@teste.com`,
        phone: '11999999999',
        source: 'teste',
      });
      ordem.push(user.name);
    }
    expect(ordem).toEqual(['Ana', 'Bruno', 'Caio', 'Ana', 'Bruno', 'Caio']);
  });

  it('avisa quando não há vendedor ativo', async () => {
    await criarVendedores(prisma);
    await prisma.db.user.updateMany({ data: { isActive: false } });
    await expect(
      service.processAndAssignLead({
        name: 'Lead sem vendedor',
        email: 'sem@teste.com',
        phone: '11999999999',
        source: 'teste',
      }),
    ).rejects.toThrow('Nenhum vendedor ativo encontrado.');
  });
});
