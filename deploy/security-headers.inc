# Security headers of every response (included in each location: nginx does not inherit add_header).
# Scripts and workers only from the site; tiles, forecasts and directories come from many HTTPS servers.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
