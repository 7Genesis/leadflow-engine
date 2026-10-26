import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { LeadsService } from '../src/leads/leads.service';
import { criarVendedores, distribuirLeads } from '../test/helpers/rodizio';

// Só troca a cláusula de bloqueio; o resto da atribuição é o do serviço de produção.
class LeadsServiceForUpdate extends LeadsService {
  protected override readonly bloqueio = Prisma.sql`FOR UPDATE`;
}

// O script apaga vendedores e leads, então só roda contra um banco cujo nome termina em "_test".
const nomeBanco =
  (process.env.DATABASE_URL ?? '').split('/').pop()?.split('?')[0] ?? '';
if (!nomeBanco.endsWith('_test')) {
  console.error(
    'Defina DATABASE_URL para um banco cujo nome termine em "_test".',
  );
  process.exit(1);
}

const rodadas = Number(process.argv[2] ?? 10);
if (!Number.isInteger(rodadas) || rodadas < 1) {
  console.error('Uso: npm run bench:rodizio [-- <rodadas>]');
  process.exit(1);
}

async function main() {
  Logger.overrideLogger(false); // sem um log por lead atribuído
  const prisma = new PrismaService();
  await prisma.db.$connect();
  const fila = { add: () => Promise.resolve({}) } as never;
  const estrategias = {
    'FOR UPDATE': new LeadsServiceForUpdate(fila, prisma),
    'FOR UPDATE SKIP LOCKED': new LeadsService(fila, prisma),
  };

  console.log(`${rodadas} rodadas de 300 leads, 10 simultâneos, 3 vendedores`);
  for (const [nome, service] of Object.entries(estrategias)) {
    const difs: number[] = [];
    const fatias: number[] = [];
    for (let r = 0; r < rodadas; r++) {
      await criarVendedores(prisma);
      const valores = Object.values(await distribuirLeads(service));
      difs.push(Math.max(...valores) - Math.min(...valores));
      fatias.push(Math.max(...valores));
    }
    const media = difs.reduce((a, b) => a + b, 0) / difs.length;
    console.log(
      `${nome}: diferença média ${media.toFixed(1)} (mín ${Math.min(...difs)}, máx ${Math.max(...difs)}); maior fatia máx ${Math.max(...fatias)}; rodadas: [${difs.join(', ')}]`,
    );
  }

  await prisma.onModuleDestroy();
}

void main();
