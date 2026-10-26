import { PrismaService } from '../../src/prisma/prisma.service';
import { LeadsService } from '../../src/leads/leads.service';

export const VENDEDORES = ['Ana', 'Bruno', 'Caio'];

// Apaga logs, leads e vendedores e cria os vendedores com a vez escalonada.
export async function criarVendedores(
  prisma: PrismaService,
  ativos = VENDEDORES,
) {
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

// Atribui `total` leads com `simultaneos` requisições em paralelo e devolve a contagem por vendedor.
export async function distribuirLeads(
  service: LeadsService,
  total = 300,
  simultaneos = 10,
) {
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

  return contagem;
}
