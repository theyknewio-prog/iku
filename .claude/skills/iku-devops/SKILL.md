---
name: iku-devops
description: "Expert DevOps pour iku.gg — Docker, Coolify, Hetzner CX33, GitHub Actions, CI/CD, monitoring, déploiement. Utilise ce skill pour TOUTE question d'infrastructure : Docker, Dockerfile, Coolify, Hetzner, deploy, déploiement, CI/CD, GitHub Actions, workflow, cron, serveur, VPS, RAM, OOM, swap, monitoring, uptime, logs, backup, scaling, migration. Trigger dès que l'utilisateur mentionne : Docker, Dockerfile, deploy, déploiement, Coolify, Hetzner, serveur, server, VPS, CI/CD, GitHub Actions, workflow, cron, monitoring, logs, uptime, backup, scaling, migration, OOM, RAM, swap, disk, CPU."
---

# iku.gg — DevOps Skill

Tu es un expert DevOps/SRE spécialisé dans le déploiement de sites Next.js à grande échelle. Tu travailles sur **iku.gg** déployé sur un VPS Hetzner via Coolify.

## Infrastructure actuelle

### Serveur
| Spec | Détail |
|------|--------|
| Provider | Hetzner Cloud |
| Plan | CX33 |
| vCPU | 2 AMD (partagés) |
| RAM | 8GB |
| Disque | 80GB SSD NVMe |
| OS | Ubuntu (via Coolify) |
| Swap | ⚠️ AUCUN |
| Localisation | EU (Falkenstein ou Helsinki) |

### Stack de déploiement
```
GitHub repo → push/cron → GitHub Actions → build test
                                              ↓
                                        Coolify API trigger
                                              ↓
                                    Coolify (self-hosted) → Docker build → deploy
                                              ↓
                                    Container Next.js + yt-dlp
                                              ↓
                                    Port 3000 → reverse proxy Coolify
```

### Dockerfile actuel
```dockerfile
FROM node:22-slim

# Python + yt-dlp pour résolution vidéo
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
```

**Problèmes du Dockerfile** :
1. Pas de multi-stage build → image plus grosse que nécessaire
2. Les `node_modules` de dev sont dans l'image finale
3. Le build se fait dans la même image que le runtime
4. Pas de health check Docker

### Dockerfile optimisé recommandé
```dockerfile
# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Runtime
FROM node:22-slim AS runner
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=6144"

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/data ./src/data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:3000/ || exit 1
CMD ["node", "server.js"]
```
*(Nécessite `output: "standalone"` dans `next.config.ts`)*

## CI/CD — GitHub Actions

### Workflow principal : `daily-scrape.yml`
- **Trigger** : cron `0 4 * * *` UTC + manual (`workflow_dispatch`)
- **Job** : scrape les 5 sources, commit les JSONs, trigger deploy Coolify
- **Timeout** : 30 minutes
- **Secrets utilisés** : `GITHUB_TOKEN`, `COOLIFY_TOKEN`, `COOLIFY_HOST`, `COOLIFY_APP_ID`

### Le flow de déploiement
```
1. GitHub Actions push les nouveaux JSONs
2. curl POST vers l'API Coolify pour trigger un restart
3. Coolify pull le repo, build le Docker image
4. Coolify remplace le container (zero-downtime si configuré)
5. Next.js démarre, charge les JSONs en mémoire
```

**Problème actuel** : le deploy trigger est un `restart`, pas un `rebuild`. Si le code a changé, il faut un rebuild. Vérifier la config Coolify.

## Monitoring (À METTRE EN PLACE)

Actuellement **AUCUN monitoring**. C'est critique. Voici le plan :

### Phase 1 — Immédiat (gratuit)
1. **UptimeRobot** ou **BetterStack (Uptime)** : ping `https://iku.gg` toutes les 5 min, alerte par email/SMS si down
2. **Health endpoint** : créer `/api/health` qui retourne :
   ```json
   {
     "status": "ok",
     "uptime": 12345,
     "memory": { "heapUsed": "...", "heapTotal": "...", "rss": "..." },
     "videoCount": 353000,
     "timestamp": "..."
   }
   ```
3. **Google Search Console** : déjà configuré (ou à configurer) pour suivre l'indexation

### Phase 2 — Court terme
4. **Logs structurés** : `pino` ou `winston` pour logger les erreurs en JSON
5. **Alertes mémoire** : log quand `heapUsed > 80%` du max
6. **Métriques yt-dlp** : tracker les succès/échecs de résolution

### Phase 3 — Moyen terme
7. **Grafana Cloud** (gratuit tier) : dashboards mémoire, CPU, requêtes
8. **Sentry** (gratuit tier) : error tracking frontend + backend
9. **Core Web Vitals** : `web-vitals` library → envoyer à un endpoint

## Actions urgentes

### 1. Ajouter du swap (PRIORITÉ ABSOLUE)
```bash
# Sur le serveur Hetzner (via SSH)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Optimiser le swappiness
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```
**Pourquoi** : sans swap, si la RAM est pleine → OOM killer → le container Next.js est tué → site down. Avec 4GB de swap, le serveur a une marge de sécurité.

### 2. Configurer les backups
Les JSONs sont régénérés quotidiennement, mais le code et la config doivent être backupés :
- Le code est sur GitHub → OK
- La config Coolify → exporter régulièrement
- Les variables d'environnement → documenter dans un fichier chiffré

### 3. Scaling futur
Quand le trafic dépassera les capacités du CX33 :

**Option A — Vertical scaling** :
- Upgrader vers CX42 (16GB RAM, 4 vCPU) ~$18/mois
- Le plus simple, pas de changement d'architecture

**Option B — Horizontal** :
- CDN (Cloudflare) devant Coolify pour les assets statiques
- Séparer yt-dlp sur un worker dédié
- Redis pour le cache partagé

**Option C — Serverless edge** :
- Migrer vers Vercel (mais yt-dlp ne tourne pas en serverless)
- Garder un VPS uniquement pour `/api/resolve-video` (yt-dlp)
- Le reste sur Vercel Edge

## Commandes utiles

```bash
# SSH au serveur
ssh root@<IP_HETZNER>

# Voir les containers Docker
docker ps

# Logs du container Next.js
docker logs -f <container_id> --tail 100

# Utilisation mémoire/CPU
htop
free -h
df -h

# Voir si yt-dlp tourne
ps aux | grep yt-dlp

# Restart le container manuellement
docker restart <container_id>

# Voir la taille des images Docker
docker images --format "table {{.Repository}}\t{{.Size}}"

# Nettoyer les anciennes images Docker (libérer du disque)
docker image prune -a --filter "until=168h"
```
