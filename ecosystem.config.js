/**
 * ZYRA — PM2 Ecosystem Config
 */

module.exports = {
  apps: [
    // ─── API (NestJS) ───────────────────────────────────────
    {
      name: 'zyra-api',
      script: 'dist/main.js',
      cwd: '/var/www/zyra/apps/api',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        PORT: '4020',
      },
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/zyra/logs/api-error.log',
      out_file: '/var/www/zyra/logs/api-out.log',
      merge_logs: true,
    },

    // ─── Web (Next.js) ─────────────────────────────────────
    {
      name: 'zyra-web',
      script: '/var/www/zyra/apps/web/node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/zyra/apps/web',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        PORT: '3020',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/zyra/logs/web-error.log',
      out_file: '/var/www/zyra/logs/web-out.log',
      merge_logs: true,
    },

    // ─── Admin (Next.js) ───────────────────────────────────
    {
      name: 'zyra-admin',
      script: '/var/www/zyra/apps/admin/node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/zyra/apps/admin',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        PORT: '3024',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/zyra/logs/admin-error.log',
      out_file: '/var/www/zyra/logs/admin-out.log',
      merge_logs: true,
    },

    // ─── AI Service (FastAPI) ──────────────────────────────
    {
      name: 'zyra-ai',
      script: '/var/www/zyra/apps/ai/.venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8020 --app-dir src --workers 2',
      cwd: '/var/www/zyra/apps/ai',
      env: {
        APP_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/zyra/logs/ai-error.log',
      out_file: '/var/www/zyra/logs/ai-out.log',
      merge_logs: true,
    },
  ],
};
