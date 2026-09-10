#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# ZYRA — Generate Production Secrets
# Outputs cryptographically secure secrets as shell export lines.
# Copy the output into your .env file or pass directly to your
# deployment pipeline.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── JWT Secrets (64 chars from /dev/urandom via openssl) ───────
jwt_secret=$(openssl rand -base64 64 | tr -d '\n')
jwt_refresh_secret=$(openssl rand -base64 64 | tr -d '\n')

# ─── Redis password (32 chars) ─────────────────────────────────
redis_password=$(openssl rand -hex 32 | tr -d '\n')

# ─── Database password (32 chars) ─────────────────────────────
db_password=$(openssl rand -hex 32 | tr -d '\n')

# ─── Email OTP secret (32 chars) ──────────────────────────────
email_otp_secret=$(openssl rand -hex 32 | tr -d '\n')

# ─── AI API encryption key (32 chars) ──────────────────────────
ai_encryption_key=$(openssl rand -hex 32 | tr -d '\n')

echo ""
echo "# ─────────────────────────────────────────────────────────────"
echo "# ZYRA Secrets — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "# Store these securely. DO NOT commit to version control."
echo "# ─────────────────────────────────────────────────────────────"
echo ""
echo "export JWT_SECRET=\"${jwt_secret}\""
echo "export JWT_REFRESH_SECRET=\"${jwt_refresh_secret}\""
echo "export REDIS_PASSWORD=\"${redis_password}\""
echo "export DATABASE_PASSWORD=\"${db_password}\""
echo "export EMAIL_OTP_SECRET=\"${email_otp_secret}\""
echo "export AI_ENCRYPTION_KEY=\"${ai_encryption_key}\""
echo ""
echo "# ─── Redis URL (use the password above) ──────────────────────"
echo "export REDIS_URL=\"redis://:${redis_password}@localhost:6379\""
echo ""
echo "# ─── Database URLs (replace 'localhost' with your DB host) ──"
echo "export DATABASE_URL=\"postgresql://zyra:${db_password}@localhost:5432/zyra_production?schema=public\""
echo "export DATABASE_URL_QA=\"postgresql://zyra:${db_password}@localhost:5432/zyra_qa?schema=public\""
echo "export DATABASE_URL_PROD=\"postgresql://zyra:${db_password}@localhost:5432/zyra_production?schema=public\""
echo ""
