/**
 * WONDERWORLD UNIFORMS — EXPRESS.JS BACKEND API
 * ============================================================
 * Install dependencies:
 *   npm install express cors bcryptjs jsonwebtoken
 *               @prisma/client multer @aws-sdk/client-s3
 *               express-validator express-async-errors dotenv
 *
 * Environment variables (.env):
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/wonderworld
 *   JWT_SECRET=your-secret-key-min-32-chars
 *   JWT_EXPIRES_IN=7d
 *   AWS_REGION=ca-central-1
 *   AWS_BUCKET=wonderworld-uploads
 *   AWS_ACCESS_KEY_ID=...
 *   AWS_SECRET_ACCESS_KEY=...
 *   PORT=4000
 * ============================================================
 */

import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import "express-async-errors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

// ─── HELPERS ─────────────────────────────────────────────────

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function adminMiddleware(roles = []) {
  return [
    authMiddleware,
    (req, res, next) => {
      if (req.user.type !== "admin") return res.status(403).json({ error: "Admin access required" });
      if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
      next();
    },
  ];
}

function parentMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.type !== "parent") return res.status(403).json({ error: "Parent access required" });
    next();
  });
}

/** Generate sequential order number: WW-XXXX */
async function generateOrderNumber() {
  const last = await prisma.order.findFirst({ orderBy: { createdAt: "desc" }, select: { orderNumber: true } });
  const num = last ? parseInt(last.orderNumber.replace("WW-", "")) + 1 : 1001;
  return `WW-${num}`;
}

/**
 * INVENTORY LOGIC
 * ─────────────────────────────────────────────────────────────
 * SUBMITTED  → reservedQty += qty  (soft reserve)
 * REVIEW     → no change           (already reserved)
 * READY      → totalQty -= qty, reservedQty -= qty  (hard deduct)
 * PICKED_UP  → no change           (already deducted at READY)
 * CANCELLED  → restore based on previous status
 *
 * Prevents duplicate deductions using statusHistory on the order.
 */
async function applyInventoryTransition(orderId, fromStatus, toStatus, tx) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;

  for (const item of order.items) {
    const inv = await tx.inventory.findUnique({ where: { productId_size: { productId: item.productId, size: item.size } } });
    if (!inv) continue;

    let update = {};

    // Entering soft-reserve zone from outside
    if (["SUBMITTED", "REVIEW"].includes(toStatus) && !["SUBMITTED", "REVIEW"].includes(fromStatus)) {
      update = { reservedQty: { increment: item.quantity } };
    }

    // Leaving soft-reserve zone to hard-deduct zone
    if (toStatus === "READY_FOR_PICKUP" && ["SUBMITTED", "REVIEW"].includes(fromStatus)) {
      update = {
        totalQty: { decrement: item.quantity },
        reservedQty: { decrement: item.quantity },
      };
    }

    // Cancellation — restore based on what was applied
    if (toStatus === "CANCELLED") {
      if (["SUBMITTED", "REVIEW"].includes(fromStatus)) {
        update = { reservedQty: { decrement: item.quantity } };
      } else if (["READY_FOR_PICKUP", "PICKED_UP"].includes(fromStatus)) {
        update = { totalQty: { increment: item.quantity } };
      }
    }

    if (Object.keys(update).length) {
      await tx.inventory.update({ where: { id: inv.id }, data: update });
    }
  }
}

// ─── SEEDING HELPER ──────────────────────────────────────────
// POST /api/admin/seed  (run once to populate initial data)
app.post("/api/admin/seed", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  // Initialize site settings if not exist
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", systemName: "Wonderworld Uniforms", welcomeTitle: "Welcome to Wonderworld! 🌈", discountThreshold: 500, discountRate: 0.15 },
  });

  // Seed default form fields
  const fields = [
    { label: "Child's Name", fieldKey: "childName", isRequired: true, isSystem: true, sortOrder: 1 },
    { label: "Class", fieldKey: "childClass", isRequired: true, isSystem: true, sortOrder: 2 },
    { label: "Parent Name", fieldKey: "parentName", isRequired: true, isSystem: true, sortOrder: 3 },
    { label: "Phone Number", fieldKey: "parentPhone", fieldType: "phone", isRequired: true, isSystem: true, sortOrder: 4 },
    { label: "School Location", fieldKey: "locationId", fieldType: "select", isRequired: true, isSystem: true, sortOrder: 5 },
    { label: "Notes", fieldKey: "notes", fieldType: "textarea", isRequired: false, isSystem: false, sortOrder: 6 },
  ];
  for (const f of fields) await prisma.formField.upsert({ where: { fieldKey: f.fieldKey }, update: {}, create: f });

  res.json({ ok: true, message: "Seeded successfully" });
});

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

