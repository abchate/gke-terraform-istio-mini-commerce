# web (frontend Vue 3)

SPA Vue 3 + Vite. Affiche les produits, permet de créer des commandes, liste les commandes. Appelle le gateway sur `/api/products` et `/api/orders`.

## Lancer en dev

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173. Le proxy Vite redirige `/api` vers le gateway (port 8085). Lance le gateway + product-service + order-service pour que les appels API fonctionnent.

## Build

```bash
npm run build
```

Sortie dans `dist/`. En prod, le gateway sert cette app (via le service `web` en K8s ou le conteneur `web` en docker-compose), donc les requêtes sont same-origin et `VITE_API_URL` peut rester vide.

## Docker

```bash
docker build -t web:1.0 .
docker run --rm -p 8080:80 web:1.0
```

Ouvre http://localhost:8080 (ou passe par le gateway qui proxy vers ce conteneur).
