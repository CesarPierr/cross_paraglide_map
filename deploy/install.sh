#!/usr/bin/env bash
# Installs or updates Brises des Alpes on a Linux server with Docker.
#
#   curl -fsSL https://raw.githubusercontent.com/CesarPierr/cross_paraglide_map/<branche>/deploy/install.sh | bash -s -- [options]
#   or, from a clone:  bash deploy/install.sh [options]
#
# Options:
#   --dir <path>      install directory            (default: ~/brises-des-alpes)
#   --branch <name>   git branch                   (default: main)
#   --port <n>        HTTP port of the site        (default: 8080)
#   --repo <url>      git repository               (default: https://github.com/CesarPierr/cross_paraglide_map.git)
#   --refresh-data    also re-download FFVL sites and airspace before building (needs Node 22 on the host)
#
# Idempotent: re-run it to update. Secrets are generated once in <dir>/.env.
set -euo pipefail

DIR="${HOME}/brises-des-alpes"
BRANCH="main"
PORT="8080"
REPO="https://github.com/CesarPierr/cross_paraglide_map.git"
REFRESH=0
PORT_SET=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --port) PORT="$2"; PORT_SET=1; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --refresh-data) REFRESH=1; shift ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

command -v git >/dev/null || die "git manquant (sudo apt install -y git)"
command -v docker >/dev/null || die "Docker manquant : https://docs.docker.com/engine/install/ (ou: curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker \$USER)"
docker compose version >/dev/null 2>&1 || die "plugin docker compose manquant (sudo apt install -y docker-compose-plugin)"
docker info >/dev/null 2>&1 || die "Docker inaccessible pour $(whoami) : ajouter l'utilisateur au groupe docker puis se reconnecter"

if [ -d "${DIR}/.git" ]; then
  say "Mise à jour de ${DIR} (${BRANCH})"
  git -C "${DIR}" fetch --quiet origin "${BRANCH}"
  git -C "${DIR}" checkout --quiet "${BRANCH}"
  git -C "${DIR}" merge --quiet --ff-only "origin/${BRANCH}"
else
  say "Clonage dans ${DIR}"
  git clone --quiet --branch "${BRANCH}" "${REPO}" "${DIR}"
fi
cd "${DIR}"

if [ ! -f .env ]; then
  say "Génération de .env (secrets aléatoires)"
  rand() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  umask 077
  cat > .env <<EOF
POSTGRES_PASSWORD=$(rand)
ADMIN_TOKEN=$(rand)
IP_SALT=$(rand)
CORS_ORIGIN=*
WEATHER_DAILY_BUDGET=8000
HTTP_PORT=${PORT}
LOG_LEVEL=info
EOF
elif [ "${PORT_SET}" = 1 ]; then
  # Keep the existing secrets; only change the port when asked explicitly.
  if grep -q '^HTTP_PORT=' .env; then sed -i "s/^HTTP_PORT=.*/HTTP_PORT=${PORT}/" .env; else echo "HTTP_PORT=${PORT}" >> .env; fi
else
  PORT=$(sed -n 's/^HTTP_PORT=//p' .env | head -1); PORT=${PORT:-8080}
fi

if [ "${REFRESH}" = 1 ]; then
  command -v node >/dev/null || die "--refresh-data demande Node.js 22"
  say "Rafraîchissement des données (sites FFVL, espaces aériens)"
  npm ci --no-audit --no-fund
  npm run data:sites || echo "  import FFVL impossible, on garde les données existantes"
  npm run data:airspace || echo "  espaces aériens impossibles, on garde les données existantes"
fi

# Public port (to forward from the router): one login, random password, written once.
# The plain password stays in .public-credentials (readable by this user only).
if [ ! -s .htpasswd ]; then
  command -v openssl >/dev/null || die "openssl manquant (sudo apt install -y openssl)"
  [ -d .htpasswd ] && rmdir .htpasswd  # left by a compose run without the file
  say "Génération de l'accès public (identifiant et mot de passe)"
  umask 077
  PUB_USER=invite
  PUB_PASS=$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 16)
  printf '%s:%s\n' "${PUB_USER}" "$(openssl passwd -apr1 "${PUB_PASS}")" > .htpasswd
  printf 'identifiant=%s\nmot_de_passe=%s\n' "${PUB_USER}" "${PUB_PASS}" > .public-credentials
  chmod 644 .htpasswd  # read by nginx inside the container (hashes only)
fi
grep -q '^PUBLIC_PORT=' .env || echo "PUBLIC_PORT=8090" >> .env

say "Construction et démarrage (docker compose)"
docker compose up -d --build --remove-orphans

say "Attente de l'API"
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    # Reload the knowledge base from the image (contributions and caches are kept),
    # then restart the API so it re-serialises the atlas.
    docker compose exec -T api node dist/cli/seed.js /app/seed/atlas.json /app/seed/sites-ffvl.json
    docker compose restart api >/dev/null
    for _ in $(seq 1 30); do curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 2; done
    curl -fsS "http://localhost:${PORT}/api/health"; echo
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    say "Site prêt : http://${IP:-localhost}:${PORT}"
    say "Jeton de modération : grep ADMIN_TOKEN ${DIR}/.env"
    say "Accès public (port $(sed -n 's/^PUBLIC_PORT=//p' .env), identifiant et mot de passe) : cat ${DIR}/.public-credentials"
    exit 0
  fi
  sleep 3
done
docker compose ps
docker compose logs --tail 50 api
die "l'API ne répond pas sur le port ${PORT}"
