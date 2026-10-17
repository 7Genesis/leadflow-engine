import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

async function erros(payload: object) {
  const dto = plainToInstance(CreateLeadDto, payload);
  const resultado = await validate(dto, { whitelist: true });
  return resultado.map((e) => e.property);
}

describe('CreateLeadDto', () => {
  it('aceita só nome e e-mail', async () => {
    expect(await erros({ name: 'Maria', email: 'maria@exemplo.com' })).toEqual(
      [],
    );
  });

  it('aceita o payload completo', async () => {
    expect(
      await erros({
        name: 'Maria',
        email: 'maria@exemplo.com',
        phone: '11999999999',
        source: 'meta-ads',
        priority: 2,
      }),
    ).toEqual([]);
  });

  it('recusa e-mail inválido', async () => {
    expect(await erros({ name: 'Maria', email: 'nao-e-email' })).toEqual([
      'email',
    ]);
  });

  it('recusa nome ausente', async () => {
    expect(await erros({ email: 'maria@exemplo.com' })).toContain('name');
  });

  it('recusa prioridade que não é inteiro', async () => {
    expect(
      await erros({ name: 'Maria', email: 'maria@exemplo.com', priority: 'x' }),
    ).toEqual(['priority']);
  });
});
