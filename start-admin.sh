#!/bin/bash
cd /var/www/zyra/apps/admin
export PORT=${PORT:-3024}
export NODE_ENV=${NODE_ENV:-production}
exec node_modules/.bin/next start
