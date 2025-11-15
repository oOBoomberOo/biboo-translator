FROM oven/bun:1.2.2

WORKDIR /app

COPY package.json /app
COPY bun.lock /app
COPY src/ /app/src

RUN bun install --production

CMD ["bun", "/app/src/index.ts"]