-- Add Cart and CartItem tables

-- Create carts table
CREATE TABLE IF NOT EXISTS "carts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- Create indexes for carts
CREATE INDEX IF NOT EXISTS "carts_tenantId_idx" ON "carts"("tenantId");
CREATE INDEX IF NOT EXISTS "carts_sessionId_idx" ON "carts"("sessionId");

-- Create cart_items table
CREATE TABLE IF NOT EXISTS "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- Create indexes and unique constraint for cart_items
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cartId_productId_variantId_key" ON "cart_items"("cartId", "productId", "variantId");

-- Add foreign keys
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
