# order-service

Service commandes (PostgreSQL).

## Variables d’environnement

Le service charge un fichier `.env` à la racine du repo (voir `.env.example`).

- `ORDER_DB_HOST` (défaut: localhost)
- `ORDER_DB_PORT` (défaut: 5432)
- `ORDER_DB_NAME` (défaut: orders)
- `ORDER_DB_USER` (défaut: postgres)
- `ORDER_DB_PASSWORD` (défaut: 2000)
- `PRODUCT_SERVICE_URL` (défaut: http://localhost:3005) — pour vérifier l’existence des produits

## Base de données

Créer la base et la table :

```bash
createdb orders
psql -d orders -f create_table.sql
```

## Lancer

```bash
npm install
node index.js
```

Écoute sur le port **3006**.

## Endpoints

- `POST /orders` — body: `{ "productId": "p1", "quantity": 2 }`
- `GET /orders` — liste des commandes
- `GET /orders/:id` — détail d’une commande
