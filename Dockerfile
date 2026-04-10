FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY index.mjs ./
COPY src/ ./src/

CMD ["node", "index.mjs"]
