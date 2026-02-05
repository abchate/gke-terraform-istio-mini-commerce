FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY index.js .

EXPOSE 3005
CMD ["node", "index.js"]
