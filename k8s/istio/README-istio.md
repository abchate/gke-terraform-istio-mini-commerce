# Installation et déploiement avec Istio (Service Mesh)

## Architecture avec Istio

```
Browser
   │
   ▼ port 80
Istio IngressGateway  (LoadBalancer/NodePort)
   │
   │  VirtualService routing
   ├── /api/products  → product-service:3005
   ├── /api/orders    → order-service:3006
   └── /              → web:80

Sidecar Envoy injecté dans chaque pod :
  - Chiffrement mTLS inter-services
  - Telemetrie automatique (traces, métriques)
  - Circuit breaker / load balancing
```

## Étape 1 — Démarrer Minikube avec plus de ressources

Istio nécessite plus de mémoire que Minikube par défaut :

```bash
minikube start --memory=4096 --cpus=4
```

## Étape 2 — Installer istioctl

```bash
brew install istioctl
```

Vérifie :
```bash
istioctl version
```

## Étape 3 — Installer Istio dans le cluster

```bash
istioctl install --set profile=demo -y
```

Le profil `demo` installe :
- istiod (control plane)
- istio-ingressgateway (point d'entrée)
- istio-egressgateway

Vérifie que les pods Istio tournent :
```bash
kubectl get pods -n istio-system
```

## Étape 4 — Activer l'injection automatique des sidecars

```bash
kubectl label namespace default istio-injection=enabled
```

Tous les pods créés dans `default` auront désormais un sidecar Envoy injecté automatiquement.

## Étape 5 — Déployer l'application

```bash
# Depuis la racine du projet
eval $(minikube docker-env)

docker build -t product-service:1.0 ./product-service
docker build -t order-service:1.0   ./order-service
docker build -t web:1.0             ./web

kubectl apply -f k8s/postgres-secret.yaml
kubectl apply -f k8s/product-deploy.yaml
kubectl apply -f k8s/order-deploy.yaml
kubectl apply -f k8s/web-deploy.yaml
# Note : gateway Express non nécessaire, Istio s'en charge
```

## Étape 6 — Appliquer les manifests Istio

```bash
kubectl apply -f k8s/istio/gateway.yaml
kubectl apply -f k8s/istio/virtual-services.yaml
kubectl apply -f k8s/istio/destination-rules.yaml
```

## Étape 7 — Vérifier les pods (2 conteneurs par pod = sidecar injecté)

```bash
kubectl get pods
# Chaque pod doit afficher READY 2/2 (app + sidecar Envoy)
```

## Étape 8 — Accéder à l'application

```bash
minikube service istio-ingressgateway -n istio-system
```

Ouvre l'URL affichée dans le navigateur.

## Étape 9 — Dashboard Kiali (visualisation du service mesh)

```bash
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml
istioctl dashboard kiali
```

Kiali affiche la carte du service mesh avec le trafic entre services en temps réel.
