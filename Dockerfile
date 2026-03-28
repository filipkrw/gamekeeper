FROM oven/bun:1 AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1
WORKDIR /app
COPY --from=install /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

USER bun
ENTRYPOINT ["bun", "src/index.ts"]
