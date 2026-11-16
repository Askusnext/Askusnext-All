# AskUs API (NestJS modular monolith) — standalone image for Railway / AWS.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
# No lockfile here: it lives at the monorepo root, outside this build context.
RUN npm install --no-audit --no-fund
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