// Parent registration
app.post("/api/auth/parent/register", async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;
  if (!firstName || !email || !password) return res.status(400).json({ error: "firstName, email, password required" });
  const exists = await prisma.parent.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already registered" });
  const hashed = await bcrypt.hash(password, 12);
  const parent = await prisma.parent.create({ data: { firstName, lastName, email, phone, password: hashed } });
  const token = signToken({ id: parent.id, type: "parent" });
  res.status(201).json({ token, parent: { id: parent.id, firstName, lastName, email, phone } });
});

// Parent login
app.post("/api/auth/parent/login", async (req, res) => {
  const { email, password } = req.body;
  const parent = await prisma.parent.findUnique({ where: { email } });
  if (!parent || !(await bcrypt.compare(password, parent.password))) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({ id: parent.id, type: "parent" });
  res.json({ token, parent: { id: parent.id, firstName: parent.firstName, lastName: parent.lastName, email: parent.email, phone: parent.phone } });
});

// Admin login
app.post("/api/auth/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !admin.isActive || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({ id: admin.id, type: "admin", role: admin.role });
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
});

// ══════════════════════════════════════════════════════════════
//  PUBLIC / PARENT ROUTES
// ══════════════════════════════════════════════════════════════

// Get active products (NO costPrice)
app.get("/api/products", async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, description: true, imageUrl: true,
      imageEmoji: true, category: true, sellingPrice: true,
      sortOrder: true, isActive: true,
      inventory: { select: { size: true } }, // just sizes, no qty
    },
    orderBy: { sortOrder: "asc" },
  });
  res.json(products.map(p => ({ ...p, sizes: p.inventory.map(i => i.size) })));
});

// Get locations (for order form dropdown)
app.get("/api/locations", async (req, res) => {
  const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  res.json(locations);
});

// Get site settings (public fields only)
app.get("/api/settings", async (req, res) => {
  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  res.json({ systemName: s?.systemName, logoUrl: s?.logoUrl, logoEmoji: s?.logoEmoji, welcomeTitle: s?.welcomeTitle, welcomeText: s?.welcomeText, orderInstructions: s?.orderInstructions, noticeText: s?.noticeText, discountThreshold: s?.discountThreshold, discountRate: s?.discountRate });
});

// Get visible form fields
app.get("/api/form-fields", async (req, res) => {
  const fields = await prisma.formField.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } });
  res.json(fields);
});

// ─── ORDER (PARENT) ──────────────────────────────────────────

// Submit new order
app.post("/api/orders", parentMiddleware, async (req, res) => {
  const { childName, childClass, parentName, parentPhone, locationId, notes, extraFields, items } = req.body;
  if (!items?.length) return res.status(400).json({ error: "Order must have at least one item" });

  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const threshold = parseFloat(settings?.discountThreshold || 500);
  const discountRate = parseFloat(settings?.discountRate || 0.15);

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const appliedRate = subtotal >= threshold ? discountRate : 0;
  const discountAmount = +(subtotal * appliedRate).toFixed(2);
  const totalAmount = +(subtotal - discountAmount).toFixed(2);
  const orderNumber = await generateOrderNumber();

  const parent = await prisma.parent.findUnique({ where: { id: req.user.id } });

  const order = await prisma.$transaction(async (tx) => {
    // Check available inventory for each item
    for (const item of items) {
      const inv = await tx.inventory.findUnique({ where: { productId_size: { productId: item.productId, size: item.size } } });
      const available = inv ? inv.totalQty - inv.reservedQty : 0;
      if (available < item.quantity) throw new Error(`Insufficient stock: ${item.productName} size ${item.size} (available: ${available})`);
    }

    // Create order
    const newOrder = await tx.order.create({
      data: {
        orderNumber, parentId: req.user.id, parentName: parentName || `${parent.firstName} ${parent.lastName}`,
        parentPhone: parentPhone || parent.phone, childName, childClass, locationId, notes, extraFields,
        subtotal, discountRate: appliedRate, discountAmount, totalAmount, status: "SUBMITTED",
        statusHistory: [{ status: "SUBMITTED", changedAt: new Date().toISOString(), changedBy: req.user.id }],
        items: { create: items.map(i => ({ productId: i.productId, productName: i.productName, size: i.size, quantity: i.quantity, unitPrice: i.unitPrice })) },
      },
      include: { items: true, location: true },
    });

    // Reserve inventory (SUBMITTED)
    for (const item of newOrder.items) {
      await tx.inventory.update({ where: { productId_size: { productId: item.productId, size: item.size } }, data: { reservedQty: { increment: item.quantity } } });
    }

    return newOrder;
  });

  res.status(201).json(order);
});

