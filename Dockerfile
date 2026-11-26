# Una sola imagen para todo el backend. Cada contenedor decide qué servicio ejecuta:
#   node dist/apps/auth/main.js      un microservicio (así lo usa docker-compose.yml)
#   node scripts/todos.js            los seis juntos (plataformas de un solo servicio)

FROM node:20-alpine AS compilacion
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=compilacion /app/dist ./dist
COPY scripts ./scripts
USER node
EXPOSE 3000
CMD ["node", "scripts/todos.js"]
