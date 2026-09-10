#!/bin/bash
cd /var/www/zyra/apps/api
export PORT=${PORT:-4020}
export NODE_ENV=${NODE_ENV:-production}
exec node_modules/.bin/nest start
