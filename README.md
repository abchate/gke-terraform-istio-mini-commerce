# gke-terraform-istio-mini-commerce
Cloud-native mini e-commerce on Google Cloud: GKE provisioned with Terraform, service-to-service security and traffic management with Istio/Cloud Service Mesh, and PostgreSQL backend. Business logic kept minimal to focus on DevOps and cloud integration.

---

## Communication inter-services (réseau Kubernetes)

En K8s, **order-service** appelle **product-service** via le réseau du cluster (DNS Kubernetes), pas en localhost :

- Dans `k8s/order-deploy.yaml`, la variable `PRODUCT_SERVICE_URL` est définie à **`http://product-service:3005`** (nom du Service Kubernetes).
- **order-service** fait un `GET` sur `${PRODUCT_SERVICE_URL}/products/:id` pour vérifier qu’un produit existe avant de créer une commande (`order-service/index.js`, `checkProductExists`).
- **Gestion d’erreur** : si le produit n’existe pas (product-service renvoie 404), order-service répond **400** avec `{ "error": "Produit inexistant" }` et ne crée pas la commande.

Pour tester : `POST /api/orders` avec `{"productId": "inexistant", "quantity": 1}` → **400 Produit inexistant**.

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

### Stack « pro » : frontend Vue 3 (dossier `web/`)

- **web** : Vue 3 + Vite, build puis servi par nginx (Dockerfile multi-stage). Service séparé en K8s et dans docker-compose.
- Le **gateway** proxy `/` vers le service `web` quand `FRONTEND_SERVICE_URL` est défini (K8s et compose). Sinon, GET `/` affiche un message invitant à configurer le frontend.

Build de l’image web :

```bash
docker build -t web:1.0 ./web
```

### Build des images (backend + gateway + web)

À la racine du projet :

```bash
docker build -t mini-commerce-gateway ./gateway
docker build -t mini-commerce-product ./product-service
docker build -t mini-commerce-order ./order-service
docker build -t web:1.0 ./web
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
  -e FRONTEND_SERVICE_URL=http://host.docker.internal:8080 \
  mini-commerce-gateway
# (avec un conteneur web:1.0 sur le port 8080 en parallèle)
```

### Tout lancer avec docker-compose (recommandé)

Un seul fichier `.env` à la racine (optionnel ; les défauts conviennent pour du dev) :

```bash
docker compose up --build
```

Puis ouvre **http://localhost:8085/** : le gateway sert l’app Vue (service `web`) et les APIs. Arrêt : `Ctrl+C` puis `docker compose down`.

Résumé :
- **5 conteneurs** : postgres, product-service, order-service, **web** (Vue 3), gateway.
- **4 images applicatives** (product-service, order-service, gateway, web) + 1 image PostgreSQL.

### Comment tester le K8s (Minikube)

Prérequis : Minikube démarré (`minikube start`), `kubectl` installé.

**1. Utiliser le Docker du cluster** (pour que les images buildées soient visibles par Minikube) :
```bash
eval $(minikube docker-env)
```

**2. Builder les 4 images** (à la racine du projet) :
```bash
docker build -t product-service:1.0 ./product-service
docker build -t order-service:1.0 ./order-service
docker build -t gateway:1.0 ./gateway
docker build -t web:1.0 ./web
```

**3. Appliquer les manifests** (dans l’ordre) :
```bash
kubectl apply -f k8s/product-deploy.yaml
kubectl apply -f k8s/order-deploy.yaml    # postgres + order-service
kubectl apply -f k8s/web-deploy.yaml
kubectl apply -f k8s/gateway-deploy.yaml
```

**4. Vérifier que les pods tournent** :
```bash
kubectl get pods
```
Tous doivent être `Running` (postgres peut prendre 30 s pour le healthcheck).

**5. Ouvrir l’app dans le navigateur** (garder le terminal ouvert) :
```bash
minikube service gateway
```
Minikube affiche une URL du type **http://127.0.0.1:xxxxx** et ouvre le navigateur. Tu vois l’interface Vue (produits, formulaire de commande, liste des commandes).

**6. Tester les APIs en curl** (avec l’URL du tunnel, ex. port 53335) :
```bash
curl http://127.0.0.1:53335/api/products
curl -X POST http://127.0.0.1:53335/api/orders -H "Content-Type: application/json" -d '{"productId":"p1","quantity":1}'
curl http://127.0.0.1:53335/api/orders
```

**Nettoyage** :
```bash
kubectl delete -f k8s/
# pour quitter le docker-env Minikube : eval $(minikube docker-env -u)
```

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

### 3. Interface web (Vue 3)

L’interface est le service **web** (Vue 3). En local sans Docker : lance le gateway + product + order, puis soit `cd web && npm run dev` (http://localhost:5173 avec proxy vers le gateway), soit utilise docker-compose pour tout lancer et ouvre **http://localhost:8085/** (gateway proxy vers web).

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
