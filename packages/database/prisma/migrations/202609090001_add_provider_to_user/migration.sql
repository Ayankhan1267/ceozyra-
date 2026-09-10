-- Add provider field to User model for OAuth provider tracking

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'email' NOT NULL;
