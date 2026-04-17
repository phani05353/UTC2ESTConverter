FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p logs

EXPOSE 3012

ENV PORT=3012 \
    NODE_ENV=production

CMD ["node", "server.js"]
