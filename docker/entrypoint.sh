#!/bin/sh
# Attend la base, crée le schéma si elle est vierge, puis démarre le serveur.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Attente de PostgreSQL..."
  i=0
  until pg_isready -d "$DATABASE_URL" -q; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      echo "PostgreSQL ne repond toujours pas apres 60 secondes." >&2
      exit 1
    fi
    sleep 1
  done
  echo "PostgreSQL est pret."

  # synchronize reste desactive en PostgreSQL : sur une base contenant les
  # ventes, une colonne renommee serait supprimee et recreee vide. On ne
  # l'active que sur une base encore vierge, le temps de creer les tables.
  TABLE=$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.orders')" 2>/dev/null || echo "")
  if [ -z "$TABLE" ] || [ "$TABLE" = "" ]; then
    echo "Base vierge : creation du schema."
    export DB_SYNC=true
  fi
fi

exec "$@"
