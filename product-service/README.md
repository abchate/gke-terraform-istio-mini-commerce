# product-service

Service produits (données en mémoire).

## Lancer

```bash
npm install
node index.js
```

Écoute sur le port **3005**.

## Endpoints

- `GET /products` — liste des produits
- `GET /products/:id` — détail d’un produit (404 si absent)
