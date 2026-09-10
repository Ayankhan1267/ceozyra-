#!/bin/bash
cd /var/www/zyra/apps/web
export PORT=${PORT:-3020}
export NODE_ENV=${NODE_ENV:-production}
exec node_modules/.bin/next start