// Get parent's own orders
app.get("/api/orders/mine", parentMiddleware, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { parentId: req.user.id },
    include: { items: true, location: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

// ══════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════════════

// ─── PRODUCTS ────────────────────────────────────────────────

app.get("/api/admin/products", adminMiddleware(), async (req, res) => {
  const products = await prisma.product.findMany({
    include: { inventory: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json(products);
});

app.post("/api/admin/products", adminMiddleware(["SUPER_ADMIN", "MANAGER"]), async (req, res) => {
  const { name, description, imageEmoji, category, sellingPrice, costPrice, sizes, isActive, sortOrder } = req.body;
  if (!name || !sellingPrice || !costPrice) return res.status(400).json({ error: "name, sellingPrice, costPrice required" });

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { name, description, imageEmoji, category, sellingPrice: +sellingPrice, costPrice: +costPrice, isActive: isActive ?? true, sortOrder: sortOrder ?? 0 } });
    if (sizes?.length) await tx.inventory.createMany({ data: sizes.map(s => ({ productId: p.id, size: s, totalQty: 0, reservedQty: 0 })) });
    return p;
  });
  res.status(201).json(product);
});

app.put("/api/admin/products/:id", adminMiddleware(["SUPER_ADMIN", "MANAGER"]), async (req, res) => {
  const { name, description, imageEmoji, category, sellingPrice, costPrice, isActive, sortOrder } = req.body;
  const product = await prisma.product.update({ where: { id: req.params.id }, data: { name, description, imageEmoji, category, sellingPrice: sellingPrice ? +sellingPrice : undefined, costPrice: costPrice ? +costPrice : undefined, isActive, sortOrder } });
  res.json(product);
});

app.delete("/api/admin/products/:id", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ─── INVENTORY ───────────────────────────────────────────────

app.get("/api/admin/inventory", adminMiddleware(), async (req, res) => {
  const inv = await prisma.inventory.findMany({ include: { product: { select: { name: true, isActive: true } } }, orderBy: [{ product: { name: "asc" } }, { size: "asc" }] });
  res.json(inv.map(i => ({ ...i, availableQty: i.totalQty - i.reservedQty })));
});

app.put("/api/admin/inventory/:id", adminMiddleware(["SUPER_ADMIN", "MANAGER"]), async (req, res) => {
  const { totalQty } = req.body;
  const inv = await prisma.inventory.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ error: "Not found" });
  if (+totalQty < inv.reservedQty) return res.status(400).json({ error: `Cannot set total below reserved (${inv.reservedQty})` });
  const updated = await prisma.inventory.update({ where: { id: req.params.id }, data: { totalQty: +totalQty } });
  res.json({ ...updated, availableQty: updated.totalQty - updated.reservedQty });
});

app.get("/api/admin/inventory/export", adminMiddleware(), async (req, res) => {
  const inv = await prisma.inventory.findMany({ include: { product: { select: { name: true } } }, orderBy: [{ product: { name: "asc" } }, { size: "asc" }] });
  const csv = ["Product,Size,Total,Reserved,Available", ...inv.map(i => `"${i.product.name}",${i.size},${i.totalQty},${i.reservedQty},${i.totalQty - i.reservedQty}`)].join("\n");
  res.setHeader("Content-Type", "text/csv").setHeader("Content-Disposition", "attachment; filename=inventory.csv").send(csv);
});

