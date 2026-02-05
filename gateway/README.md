# gateway

Reverse proxy HTTP. Sert aussi le frontend (dossier `frontend/` à la racine) à la racine `/` et expose les APIs sous `/api/products` et `/api/orders`. CORS activé pour le front.

## Variables d’environnement

- `PRODUCT_SERVICE_URL` (défaut: http://localhost:3005)
- `ORDER_SERVICE_URL` (défaut: http://localhost:3006)

## Lancer

```bash
npm install
node index.js
```

Écoute sur le port **8085**.

## Routage

- `/api/products` → product-service `/products`
- `/api/orders` → order-service `/orders`
