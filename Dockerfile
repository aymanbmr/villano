# Villano en une image : le serveur sert l'API et l'application compilée, donc
# un seul processus sur un seul port suffit.
#
# La compilation se fait dans une première image jetable — outils de build,
# sources TypeScript, dépendances de développement — et seul le résultat passe
# dans l'image finale, qui reste légère et sans compilateur.

# ---------------------------------------------------------------- compilation
FROM node:22-bookworm-slim AS build

# better-sqlite3 se compile à l'installation (node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Les manifestes d'abord : tant qu'ils ne changent pas, Docker réutilise la
# couche des dépendances au lieu de tout réinstaller à chaque build.
COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm install --prefix backend --no-audit --no-fund \
 && npm install --prefix frontend --no-audit --no-fund

COPY backend/ backend/
COPY frontend/ frontend/
RUN npm run build --prefix backend \
 && npm run build --prefix frontend

# Les dépendances de développement n'ont plus lieu d'être dans l'image finale
RUN npm prune --omit=dev --prefix backend

# ----------------------------------------------------------------- exécution
FROM node:22-bookworm-slim AS runtime

# pg_isready, pour attendre que la base accepte les connexions
RUN apt-get update && apt-get install -y --no-install-recommends \
      postgresql-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Le fuseau compte ici plus qu'ailleurs : les journées de caisse et les
# statistiques raisonnent en heure locale du serveur. Un conteneur laissé en
# UTC ferait basculer une commande encaissée à 00h30 sur la veille, et
# décalerait d'une heure la courbe des ventes. À vérifier après démarrage, les
# règles marocaines ayant changé plusieurs fois : « date » dans le conteneur
# doit afficher la même heure que la pendule du café.
ENV NODE_ENV=production \
    TZ=Africa/Casablanca \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

# L'arborescence est conservée telle quelle : le serveur résout sa base, ses
# images et le frontend par rapport à backend/, son dossier de travail.
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/node_modules backend/node_modules
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/frontend/dist frontend/dist

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Les images téléversées par le gérant survivent aux mises à jour de l'image
RUN mkdir -p backend/uploads && chown -R node:node backend/uploads
VOLUME ["/app/backend/uploads"]

USER node
WORKDIR /app/backend
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