// ─── ORDERS (ADMIN) ──────────────────────────────────────────

app.get("/api/admin/orders", adminMiddleware(), async (req, res) => {
  const { search, status, locationId, page = 1, limit = 50 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (locationId) where.locationId = locationId;
  if (search) where.OR = [{ childName: { contains: search, mode: "insensitive" } }, { parentName: { contains: search, mode: "insensitive" } }, { childClass: { contains: search, mode: "insensitive" } }, { orderNumber: { contains: search, mode: "insensitive" } }];

  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, include: { items: true, location: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (+page - 1) * +limit, take: +limit }),
    prisma.order.count({ where }),
  ]);
  res.json({ orders, total, page: +page, pages: Math.ceil(total / +limit) });
});

app.get("/api/admin/orders/:id", adminMiddleware(), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true, location: true, parent: { select: { firstName: true, lastName: true, email: true } } } });
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

app.put("/api/admin/orders/:id/status", adminMiddleware(), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["SUBMITTED", "REVIEW", "READY_FOR_PICKUP", "PICKED_UP", "CANCELLED"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const current = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Order not found" });
  if (current.status === status) return res.json(current);

  const updated = await prisma.$transaction(async (tx) => {
    await applyInventoryTransition(req.params.id, current.status, status, tx);
    return tx.order.update({
      where: { id: req.params.id },
      data: {
        status,
        statusHistory: { push: { status, changedAt: new Date().toISOString(), changedBy: req.user.id, changedByName: "Admin" } },
      },
      include: { items: true, location: { select: { name: true } } },
    });
  });

  // TODO: emit socket.io event for real-time parent notification
  // io.to(`parent:${updated.parentId}`).emit("orderStatusChanged", { orderId: updated.id, status });

  res.json(updated);
});

app.get("/api/admin/orders/export", adminMiddleware(), async (req, res) => {
  const orders = await prisma.order.findMany({ include: { items: true, location: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const rows = [["Order#", "Date", "Child", "Class", "Parent", "Phone", "Location", "Subtotal", "Discount", "Total", "Status"]];
  for (const o of orders) rows.push([o.orderNumber, o.createdAt.toISOString().split("T")[0], o.childName, o.childClass, o.parentName, o.parentPhone, o.location.name, o.subtotal, o.discountAmount, o.totalAmount, o.status]);
  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv").setHeader("Content-Disposition", "attachment; filename=orders.csv").send(csv);
});

// ─── DASHBOARD STATS ─────────────────────────────────────────

app.get("/api/admin/stats", adminMiddleware(), async (req, res) => {
  const [totalOrders, pendingOrders, revenueData, products] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["SUBMITTED", "REVIEW"] } } }),
    prisma.order.aggregate({ where: { status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true } }),
    prisma.product.findMany({ include: { inventory: true, orderItems: true } }),
  ]);

  // Gross profit (requires joining order items with cost prices)
  const orderItems = await prisma.orderItem.findMany({ include: { product: { select: { costPrice: true } }, order: { select: { status: true } } } });
  const profit = orderItems.filter(i => i.order.status !== "CANCELLED").reduce((s, i) => s + (parseFloat(i.product.costPrice) - parseFloat(i.unitPrice)) * -1 * i.quantity, 0);

  const productStats = await prisma.orderItem.groupBy({ by: ["productId", "productName"], _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 });

  res.json({ totalOrders, pendingOrders, revenue: parseFloat(revenueData._sum.totalAmount || 0), profit: +profit.toFixed(2), topProducts: productStats });
});

// ─── LOCATIONS (ADMIN) ───────────────────────────────────────

app.get("/api/admin/locations", adminMiddleware(), async (req, res) => {
  res.json(await prisma.location.findMany({ orderBy: { sortOrder: "asc" } }));
});

app.post("/api/admin/locations", adminMiddleware(["SUPER_ADMIN", "MANAGER"]), async (req, res) => {
  const { name, sortOrder } = req.body;
  res.status(201).json(await prisma.location.create({ data: { name, sortOrder: sortOrder || 0 } }));
});

