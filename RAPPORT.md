# Rapport de Projet — Mini E-Commerce Cloud Native

**Binôme :** [Prénom Nom 1] — [Prénom Nom 2]
**Date de rendu :** 15 mars 2026
**Dépôt GitHub :** [lien à compléter]

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Architecture globale](#2-architecture-globale)
3. [Service en local — 10/20](#3-service-en-local--1020)
4. [Docker et multi-conteneurs](#4-docker-et-multi-conteneurs)
5. [Gateway et Ingress — 12/20](#5-gateway-et-ingress--1220)
6. [Deuxième service et communication — 14/20](#6-deuxième-service-et-communication--1420)
7. [Base de données PostgreSQL — 16/20](#7-base-de-données-postgresql--1620)
8. [Docker Hub](#8-docker-hub)
9. [Déploiement Kubernetes complet](#9-déploiement-kubernetes-complet)
10. [Service Mesh — Istio](#10-service-mesh--istio)
11. [Frontend Vue 3](#11-frontend-vue-3)
12. [Déploiement Cloud — Terraform + GKE](#12-déploiement-cloud--terraform--gke-1820)
13. [Conclusion](#13-conclusion)

---

## 1. Présentation du projet

Application **mini e-commerce** en architecture microservices cloud-native. La logique métier est volontairement simple pour se concentrer sur l'intégration des technologies DevOps.

**Fonctionnalités :**
- Consulter un catalogue de produits
- Passer des commandes (avec validation du produit en inter-service)
- Consulter l'historique des commandes persistées en base

**Stack technique :**

| Couche | Technologie |
|--------|-------------|
| Backend | Node.js 20 + Express.js |
| Frontend | Vue 3 + Vite + Nginx |
| Base de données | PostgreSQL 16 |
| Conteneurisation | Docker (images Alpine + multi-stage) |
| Orchestration locale | Kubernetes / Minikube |
| Service Mesh | Istio (Gateway, VirtualService, DestinationRule) |
| Registre d'images | Docker Hub (abchate/*) |
| Infrastructure Cloud | GKE + Terraform |

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────┐
│                   Navigateur                     │
└─────────────────────┬───────────────────────────┘
                      │ HTTP
              ┌───────▼────────┐
              │ Istio Ingress  │  ← Service Mesh
              │   Gateway      │
              └───────┬────────┘
                      │ VirtualService routing
        ┌─────────────┼──────────────┐
        │             │              │
┌───────▼──────┐ ┌────▼───────┐ ┌───▼───┐
│product-service│ │order-service│ │  web  │
│   port 3005  │ │  port 3006  │ │ :80   │
│  5 produits  │◄┤  valide     │ │ Vue 3 │
│  en mémoire  │ │  le produit │ └───────┘
└──────────────┘ └─────┬───────┘
                       │
                ┌──────▼──────┐
                │ PostgreSQL  │
                │ StatefulSet │
                │ PVC 2Gi     │
                └─────────────┘
```

**Services Kubernetes :**

| Service | Type | Port | Rôle |
|---------|------|------|------|
| product-service | ClusterIP | 3005 | Catalogue produits |
| order-service | ClusterIP | 3006 | Gestion commandes |
| postgres | Headless | 5432 | Base de données |
| web | ClusterIP | 80 | Frontend Vue 3 |
| gateway | LoadBalancer | 80 | Point d'entrée (GKE) |
| istio-ingressgateway | LoadBalancer | 80 | Point d'entrée Istio |

---

## 3. Service en local — 10/20

### Le product-service

Premier service développé : API REST Node.js/Express exposant 5 produits en mémoire.

```
GET /products       → liste des produits
GET /products/:id   → un produit (404 si inexistant)
```

**Code (`product-service/index.js`) :**
```javascript
const products = [
  { id: 'p1', name: 'T-shirt',    price: 19.99 },
  { id: 'p2', name: 'Jean',       price: 49.99 },
  { id: 'p3', name: 'Chaussures', price: 79.99 },
  { id: 'p4', name: 'Sac',        price: 39.99 },
  { id: 'p5', name: 'Casquette',  price: 14.99 },
];
app.get('/products', (req, res) => res.json(products));
app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
  res.json(product);
});
```

**Dockerfile (`product-service/Dockerfile`) :**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3005
CMD ["node", "index.js"]
```

**Deployment Kubernetes (`k8s/product-deploy.yaml`) :**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: product-service
          image: abchate/product-service:1.0
          ports:
            - containerPort: 3005
```

---

### Capture 1 — product-service qui tourne en local

> Commande lancée :
> ```bash
> cd product-service && node index.js
> ```
> Ce qu'on voit dans le terminal : `product-service écoute sur le port 3005`

<!-- CAPTURE 1 : terminal avec le service démarré -->

---

### Capture 2 — Appel API produits

> Commande lancée :
> ```bash
> curl http://localhost:3005/products
> ```
> Réponse JSON avec les 5 produits.

<!-- CAPTURE 2 : terminal avec la réponse JSON -->

---

## 4. Docker et multi-conteneurs

### Images Docker

Chaque service a son Dockerfile. Le frontend utilise un **build multi-stage** :

```dockerfile
# Stage 1 : compilation Vue 3
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build        # génère dist/

# Stage 2 : serveur Nginx (image finale légère)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Docker Compose — 5 conteneurs

`docker-compose.yml` orchestre les 5 services :

```
postgres         → base de données (health check pg_isready)
product-service  → port 3005
order-service    → port 3006 (dépend de postgres)
web              → frontend Vue 3 compilé, servi par Nginx
gateway          → port 8085, point d'entrée proxy
```

---

### Capture 3 — docker compose up --build

> Commande lancée :
> ```bash
> docker compose up --build
> ```
> On voit les 5 services démarrer avec leurs logs.

<!-- CAPTURE 3 : terminal avec les 5 services démarrés -->

---

### Capture 4 — docker ps

> Commande lancée :
> ```bash
> docker ps
> ```
> 5 conteneurs en STATUS = Up.

<!-- CAPTURE 4 : sortie de docker ps avec les 5 conteneurs -->

---

## 5. Gateway et Ingress — 12/20

### La Gateway Express

Point d'entrée unique qui proxy les requêtes vers les bons services :

```javascript
// /api/products → product-service:3005
app.use('/api/products', createProxyMiddleware({
  target: 'http://product-service:3005',
  pathRewrite: { '^/api/products': '/products' },
}));

// /api/orders → order-service:3006
app.use('/api/orders', createProxyMiddleware({
  target: 'http://order-service:3006',
  pathRewrite: { '^/api/orders': '/orders' },
}));

// / → frontend Vue 3
app.use('/', createProxyMiddleware({ target: 'http://web:80' }));
```

### Ingress NGINX (`k8s/ingress.yaml`)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mini-commerce-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: mini-commerce.local
      http:
        paths:
          - path: /
            backend:
              service:
                name: gateway
                port:
                  number: 8085
```

---

### Capture 5 — L'application dans le navigateur (Docker Compose)

> URL : `http://localhost:8085`
> Page Vue 3 avec les produits, le formulaire de commande et le tableau.

<!-- CAPTURE 5 : navigateur sur http://localhost:8085 -->

---

### Capture 6 — Test gateway via curl

> Commande lancée :
> ```bash
> curl http://localhost:8085/api/products
> ```
> Les produits passent par la gateway.

<!-- CAPTURE 6 : terminal avec la réponse JSON via gateway -->

---

## 6. Deuxième service et communication — 14/20

### order-service

Gère les commandes et **appelle product-service** avant toute création pour valider l'existence du produit.

**Flux de création d'une commande :**
```
POST /api/orders
       │
       ▼ order-service
  GET product-service/products/:id
       │
  ┌────┴────────────────────────┐
  │ 404 → 400 Produit inexistant│
  │ 200 → INSERT en PostgreSQL  │
  └─────────────────────────────┘
```

**Code de validation inter-service :**
```javascript
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3005';

async function checkProductExists(productId) {
  const res = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`);
  return res.ok;
}

app.post('/orders', async (req, res) => {
  const { productId, quantity } = req.body;
  const exists = await checkProductExists(productId);
  if (!exists) return res.status(400).json({ error: 'Produit inexistant' });
  // INSERT en base...
});
```

En Kubernetes, `PRODUCT_SERVICE_URL=http://product-service:3005` (DNS interne du cluster).

---

### Capture 7 — Créer une commande depuis l'interface

> Dans le navigateur `http://localhost:8085` :
> 1. Sélectionner un produit
> 2. Entrer une quantité
> 3. Cliquer "Créer la commande"
> Message vert : "Commande créée : [uuid]"

<!-- CAPTURE 7 : interface avec le message de confirmation -->

---

### Capture 8 — Validation inter-service (produit inexistant)

> Commande lancée :
> ```bash
> curl -X POST http://localhost:8085/api/orders \
>   -H "Content-Type: application/json" \
>   -d '{"productId":"inexistant","quantity":1}'
> ```
> Réponse : `{"error":"Produit inexistant"}`

<!-- CAPTURE 8 : terminal avec la réponse 400 -->

---

### Capture 9 — Création + liste des commandes via curl

> Commandes lancées :
> ```bash
> curl -X POST http://localhost:8085/api/orders \
>   -H "Content-Type: application/json" \
>   -d '{"productId":"p1","quantity":2}'
>
> curl http://localhost:8085/api/orders
> ```

<!-- CAPTURE 9 : terminal avec la commande créée et la liste -->

---

## 7. Base de données PostgreSQL — 16/20

### Schéma

```sql
CREATE TABLE IF NOT EXISTS orders (
  id         VARCHAR(36)  PRIMARY KEY,
  product_id VARCHAR(50)  NOT NULL,
  quantity   INTEGER      NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### StatefulSet Kubernetes

PostgreSQL est déployé en **StatefulSet** avec un **PersistentVolumeClaim** de 2Gi :

```yaml
kind: StatefulSet
metadata:
  name: postgres
spec:
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 2Gi
```

### Secret Kubernetes

Les identifiants ne sont jamais en clair — ils viennent d'un Secret :

```yaml
kind: Secret
metadata:
  name: postgres-credentials
data:
  username: b3JkZXJzdXNlcg==   # base64
  password: b3JkZXJzcGFzcw==
```

Dans le Deployment, order-service lit ces valeurs :
```yaml
env:
  - name: ORDER_DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: postgres-credentials
        key: password
```

---

## 8. Docker Hub

Les 4 images sont publiées sur Docker Hub sous le compte **abchate** :

```bash
docker build -t abchate/product-service:1.0 ./product-service
docker push abchate/product-service:1.0

docker build -t abchate/order-service:1.0 ./order-service
docker push abchate/order-service:1.0

docker build -t abchate/gateway:1.0 ./gateway
docker push abchate/gateway:1.0

docker build -t abchate/web:1.0 ./web
docker push abchate/web:1.0
```

Les manifests Kubernetes utilisent `imagePullPolicy: Always` pour toujours récupérer depuis Docker Hub.

---

### Capture 10 — Push d'une image sur Docker Hub

> Commande lancée :
> ```bash
> docker push abchate/product-service:1.0
> ```
> Les layers s'uploadent avec le digest final.

<!-- CAPTURE 10 : terminal pendant le docker push -->

---

### Capture 11 — Docker Hub dans le navigateur

> URL : `https://hub.docker.com/u/abchate`
> Les 4 repositories sont visibles.

<!-- CAPTURE 11 : page hub.docker.com/u/abchate avec les 4 images -->

---

## 9. Déploiement Kubernetes complet

### Manifests créés

| Fichier | Ressources |
|---------|-----------|
| `k8s/postgres-secret.yaml` | Secret `postgres-credentials` |
| `k8s/product-deploy.yaml` | Deployment + Service ClusterIP (3005) |
| `k8s/order-deploy.yaml` | ConfigMap + StatefulSet postgres + Service headless + Deployment order-service |
| `k8s/web-deploy.yaml` | Deployment + Service ClusterIP (80) |
| `k8s/gateway-deploy.yaml` | Deployment + Service LoadBalancer (80) |
| `k8s/ingress.yaml` | Ingress NGINX |

### Déploiement sur Minikube

```bash
minikube start
eval $(minikube docker-env)

docker build -t product-service:1.0 ./product-service
docker build -t order-service:1.0   ./order-service
docker build -t gateway:1.0         ./gateway
docker build -t web:1.0             ./web

kubectl apply -f k8s/postgres-secret.yaml
kubectl apply -f k8s/product-deploy.yaml
kubectl apply -f k8s/order-deploy.yaml
kubectl apply -f k8s/web-deploy.yaml
kubectl apply -f k8s/gateway-deploy.yaml
kubectl apply -f k8s/ingress.yaml
```

---

### Capture 12 — minikube start

> Commande lancée :
> ```bash
> minikube start
> ```
> "Done! kubectl is now configured"

<!-- CAPTURE 12 : terminal minikube start -->

---

### Capture 13 — kubectl apply

> Commande lancée :
> ```bash
> kubectl apply -f k8s/
> ```
> Liste des ressources created/configured.

<!-- CAPTURE 13 : terminal kubectl apply -->

---

### Capture 14 — kubectl get pods (tous Running)

> Commande lancée :
> ```bash
> kubectl get pods
> ```
> 5 pods en STATUS = Running.

<!-- CAPTURE 14 : tous les pods Running -->

---

### Capture 15 — kubectl get services

> Commande lancée :
> ```bash
> kubectl get services
> ```
> Liste des services avec leurs types et ports.

<!-- CAPTURE 15 : liste des services Kubernetes -->

---

### Capture 16 — StatefulSet et PVC

> Commandes lancées :
> ```bash
> kubectl get statefulset
> kubectl get pvc
> ```
> StatefulSet postgres READY 1/1, PVC Bound avec 2Gi.

<!-- CAPTURE 16 : statefulset et pvc -->

---

### Capture 17 — Secret Kubernetes

> Commande lancée :
> ```bash
> kubectl get secrets
> kubectl describe secret postgres-credentials
> ```
> Les clés sont visibles, les valeurs masquées.

<!-- CAPTURE 17 : secret kubernetes -->

---

### Capture 18 — Application via Minikube

> Commande lancée :
> ```bash
> minikube service gateway
> ```
> L'URL s'affiche et le navigateur s'ouvre sur l'application.

<!-- CAPTURE 18 : terminal + navigateur via minikube -->

---

### Capture 19 — Tests curl via Minikube

> Commandes lancées (PORT = port affiché par minikube service) :
> ```bash
> curl http://127.0.0.1:PORT/api/products
> curl -X POST http://127.0.0.1:PORT/api/orders \
>   -H "Content-Type: application/json" \
>   -d '{"productId":"p2","quantity":3}'
> curl http://127.0.0.1:PORT/api/orders
> ```

<!-- CAPTURE 19 : les 3 curls et leurs réponses -->

---

### Capture 20 — Ingress

> Commande lancée :
> ```bash
> kubectl get ingress
> ```

<!-- CAPTURE 20 : ingress avec host mini-commerce.local -->

---

## 10. Service Mesh — Istio

### Pourquoi Istio ?

Istio est un **service mesh** : il injecte un proxy Envoy (sidecar) dans chaque pod pour gérer le trafic, la sécurité mTLS et l'observabilité **sans modifier le code applicatif**.

### Architecture avec Istio

```
Browser
   │ port 80
   ▼
Istio IngressGateway        ← remplace la gateway Express
   │
   │ VirtualService routing
   ├── /api/products  →  product-service:3005
   ├── /api/orders    →  order-service:3006
   └── /              →  web:80

Sidecar Envoy dans chaque pod :
  ✅ mTLS automatique inter-services
  ✅ Load balancing ROUND_ROBIN
  ✅ Telemetrie (Kiali, Prometheus)
```

### Manifests Istio (`k8s/istio/`)

**gateway.yaml** — Point d'entrée HTTP :
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: mini-commerce-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port: {number: 80, protocol: HTTP}
      hosts: ["*"]
```

**virtual-services.yaml** — Règles de routage :
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
spec:
  http:
    - match: [{uri: {prefix: /api/products}}]
      rewrite: {uri: /products}
      route: [{destination: {host: product-service, port: {number: 3005}}}]
    - match: [{uri: {prefix: /api/orders}}]
      rewrite: {uri: /orders}
      route: [{destination: {host: order-service, port: {number: 3006}}}]
    - match: [{uri: {prefix: /}}]
      route: [{destination: {host: web, port: {number: 80}}}]
```

**destination-rules.yaml** — Load balancing :
```yaml
# ROUND_ROBIN sur product-service, order-service et web
```

### Installation

```bash
minikube start --memory=4096 --cpus=4
brew install istioctl
istioctl install --set profile=demo -y
kubectl label namespace default istio-injection=enabled
kubectl apply -f k8s/istio/
```

---

### Capture 21 — Pods avec sidecar (READY 2/2)

> Commande lancée :
> ```bash
> kubectl get pods
> ```
> Chaque pod affiche **2/2** dans READY (app + sidecar Envoy).

<!-- CAPTURE 21 : pods avec 2/2 READY -->

---

### Capture 22 — Ressources Istio

> Commandes lancées :
> ```bash
> kubectl get gateway
> kubectl get virtualservice
> kubectl get destinationrule
> ```

<!-- CAPTURE 22 : gateway, virtualservice, destinationrule listés -->

---

### Capture 23 — Application via Istio IngressGateway

> Commande lancée :
> ```bash
> minikube service istio-ingressgateway -n istio-system
> ```
> L'app s'ouvre dans le navigateur via le service mesh Istio.

<!-- CAPTURE 23 : navigateur avec l'app via Istio -->

---

### Capture 24 — Dashboard Kiali (visualisation du service mesh)

> Commandes lancées :
> ```bash
> kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml
> kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml
> istioctl dashboard kiali
> ```
> Carte du service mesh avec le trafic entre services en temps réel.

<!-- CAPTURE 24 : dashboard Kiali avec la carte des services -->

---

## 11. Frontend Vue 3

SPA développée avec **Vue 3** et **Vite**, compilée et servie par **Nginx**.

**Fonctionnalités :**
- Grille de produits responsive
- Formulaire de commande (sélection produit + quantité)
- Tableau des commandes
- Gestion des erreurs (message rouge si produit invalide)

**Build multi-stage** : l'image finale contient uniquement Nginx + les assets compilés (pas de Node.js).

**Nginx SPA fallback :**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

### Capture 25 — Application complète dans le navigateur

> URL : `http://localhost:8085` ou URL Minikube/GKE
> Page avec produits + formulaire + tableau des commandes rempli.

<!-- CAPTURE 25 : page complète avec 2-3 commandes dans le tableau -->

---

## 12. Déploiement Cloud — Terraform + GKE (18/20)

### 12.1 Infrastructure as Code avec Terraform

Terraform provisionne automatiquement le cluster **GKE (Google Kubernetes Engine)** sur Google Cloud Platform. Toute l'infrastructure est décrite en code dans le dossier `terraform/`.

**Structure des fichiers :**
```
terraform/
├── main.tf                   → Cluster GKE + Node Pool + activation APIs
├── variables.tf              → Variables paramétrables
├── outputs.tf                → Informations de sortie (endpoint, commande kubectl)
└── terraform.tfvars.example  → Template de configuration
```

### 12.2 Ce que Terraform crée (`terraform/main.tf`)

```hcl
# Activation des APIs GCP
resource "google_project_service" "container" {
  service = "container.googleapis.com"
}
resource "google_project_service" "compute" {
  service = "compute.googleapis.com"
}

# Cluster GKE
resource "google_container_cluster" "primary" {
  name                     = var.cluster_name   # "mini-commerce-cluster"
  location                 = var.zone           # "europe-west1-b"
  remove_default_node_pool = true
}

# Node Pool : 2 machines e2-medium (2 vCPU, 4Go RAM)
resource "google_container_node_pool" "primary_nodes" {
  node_count = 2
  node_config {
    machine_type = "e2-medium"
    disk_size_gb = 30
    labels       = { app = "mini-commerce" }
  }
  management {
    auto_repair  = true
    auto_upgrade = true
  }
}
```

**Outputs (`terraform/outputs.tf`) :**
```hcl
output "kubectl_config_command" {
  value = "gcloud container clusters get-credentials mini-commerce-cluster --zone europe-west1-b --project ${var.project_id}"
}
```

### 12.3 Variables (`terraform/variables.tf`)

```hcl
variable "project_id"   { type = string }                        # ID du projet GCP
variable "region"        { default = "europe-west1" }
variable "zone"          { default = "europe-west1-b" }
variable "cluster_name"  { default = "mini-commerce-cluster" }
variable "node_count"    { default = 2 }
variable "machine_type"  { default = "e2-medium" }
```

### 12.4 Déploiement pas à pas

```bash
# 1. Authentification GCP
gcloud auth login
gcloud auth application-default login
gcloud config set project TON-PROJECT-ID

# 2. Configuration Terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Éditer terraform.tfvars et renseigner project_id

# 3. Initialisation
terraform init

# 4. Planification (aperçu des ressources à créer)
terraform plan

# 5. Création du cluster GKE (~5-10 min)
terraform apply   # taper "yes" pour confirmer

# 6. Connexion kubectl au cluster GKE
gcloud container clusters get-credentials mini-commerce-cluster \
  --zone europe-west1-b --project TON-PROJECT-ID

# 7. Déploiement de l'application (images depuis Docker Hub)
cd ..
kubectl apply -f k8s/postgres-secret.yaml
kubectl apply -f k8s/product-deploy.yaml
kubectl apply -f k8s/order-deploy.yaml
kubectl apply -f k8s/web-deploy.yaml
kubectl apply -f k8s/gateway-deploy.yaml

# 8. Récupérer l'IP publique du gateway (LoadBalancer GKE)
kubectl get service gateway --watch
# Attendre que EXTERNAL-IP soit assignée

# 9. Ouvrir dans le navigateur
# http://EXTERNAL-IP
```

> ⚠️ **Après les captures, détruire le cluster pour éviter les frais GCP :**
> ```bash
> cd terraform && terraform destroy
> ```

---

### Capture 26 — terraform init

> Commande lancée :
> ```bash
> cd terraform && terraform init
> ```
> "Terraform has been successfully initialized!"

<!-- CAPTURE 26 : terminal terraform init -->

---

### Capture 27 — terraform plan

> Commande lancée :
> ```bash
> terraform plan
> ```
> Liste des ressources qui vont être créées : cluster GKE, node pool, APIs activées.

<!-- CAPTURE 27 : terminal terraform plan avec les ressources listées -->

---

### Capture 28 — terraform apply

> Commande lancée :
> ```bash
> terraform apply
> ```
> "Apply complete! Resources: 4 added" avec les outputs (cluster_name, kubectl_config_command).

<!-- CAPTURE 28 : terminal terraform apply terminé -->

---

### Capture 29 — Cluster GKE dans la console Google Cloud

> URL : `https://console.cloud.google.com/kubernetes/list`
> Le cluster `mini-commerce-cluster` est visible avec statut "En cours d'exécution".

<!-- CAPTURE 29 : console GCP avec le cluster GKE -->

---

### Capture 30 — Pods Running sur GKE

> Commande lancée :
> ```bash
> kubectl get pods
> kubectl get services
> ```
> Tous les pods Running sur le cluster GKE, avec l'EXTERNAL-IP du service gateway.

<!-- CAPTURE 30 : kubectl get pods et services sur GKE -->

---

### Capture 31 — Application accessible via l'IP publique GKE

> URL : `http://EXTERNAL-IP` (IP assignée par GKE au LoadBalancer)
> L'application Mini Commerce est accessible depuis internet.

<!-- CAPTURE 31 : navigateur avec l'app via l'IP publique GKE -->

---

## 13. Conclusion

### Récapitulatif des technologies intégrées

### Récapitulatif des technologies intégrées

| Critère sujet | Réalisé |
|---------------|---------|
| Web service Node.js | ✅ 3 services Express.js |
| Docker + Dockerfile | ✅ 4 images (dont 1 multi-stage) |
| Multi-conteneurs | ✅ Docker Compose 5 conteneurs |
| Kubernetes | ✅ Deployment, StatefulSet, Service, Secret, ConfigMap, PVC, Ingress |
| Gateway | ✅ Express + Ingress NGINX |
| Service Mesh Istio | ✅ Gateway + VirtualService + DestinationRule + sidecar Envoy |
| 2 services reliés | ✅ order-service → product-service |
| Base de données | ✅ PostgreSQL 16 StatefulSet + PVC 2Gi |
| Frontend | ✅ Vue 3 + Vite + Nginx |
| Docker Hub | ✅ 4 images publiées (abchate/*) |
| Terraform | ✅ Cluster GKE provisionné |
| Déploiement Cloud GKE | ✅ Application sur GCP |

### Points techniques notables

1. **StatefulSet + PVC** : PostgreSQL survit aux redémarrages de pods grâce au PersistentVolumeClaim de 2Gi.
2. **Secrets Kubernetes** : les identifiants de base de données ne sont jamais en clair dans le code.
3. **DNS Kubernetes** : `order-service` appelle `product-service` via son nom de service (`http://product-service:3005`), résolu automatiquement par le cluster.
4. **Build multi-stage** : l'image web ne contient que Nginx + assets compilés, sans Node.js.
5. **Istio sidecar** : chaque pod reçoit un proxy Envoy injecté automatiquement — mTLS et observabilité sans modification du code.

---

*Rapport de projet — Cours Kubernetes / Microservices*
