# gke-terraform-istio-mini-commerce
Cloud-native mini e-commerce on Google Cloud: GKE provisioned with Terraform, service-to-service security and traffic management with Istio/Cloud Service Mesh, and PostgreSQL backend. Business logic kept minimal to focus on DevOps and cloud integration.

---

## Fichier .env (recommandé)

À la racine du projet, crée un fichier `.env` à partir du modèle (surtout pour le mot de passe PostgreSQL) :

```bash
cp .env.example .env
# Édite .env et mets ORDER_DB_USER / ORDER_DB_PASSWORD si besoin
```

Les services **order-service** et **gateway** chargent ce `.env` automatiquement. Le fichier `.env` est ignoré par git (ne sera pas commité).

---

## Docker (Étape 2 – Dockerisation)

### Build des 3 images

À la racine du projet :

```bash
docker build -t mini-commerce-gateway ./gateway
docker build -t mini-commerce-product ./product-service
docker build -t mini-commerce-order ./order-service
```

### Test d’un container en local

PostgreSQL doit être accessible (local ou container). Exemple avec l’image officielle :

```bash
docker run -d --name postgres-orders \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=orders \
  -p 5432:5432 \
  -v $(pwd)/order-service/create_table.sql:/docker-entrypoint-initdb.d/01-create-table.sql \
  postgres:16-alpine
```

Puis lancer un service (remplace `ORDER_DB_PASSWORD` si différent) :

```bash
docker run --rm -p 3005:3005 mini-commerce-product
# ou
docker run --rm -p 3006:3006 \
  -e ORDER_DB_HOST=host.docker.internal -e ORDER_DB_USER=postgres -e ORDER_DB_PASSWORD=postgres \
  mini-commerce-order
# ou
docker run --rm -p 8085:8085 \
  -e PRODUCT_SERVICE_URL=http://host.docker.internal:3005 -e ORDER_SERVICE_URL=http://host.docker.internal:3006 \
  -v $(pwd)/frontend:/frontend -e STATIC_DIR=/frontend \
  mini-commerce-gateway
```

### Tout lancer avec docker-compose (recommandé)

Un seul fichier `.env` à la racine (optionnel ; les défauts conviennent pour du dev) :

```bash
docker compose up --build
```

Puis ouvre **http://localhost:8085/** (frontend + API). Arrêt : `Ctrl+C` puis `docker compose down`.

Résumé :
- **4 images** : 3 builds (gateway, product-service, order-service) + 1 image officielle PostgreSQL.
- **3 images applicatives** buildées via les Dockerfiles ; **1 image PostgreSQL** : `postgres:16-alpine` dans `docker-compose.yml`.

---

## Comment tout tester (résumé)

| Étape | Où | Commande / action |
|-------|-----|-------------------|
| 1 | Terminal | PostgreSQL démarré → `createdb orders` puis `psql -d orders -f order-service/create_table.sql` ; optionnel : `cp .env.example .env` et remplir |
| 2 | Terminal 1 | `cd product-service && npm install && node index.js` (port 3005) |
| 3 | Terminal 2 | `cd order-service && npm install && node index.js` (port 3006) |
| 4 | Terminal 3 | `cd gateway && npm install && node index.js` (port 8085) |
| 5 | Navigateur | Ouvre **http://localhost:8085/** → produits, créer une commande, voir les commandes |

Vérification rapide en curl (gateway doit tourner) :
```bash
curl -s http://localhost:8085/api/products | head -c 200
curl -s -X POST http://localhost:8085/api/orders -H "Content-Type: application/json" -d '{"productId":"p1","quantity":1}'
curl -s http://localhost:8085/api/orders
```

---

## Comment tester en local (détail)

### 1. Base de données (order-service)

PostgreSQL doit tourner. Crée la base et la table :

```bash
createdb orders
psql -d orders -f order-service/create_table.sql
```

### 2. Lancer les 3 services

Ouvre **3 terminaux** et lance dans cet ordre :

**Terminal 1 – product-service (port 3005)**  
```bash
cd product-service
npm install
node index.js
```

**Terminal 2 – order-service (port 3006)**  
```bash
cd order-service
npm install
node index.js
```

**Terminal 3 – gateway (port 8085)**  
```bash
cd gateway
npm install
node index.js
```

### 3. Interface web (frontend)

Le gateway sert une petite interface dans le dossier `frontend/`. Une fois les 3 services lancés, ouvre dans le navigateur :

**http://localhost:8085/**

Tu peux y consulter la liste des produits, créer une commande (produit + quantité) et voir la liste des commandes. Tout passe par le gateway (`/api/products`, `/api/orders`).

### 4. Requêtes curl

**Via le gateway (recommandé)**

```bash
# Liste des produits
curl http://localhost:8085/api/products

# Un produit
curl http://localhost:8085/api/products/p1

# Créer une commande
curl -X POST http://localhost:8085/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":"p1","quantity":2}'

# Liste des commandes
curl http://localhost:8085/api/orders

# Une commande (remplacer ID par un id retourné par POST /orders)
curl http://localhost:8085/api/orders/<ID>
```

**Directement sur les services**

```bash
# Product-service
curl http://localhost:3005/products
curl http://localhost:3005/products/p2

# Order-service
curl -X POST http://localhost:3006/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":"p1","quantity":1}'
curl http://localhost:3006/orders
```

**Cas d’erreur (exemples)**

```bash
# Produit inexistant → 404
curl http://localhost:8085/api/products/inconnu

# Commande avec produit inexistant → 400
curl -X POST http://localhost:8085/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":"inconnu","quantity":1}'

# Commande avec quantity invalide → 400
curl -X POST http://localhost:8085/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":"p1","quantity":0}'
```
