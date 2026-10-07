FROM node:22-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app
COPY . .

# devDependencies stay installed: the Railway pre-deploy step runs drizzle-kit from this image.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@ee/api..." run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
