# Locations shared by the local port and the authenticated public port (see nginx.conf).
root /usr/share/nginx/html;

gzip on;
gzip_comp_level 6;
gzip_types application/json application/javascript text/javascript text/css image/svg+xml application/geo+json;
gzip_min_length 1024;

# Security headers (repeated in every location that sets its own headers: nginx does not inherit them).
include /etc/nginx/snippets/security-headers.inc;

# ES-module workers (MapLibre): nginx's default mime.types has no .mjs and
# browsers refuse to run a module served as application/octet-stream.
location ~* \.mjs$ {
  default_type text/javascript;
  add_header Cache-Control "public, max-age=31536000, immutable";
  include /etc/nginx/snippets/security-headers.inc;
  try_files $uri =404;
}

# Hashed build assets: cache forever.
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  include /etc/nginx/snippets/security-headers.inc;
  try_files $uri =404;
}

# Baked data (DEM, airspace, static atlas fallback): revalidate daily.
location /data/ {
  add_header Cache-Control "public, max-age=86400, stale-while-revalidate=604800";
  include /etc/nginx/snippets/security-headers.inc;
  try_files $uri =404;
}

# Multiplayer relay: a long-lived WebSocket. No add_header here, so the security headers of the
# server level apply as for the rest of /api. The API pings every 15 s, which resets the read
# timeout; a connection silent for 70 s is dead.
location = /api/game/ws {
  proxy_pass http://api:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 70s;
  proxy_send_timeout 70s;
  proxy_buffering off;
}

location /api/ {
  proxy_pass http://api:8080;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  # The client's address as nginx saw it, never a header the client could forge.
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 30s;
  client_max_body_size 64k;
}

location / {
  add_header Cache-Control "no-cache";
  include /etc/nginx/snippets/security-headers.inc;
  try_files $uri /index.html;
}

# Nothing hidden is served (dotfiles, backups).
location ~ /\. {
  deny all;
}
