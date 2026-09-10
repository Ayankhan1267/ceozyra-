#!/bin/bash
set -e
echo "=== ZYRA Project Setup ==="
echo "Installing dependencies..."
pnpm install
echo "Generating Prisma client..."
pnpm --filter database run db:generate
echo "Running migrations..."
pnpm --filter database run db:push
echo "Building all packages..."
pnpm run build
echo "Setup complete!"
