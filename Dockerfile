FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
RUN npx prisma generate

EXPOSE 5006

CMD ["npm", "run", "start:prod"]
