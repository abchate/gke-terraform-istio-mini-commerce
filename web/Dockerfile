# Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build
RUN ls -la /app/dist && test -f /app/dist/index.html || (echo "ERREUR: dist/index.html manquant" && exit 1)

# Serve
FROM nginx:alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN sh -c 'test -f /usr/share/nginx/html/index.html || echo "<!DOCTYPE html><html><body>index.html manquant</body></html>" > /usr/share/nginx/html/index.html'
RUN ls -la /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
