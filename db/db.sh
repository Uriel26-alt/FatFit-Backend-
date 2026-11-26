#!/usr/bin/env bash
# Base de datos de desarrollo de FatFit en Docker.
#   bash db/db.sh levantar   crea/arranca el contenedor y, si la base está vacía, aplica esquema y semillas
#   bash db/db.sh aplicar    BORRA todos los datos y vuelve a aplicar esquema y semillas
#   bash db/db.sh psql       abre una consola SQL
set -euo pipefail
cd "$(dirname "$0")"
NOMBRE=fatfit-db
sql() { docker exec -i "$NOMBRE" psql -v ON_ERROR_STOP=1 -q -U fatfit -d fatfit "$@"; }
aplicar() { sql < 01_esquema.sql; sql < 02_semillas.sql; sql < 03_cuentas_prueba.sql; echo "Esquema, semillas y cuentas de prueba aplicados."; }
esperar() { for _ in $(seq 1 40); do sql -c 'select 1' >/dev/null 2>&1 && return 0; sleep 1; done; echo "PostgreSQL no respondió" >&2; exit 1; }

case "${1:-levantar}" in
  levantar)
    if docker inspect "$NOMBRE" >/dev/null 2>&1; then docker start "$NOMBRE" >/dev/null
    else docker run -d --name "$NOMBRE" -e POSTGRES_USER=fatfit -e POSTGRES_PASSWORD=fatfit_dev -e POSTGRES_DB=fatfit \
           -p 5433:5432 -v fatfit_pgdata:/var/lib/postgresql/data postgres:16 >/dev/null
    fi
    esperar
    if [ "$(sql -tAc "select count(*) from information_schema.schemata where schema_name='auth'")" = "0" ]; then aplicar; fi
    echo "PostgreSQL listo en localhost:5433 (base fatfit, usuario fatfit)." ;;
  aplicar) esperar; aplicar ;;
  psql) docker exec -it "$NOMBRE" psql -U fatfit -d fatfit ;;
  *) echo "Uso: bash db/db.sh [levantar|aplicar|psql]" >&2; exit 1 ;;
esac
