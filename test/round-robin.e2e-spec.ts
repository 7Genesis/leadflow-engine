import 'reflect-metadata';
import { PrismaService } from '../src/prisma/prisma.service';
import { LeadsService } from '../src/leads/leads.service';

// O teste apaga vendedores e leads, então só roda contra um banco cujo nome termina em "_test".
const nomeBanco =
  (process.env.DATABASE_URL ?? '').split('/').pop()?.split('?')[0] ?? '';
const rodar = nomeBanco.endsWith('_test');

const VENDEDORES = ['Ana', 'Bruno', 'Caio'];

(rodar ? describe : describe.skip)('Rodízio de leads sob concorrência', () => {
  let prisma: PrismaService;
  let service: LeadsService;

  async function criarVendedores(ativos = VENDEDORES) {
    await prisma.db.log.deleteMany();
    await prisma.db.lead.deleteMany();
    await prisma.db.user.deleteMany();
    for (const [i, nome] of ativos.entries()) {
      await prisma.db.user.create({
        data: {
          name: nome,
          email: `${nome.toLowerCase()}@teste.com`,
          // escalona a vez de cada um: Ana primeiro, depois Bruno, depois Caio
          lastAssignedLeadAt: new Date(Date.now() - (100 - i * 10) * 1000),
        },
      });
    }
  }

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
    await criarVendedores();
    const total = 300;
    const simultaneos = 10;
    let proximo = 0;
    const contagem: Record<string, number> = Object.fromEntries(
      VENDEDORES.map((n) => [n, 0]),
    );

    await Promise.all(
      Array.from({ length: simultaneos }, async () => {
        while (proximo < total) {
          const i = proximo++;
          const { user } = await service.processAndAssignLead({
            name: `Lead ${i}`,
            email: `lead${i}@teste.com`,
            phone: '11999999999',
            source: 'teste',
          });
          contagem[user.name]++;
        }
      }),
    );

    const valores = Object.values(contagem);
    const diferenca = Math.max(...valores) - Math.min(...valores);
    expect(valores.reduce((a, b) => a + b, 0)).toBe(total);
    // Com FOR UPDATE sozinho a diferença média medida foi de ~34 leads (mínimo 20);
    // com SKIP LOCKED ela fica entre 0 e 5.
    expect(diferenca).toBeLessThanOrEqual(12);
  }, 60000);

  it('atribui em rodízio quando os leads chegam um de cada vez', async () => {
    await criarVendedores();
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
    await criarVendedores();
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
