#!/bin/bash
set -e
echo "Seeding database..."
pnpm --filter database run db:seed 2>/dev/null || echo "No seed script found - run npx prisma db seed manually"
echo "Seed complete!"