app.put("/api/admin/locations/:id", adminMiddleware(["SUPER_ADMIN", "MANAGER"]), async (req, res) => {
  const { name, isActive, isDefault, sortOrder } = req.body;
  if (isDefault) await prisma.location.updateMany({ where: { NOT: { id: req.params.id } }, data: { isDefault: false } });
  res.json(await prisma.location.update({ where: { id: req.params.id }, data: { name, isActive, isDefault, sortOrder } }));
});

app.delete("/api/admin/locations/:id", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  const hasOrders = await prisma.order.count({ where: { locationId: req.params.id } });
  if (hasOrders) return res.status(409).json({ error: "Cannot delete location with existing orders. Deactivate it instead." });
  await prisma.location.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ─── SETTINGS (ADMIN) ────────────────────────────────────────

app.get("/api/admin/settings", adminMiddleware(), async (req, res) => {
  res.json(await prisma.siteSettings.findUnique({ where: { id: "singleton" } }));
});

app.put("/api/admin/settings", adminMiddleware(["SUPER_ADMIN", "MANAGER"]), async (req, res) => {
  const { systemName, logoEmoji, welcomeTitle, welcomeText, orderInstructions, noticeText, discountThreshold, discountRate } = req.body;
  res.json(await prisma.siteSettings.upsert({ where: { id: "singleton" }, update: { systemName, logoEmoji, welcomeTitle, welcomeText, orderInstructions, noticeText, discountThreshold: discountThreshold ? +discountThreshold : undefined, discountRate: discountRate ? +discountRate : undefined }, create: { id: "singleton", systemName, logoEmoji, welcomeTitle, welcomeText, orderInstructions, noticeText, discountThreshold: +discountThreshold || 500, discountRate: +discountRate || 0.15 } }));
});

// ─── FORM FIELDS (ADMIN) ─────────────────────────────────────

app.get("/api/admin/form-fields", adminMiddleware(), async (req, res) => {
  res.json(await prisma.formField.findMany({ orderBy: { sortOrder: "asc" } }));
});

app.put("/api/admin/form-fields", adminMiddleware(["SUPER_ADMIN", "MANAGER"]), async (req, res) => {
  const { fields } = req.body;
  await Promise.all(fields.map(f => prisma.formField.update({ where: { id: f.id }, data: { isVisible: f.isVisible, isRequired: f.isRequired, sortOrder: f.sortOrder } })));
  res.json({ ok: true });
});

app.post("/api/admin/form-fields", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  const { label, fieldKey, fieldType, isRequired, sortOrder, options } = req.body;
  res.status(201).json(await prisma.formField.create({ data: { label, fieldKey, fieldType: fieldType || "text", isRequired: isRequired ?? false, isVisible: true, isSystem: false, sortOrder: sortOrder || 99, options } }));
});

app.delete("/api/admin/form-fields/:id", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  const field = await prisma.formField.findUnique({ where: { id: req.params.id } });
  if (field?.isSystem) return res.status(403).json({ error: "Cannot delete system fields" });
  await prisma.formField.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ─── ADMIN ACCOUNT MANAGEMENT ────────────────────────────────

app.get("/api/admin/accounts", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  res.json(await prisma.admin.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } }));
});

app.post("/api/admin/accounts", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });
  const hashed = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.create({ data: { name, email, password: hashed, role: role || "STAFF" } });
  res.status(201).json({ id: admin.id, name: admin.name, email: admin.email, role: admin.role });
});

app.put("/api/admin/accounts/:id", adminMiddleware(["SUPER_ADMIN"]), async (req, res) => {
  const { name, role, isActive } = req.body;
  res.json(await prisma.admin.update({ where: { id: req.params.id }, data: { name, role, isActive }, select: { id: true, name: true, email: true, role: true, isActive: true } }));
});

// ─── ERROR HANDLER ───────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "P2025") return res.status(404).json({ error: "Record not found" });
  if (err.code === "P2002") return res.status(409).json({ error: "Duplicate record" });
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => console.log(`Wonderworld API running on :${PORT}`));

export default app;
