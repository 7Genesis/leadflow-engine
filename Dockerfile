# Estágio 1 (build): instala tudo, gera o Prisma Client e compila.
# Este estágio também é usado pelo serviço "migrate" do docker-compose.yml,
# porque mantém as devDependencies (CLI do Prisma e ts-node) para migrate e seed.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# Estágio 2 (prod-deps): o mesmo node_modules, sem as devDependencies.
FROM build AS prod-deps
RUN npm prune --omit=dev

# Estágio 3 (final): dependências de produção e código compilado, rodando sem root.
FROM node:22-alpine AS final
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./

USER node
EXPOSE 3000
# O build gera dist/src/main.js (seed.ts e prisma.config.ts na raiz ampliam o rootDir)
CMD ["node", "dist/src/main"]
