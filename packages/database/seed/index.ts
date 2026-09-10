/**
 * ZYRA — Database Seed Data
 * Seeds demo tenant, user, storefront, products, and sample order
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

import { Role } from '@prisma/client';

// ─── Permission Seeding ────────────────────────────────────────

const PERMISSIONS: { role: Role; resource: string; action: string }[] = [];

function addPerm(role: Role, resource: string, action: string) {
  PERMISSIONS.push({ role, resource, action });
}

const allActions = ['read', 'create', 'update', 'delete'] as const;
const allResources = [
  'tenant', 'user', 'storefront', 'product', 'order',
  'customer', 'campaign', 'agent', 'workflow', 'approval', 'finance',
] as const;

// OWNER — everything
for (const r of allResources) for (const a of allActions) addPerm('OWNER', r, a);

// ADMIN — everything except tenant-delete
for (const r of allResources) for (const a of allActions) {
  if (r === 'tenant' && a === 'delete') continue;
  addPerm('ADMIN', r, a);
}

// MANAGER — read/write on most (no delete)
for (const r of allResources) {
  addPerm('MANAGER', r, 'read');
  if (r !== 'tenant') { addPerm('MANAGER', r, 'create'); addPerm('MANAGER', r, 'update'); }
}

// EMPLOYEE — limited read + create on some
const employeeRead = ['storefront', 'product', 'order', 'customer'] as const;
for (const r of employeeRead) addPerm('EMPLOYEE', r, 'read');
addPerm('EMPLOYEE', 'order', 'create');

// MARKETING — campaign + customer read/write
for (const r of ['campaign', 'customer', 'audience', 'creative', 'ad']) addPerm('MARKETING', r, 'read');
for (const r of ['campaign', 'customer', 'audience', 'creative', 'ad']) {
  addPerm('MARKETING', r, 'create');
  addPerm('MARKETING', r, 'update');
}

// FINANCE — order + revenue read/write
for (const r of ['order', 'finance', 'revenue', 'expense', 'invoice']) addPerm('FINANCE', r, 'read');
for (const r of ['order', 'finance', 'revenue', 'expense', 'invoice']) {
  addPerm('FINANCE', r, 'create');
  addPerm('FINANCE', r, 'update');
}

// SUPPORT — customer + order read only
for (const r of ['customer', 'order']) addPerm('SUPPORT', r, 'read');
addPerm('SUPPORT', 'customer', 'update');

// SUPER_ADMIN — everything
for (const r of allResources) for (const a of allActions) addPerm('SUPER_ADMIN', r, a);

async function seedPermissions() {
  console.log('  Seeding permissions...');
  await prisma.permission.createMany({
    data: PERMISSIONS,
    skipDuplicates: true,
  });
  const permCount = await prisma.permission.count();
  console.log(`  ✅ Permissions: ${permCount} seeded`);
}

async function main() {
  console.log('🌱 Seeding ZYRA database...');
  await seedPermissions();

  // Clean existing data (in reverse dependency order)
  console.log('  Cleaning existing data...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.partnerAssignment.deleteMany();
  await prisma.headAssignment.deleteMany();
  await prisma.product.deleteMany();
  await prisma.storefront.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ─── Tenant ────────────────────────────────────────────────
  console.log('  Creating tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Store',
      slug: 'demo',
      status: 'ACTIVE',
      plan: 'STARTER',
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        language: 'en',
      },
    },
  });
  console.log(`  ✅ Tenant: ${tenant.name} (${tenant.slug})`);

  // ─── Owner User ────────────────────────────────────────────
  console.log('  Creating owner user...');
  const owner = await prisma.user.create({
    data: {
      email: 'owner@demo.com',
      password: '$2b$10$i6AvwbfENEWQZDiGtFLym.7rKoEO832xA1eNCHnvqyBc4ICu8eD0e', // bcrypt:testpassword
      firstName: 'Demo',
      lastName: 'Owner',
      role: 'OWNER',
      tenantId: tenant.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`  ✅ Owner: ${owner.email}`);

  // ─── Storefront ────────────────────────────────────────────
  console.log('  Creating storefront...');
  const storefront = await prisma.storefront.create({
    data: {
      name: 'Demo Store',
      slug: 'demo-store',
      subdomain: 'demo',
      tenantId: tenant.id,
      isActive: true,
      theme: {
        primaryColor: '#4F46E5',
        secondaryColor: '#7C3AED',
        font: 'Inter',
      },
      settings: {
        seoTitle: 'Demo Store — Buy Amazing Products',
        seoDescription: 'Your one-stop shop for amazing products',
      },
    },
  });
  console.log(`  ✅ Storefront: ${storefront.name}`);

  // ─── Products ──────────────────────────────────────────────
  console.log('  Creating products...');
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'ZYRA T-Shirt',
        slug: 'zyra-tshirt',
        description: 'Premium cotton t-shirt with ZYRA branding',
        price: 29.99,
        compareAtPrice: 39.99,
        storefrontId: storefront.id,
        category: 'Apparel',
        tags: ['tshirt', 'cotton', 'branded'],
        inventory: 100,
        images: ['https://via.placeholder.com/400x400/4F46E5/ffffff?text=ZYRA+TShirt'],
      },
    }),
    prisma.product.create({
      data: {
        name: 'ZYRA Hoodie',
        slug: 'zyra-hoodie',
        description: 'Comfortable hoodie for tech enthusiasts',
        price: 59.99,
        storefrontId: storefront.id,
        category: 'Apparel',
        tags: ['hoodie', 'warm', 'branded'],
        inventory: 50,
        images: ['https://via.placeholder.com/400x400/7C3AED/ffffff?text=ZYRA+Hoodie'],
      },
    }),
    prisma.product.create({
      data: {
        name: 'ZYRA Mug',
        slug: 'zyra-mug',
        description: 'Ceramic mug for your morning coffee',
        price: 14.99,
        storefrontId: storefront.id,
        category: 'Accessories',
        tags: ['mug', 'ceramic', 'coffee'],
        inventory: 200,
        images: ['https://via.placeholder.com/400x400/6366F1/ffffff?text=ZYRA+Mug'],
      },
    }),
  ]);
  console.log(`  ✅ Created ${products.length} products`);

  // ─── Customer ──────────────────────────────────────────────
  console.log('  Creating customer...');
  const customer = await prisma.customer.create({
    data: {
      email: 'customer@example.com',
      phone: '+1234567890',
      firstName: 'John',
      lastName: 'Doe',
      tenantId: tenant.id,
      metadata: {
        source: 'organic',
        segment: 'vip',
      },
    },
  });
  console.log(`  ✅ Customer: ${customer.email}`);

  // ─── Order ─────────────────────────────────────────────────
  console.log('  Creating sample order...');
  const order = await prisma.order.create({
    data: {
      orderNumber: 'ZYRA-001',
      tenantId: tenant.id,
      storefrontId: storefront.id,
      customerId: customer.id,
      status: 'COMPLETED',
      subtotal: 89.98,
      tax: 7.20,
      discount: 10.00,
      total: 87.18,
      currency: 'USD',
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 1,
            unitPrice: 29.99,
            price: 29.99,
            total: 29.99,
          },
          {
            productId: products[1].id,
            quantity: 1,
            unitPrice: 59.99,
            price: 59.99,
            total: 59.99,
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`  ✅ Order: ${order.orderNumber} (${order.status})`);

  // ─── Commission ────────────────────────────────────────────
  console.log('  Creating commission...');
  const commission = await prisma.commission.create({
    data: {
      tenantId: tenant.id,
      orderId: order.id,
      headUserId: owner.id,
      partnerUserId: owner.id,
      amount: 87.18,
      headShare: 8.72,
      partnerShare: 8.72,
      status: 'PENDING',
    },
  });
  console.log(`  ✅ Commission: $${commission.amount}`);

  // ─── Summary ───────────────────────────────────────────────
  console.log('\n📊 Seed Summary:');
  console.log(`  Tenants:   1`);
  console.log(`  Users:     1 (owner) + 1 (can create more via register)`);
  console.log(`  Storefront: 1`);
  console.log(`  Products:  ${products.length}`);
  console.log(`  Customers: 1`);
  console.log(`  Orders:    1`);
  console.log(`  Commissions: 1`);

  console.log('\n✅ Seed complete!');
  console.log(`\n🔑 Login credentials:`);
  console.log(`   Email: owner@demo.com`);
  console.log(`   Password: testpassword`);
  console.log(`\n⚠️  Change password in production!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
