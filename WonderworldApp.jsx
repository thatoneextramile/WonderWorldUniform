/**
 * WONDERWORLD UNIFORM ORDERING SYSTEM
 * Full React App — Single File
 *
 * ============================================================
 * RECOMMENDED TECH STACK
 * ============================================================
 * Frontend:  React 18 + Vite, TailwindCSS (or CSS Modules)
 * Backend:   Node.js + Express (REST API) OR Next.js API routes
 * Database:  PostgreSQL (schema below) + Prisma ORM
 * Auth:      JWT (parents) + bcrypt password hashing
 * Storage:   AWS S3 or Cloudflare R2 for product images / logos
 * Realtime:  Socket.IO or Supabase Realtime for order status sync
 * Export:    exceljs or papaparse for CSV/XLSX generation
 * Deploy:    Vercel (frontend) + Railway or Render (backend + DB)
 *
 * ============================================================
 * POSTGRESQL DATABASE SCHEMA (Prisma SDL)
 * ============================================================
 *
 * model Admin {
 *   id         String   @id @default(cuid())
 *   name       String
 *   email      String   @unique
 *   password   String   // bcrypt hash
 *   role       AdminRole @default(STAFF)  // SUPER_ADMIN | MANAGER | STAFF
 *   isActive   Boolean  @default(true)
 *   createdAt  DateTime @default(now())
 *   updatedAt  DateTime @updatedAt
 * }
 *
 * model Parent {
 *   id        String   @id @default(cuid())
 *   firstName String
 *   lastName  String
 *   email     String   @unique
 *   phone     String
 *   password  String   // bcrypt hash
 *   isActive  Boolean  @default(true)
 *   createdAt DateTime @default(now())
 *   orders    Order[]
 * }
 *
 * model Product {
 *   id            String        @id @default(cuid())
 *   name          String
 *   description   String?
 *   imageUrl      String?
 *   sellingPrice  Decimal       @db.Decimal(10,2)
 *   costPrice     Decimal       @db.Decimal(10,2)  // Admin only
 *   category      String?
 *   isActive      Boolean       @default(true)
 *   createdAt     DateTime      @default(now())
 *   updatedAt     DateTime      @updatedAt
 *   inventory     Inventory[]
 *   orderItems    OrderItem[]
 * }
 *
 * model Inventory {
 *   id           String  @id @default(cuid())
 *   productId    String
 *   size         Size    // T1 | T2 | T3 | T4 | T5
 *   totalQty     Int     @default(0)   // physical stock
 *   reservedQty  Int     @default(0)   // held for Submitted/Review orders
 *   // availableQty = totalQty - reservedQty (computed)
 *   updatedAt    DateTime @updatedAt
 *   product      Product @relation(fields:[productId], references:[id])
 *   @@unique([productId, size])
 * }
 *
 * model Location {
 *   id        String  @id @default(cuid())
 *   name      String
 *   isActive  Boolean @default(true)
 *   isDefault Boolean @default(false)
 *   sortOrder Int     @default(0)
 *   orders    Order[]
 * }
 *
 * model Order {
 *   id              String      @id @default(cuid())
 *   orderNumber     String      @unique  // e.g. WW-2047
 *   parentId        String
 *   parentName      String
 *   parentPhone     String
 *   childName       String
 *   childClass      String
 *   locationId      String
 *   notes           String?
 *   subtotal        Decimal     @db.Decimal(10,2)
 *   discountRate    Decimal     @db.Decimal(5,4)  // 0.15 or 0
 *   discountAmount  Decimal     @db.Decimal(10,2)
 *   totalAmount     Decimal     @db.Decimal(10,2)
 *   status          OrderStatus @default(SUBMITTED)
 *   createdAt       DateTime    @default(now())
 *   updatedAt       DateTime    @updatedAt
 *   parent          Parent      @relation(fields:[parentId], references:[id])
 *   location        Location    @relation(fields:[locationId], references:[id])
 *   items           OrderItem[]
 * }
 *
 * model OrderItem {
 *   id         String  @id @default(cuid())
 *   orderId    String
 *   productId  String
 *   productName String  // snapshot at time of order
 *   size       Size
 *   quantity   Int
 *   unitPrice  Decimal @db.Decimal(10,2)  // snapshot
 *   order      Order   @relation(fields:[orderId], references:[id])
 *   product    Product @relation(fields:[productId], references:[id])
 * }
 *
 * model SiteSettings {
 *   id               String  @id @default("singleton")
 *   systemName       String  @default("Wonderworld Uniforms")
 *   logoUrl          String?
 *   welcomeTitle     String  @default("Welcome to Wonderworld!")
 *   welcomeText      String?
 *   orderInstructions String?
 *   noticeText       String?
 *   discountThreshold Decimal @db.Decimal(10,2) @default(500)
 *   discountRate     Decimal @db.Decimal(5,4)   @default(0.15)
 *   updatedAt        DateTime @updatedAt
 * }
 *
 * model FormField {
 *   id         String  @id @default(cuid())
 *   label      String
 *   fieldKey   String  @unique
 *   fieldType  String  @default("text")  // text | select | textarea
 *   isRequired Boolean @default(true)
 *   isVisible  Boolean @default(true)
 *   sortOrder  Int     @default(0)
 *   isSystem   Boolean @default(false)  // core fields can't be deleted
 * }
 *
 * enum OrderStatus { SUBMITTED REVIEW READY_FOR_PICKUP PICKED_UP CANCELLED }
 * enum Size        { T1 T2 T3 T4 T5 }
 * enum AdminRole   { SUPER_ADMIN MANAGER STAFF }
 *
 * ============================================================
 * INVENTORY LOGIC
 * ============================================================
 * SUBMITTED  → reserve qty  (reservedQty += qty)
 * REVIEW     → keep reserved (no change)
 * READY      → deduct stock  (totalQty -= qty, reservedQty -= qty)
 * PICKED_UP  → no change     (already deducted at READY)
 * CANCELLED  → restore       (reservedQty -= qty OR totalQty += qty if deducted)
 * availableQty = totalQty - reservedQty  (always computed, never stored)
 *
 * ============================================================
 * API ROUTES (Express / Next.js)
 * ============================================================
 * POST /api/auth/parent/register
 * POST /api/auth/parent/login
 * POST /api/auth/admin/login
 *
 * GET  /api/products               (parent: no cost price)
 * GET  /api/products/:id
 * POST /api/admin/products         (admin only)
 * PUT  /api/admin/products/:id
 * DEL  /api/admin/products/:id
 *
 * GET  /api/inventory              (admin only)
 * PUT  /api/admin/inventory/:id
 *
 * POST /api/orders                 (parent)
 * GET  /api/orders/mine            (parent: own orders)
 * GET  /api/admin/orders           (admin: all, with filters)
 * GET  /api/admin/orders/:id
 * PUT  /api/admin/orders/:id/status
 * GET  /api/admin/orders/export    (CSV download)
 *
 * GET  /api/locations
 * POST /api/admin/locations
 * PUT  /api/admin/locations/:id
 * DEL  /api/admin/locations/:id
 *
 * GET  /api/settings
 * PUT  /api/admin/settings
 * GET  /api/admin/form-fields
 * PUT  /api/admin/form-fields
 *
 * GET  /api/admin/stats            (dashboard)
 * GET  /api/admin/inventory/export (CSV)
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useReducer,
} from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ─── API HELPERS ──────────────────────────────────────────────
// Reads JWT from localStorage and attaches it to every request.
async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("ww_token");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// For multipart/form-data (file uploads). Do NOT set Content-Type —
// the browser sets it automatically with the correct boundary.
async function apiUpload(path, formData) {
  const token = localStorage.getItem("ww_token");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// ─── DESIGN TOKENS ────────────────────────────────────────────
// const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Quicksand:wght@500;600;700&display=swap');`;

const FONTS = `
  @font-face {
    font-family: 'DINPro';
    src: url('/fonts/DINPro-Light.woff') format('woff');
    font-weight: 300;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'DINPro';
    src: url('/fonts/DINPro-Bold.woff') format('woff');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
`;

// ─── MOCK DATA ─────────────────────────────────────────────────
const INITIAL_PRODUCTS = [
  {
    id: "p1",
    name: "Polo Shirt",
    description: "Breathable cotton polo in school colours.",
    imageEmoji: "👕",
    imageBg: "#e8f7f0",
    images: [],
    category: "Tops",
    sellingPrice: 45,
    costPrice: 22,
    sizes: ["T1", "T2", "T3", "T4", "T5"],
    isActive: true,
  },
  {
    id: "p2",
    name: "Shorts",
    description: "Comfortable elastic-waist shorts.",
    imageEmoji: "🩳",
    imageBg: "#e6f3fb",
    images: [],
    category: "Bottoms",
    sellingPrice: 38,
    costPrice: 18,
    sizes: ["T1", "T2", "T3", "T4"],
    isActive: true,
  },
  {
    id: "p3",
    name: "Pinafore Dress",
    description: "Classic pinafore, machine washable.",
    imageEmoji: "👗",
    imageBg: "#fef0eb",
    images: [],
    category: "Bottoms",
    sellingPrice: 55,
    costPrice: 28,
    sizes: ["T2", "T3", "T4", "T5"],
    isActive: true,
  },
  {
    id: "p4",
    name: "School Jacket",
    description: "Warm fleece-lined jacket with logo.",
    imageEmoji: "🧥",
    imageBg: "#f0eeff",
    images: [],
    category: "Tops",
    sellingPrice: 78,
    costPrice: 41,
    sizes: ["T3", "T4", "T5"],
    isActive: true,
  },
  {
    id: "p5",
    name: "Socks (3-pack)",
    description: "White ankle socks, pack of 3 pairs.",
    imageEmoji: "🧦",
    imageBg: "#fdfae7",
    images: [],
    category: "Accessories",
    sellingPrice: 18,
    costPrice: 7,
    sizes: ["T1", "T2", "T3"],
    isActive: true,
  },
  {
    id: "p6",
    name: "School Backpack",
    description: "Durable backpack with name tag slot.",
    imageEmoji: "🎒",
    imageBg: "#e6f3fb",
    images: [],
    category: "Accessories",
    sellingPrice: 65,
    costPrice: 32,
    sizes: ["T1", "T2", "T3", "T4", "T5"],
    isActive: true,
  },
];

const INITIAL_INVENTORY = {
  p1: {
    T1: { total: 60, reserved: 5 },
    T2: { total: 55, reserved: 8 },
    T3: { total: 50, reserved: 12 },
    T4: { total: 40, reserved: 8 },
    T5: { total: 30, reserved: 3 },
  },
  p2: {
    T1: { total: 40, reserved: 6 },
    T2: { total: 45, reserved: 10 },
    T3: { total: 35, reserved: 15 },
    T4: { total: 30, reserved: 7 },
  },
  p3: {
    T2: { total: 25, reserved: 4 },
    T3: { total: 30, reserved: 9 },
    T4: { total: 30, reserved: 6 },
    T5: { total: 20, reserved: 2 },
  },
  p4: {
    T3: { total: 20, reserved: 3 },
    T4: { total: 20, reserved: 2 },
    T5: { total: 15, reserved: 1 },
  },
  p5: {
    T1: { total: 80, reserved: 10 },
    T2: { total: 70, reserved: 8 },
    T3: { total: 60, reserved: 5 },
  },
  p6: {
    T1: { total: 30, reserved: 2 },
    T2: { total: 30, reserved: 4 },
    T3: { total: 25, reserved: 3 },
    T4: { total: 20, reserved: 2 },
    T5: { total: 15, reserved: 1 },
  },
};

const INITIAL_LOCATIONS = [
  {
    id: "loc1",
    name: "Main Campus — Vancouver",
    isDefault: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "loc2",
    name: "North Campus — Burnaby",
    isDefault: false,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "loc3",
    name: "West Campus — Richmond",
    isDefault: false,
    isActive: true,
    sortOrder: 3,
  },
];

const INITIAL_ORDERS = [
  {
    id: "o1",
    orderNumber: "WW-2047",
    parentId: "par1",
    parentName: "Sarah Chen",
    parentPhone: "604-555-0100",
    childName: "Emma Chen",
    childClass: "Sunshine K2",
    locationId: "loc1",
    notes: "",
    subtotal: 542,
    discountRate: 0.15,
    discountAmount: 81.3,
    totalAmount: 460.7,
    status: "READY_FOR_PICKUP",
    createdAt: "2026-04-14",
    items: [
      {
        productId: "p1",
        productName: "Polo Shirt",
        size: "T3",
        quantity: 2,
        unitPrice: 45,
      },
      {
        productId: "p2",
        productName: "Shorts",
        size: "T3",
        quantity: 2,
        unitPrice: 38,
      },
      {
        productId: "p3",
        productName: "Pinafore Dress",
        size: "T4",
        quantity: 4,
        unitPrice: 55,
      },
      {
        productId: "p4",
        productName: "School Jacket",
        size: "T4",
        quantity: 2,
        unitPrice: 78,
      },
    ],
  },
  {
    id: "o2",
    orderNumber: "WW-2046",
    parentId: "par2",
    parentName: "James Park",
    parentPhone: "778-555-0211",
    childName: "Liam Park",
    childClass: "Rainbow K1",
    locationId: "loc2",
    notes: "",
    subtotal: 121,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 121,
    status: "SUBMITTED",
    createdAt: "2026-04-13",
    items: [
      {
        productId: "p1",
        productName: "Polo Shirt",
        size: "T2",
        quantity: 2,
        unitPrice: 45,
      },
      {
        productId: "p5",
        productName: "Socks (3-pack)",
        size: "T2",
        quantity: 1,
        unitPrice: 18,
      },
      {
        productId: "p6",
        productName: "School Backpack",
        size: "T2",
        quantity: 1,
        unitPrice: 65,
      },
    ],
  },
  {
    id: "o3",
    orderNumber: "WW-2045",
    parentId: "par3",
    parentName: "Kelly Johnson",
    parentPhone: "604-555-0322",
    childName: "Mia Johnson",
    childClass: "Stars K3",
    locationId: "loc3",
    notes: "",
    subtotal: 382,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 382,
    status: "REVIEW",
    createdAt: "2026-04-10",
    items: [
      {
        productId: "p3",
        productName: "Pinafore Dress",
        size: "T3",
        quantity: 4,
        unitPrice: 55,
      },
      {
        productId: "p4",
        productName: "School Jacket",
        size: "T3",
        quantity: 2,
        unitPrice: 78,
      },
      {
        productId: "p6",
        productName: "School Backpack",
        size: "T3",
        quantity: 1,
        unitPrice: 65,
      },
      {
        productId: "p5",
        productName: "Socks (3-pack)",
        size: "T3",
        quantity: 3,
        unitPrice: 18,
      },
    ],
  },
  {
    id: "o4",
    orderNumber: "WW-2044",
    parentId: "par4",
    parentName: "Anne Williams",
    parentPhone: "604-555-0433",
    childName: "Noah Williams",
    childClass: "Rainbow K1",
    locationId: "loc1",
    notes: "",
    subtotal: 90,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 90,
    status: "PICKED_UP",
    createdAt: "2026-03-28",
    items: [
      {
        productId: "p1",
        productName: "Polo Shirt",
        size: "T4",
        quantity: 2,
        unitPrice: 45,
      },
    ],
  },
  {
    id: "o5",
    orderNumber: "WW-2031",
    parentId: "par1",
    parentName: "Sarah Chen",
    parentPhone: "604-555-0100",
    childName: "Emma Chen",
    childClass: "Sunshine K2",
    locationId: "loc1",
    notes: "",
    subtotal: 101,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 101,
    status: "PICKED_UP",
    createdAt: "2026-03-28",
    items: [
      {
        productId: "p5",
        productName: "Socks (3-pack)",
        size: "T3",
        quantity: 2,
        unitPrice: 18,
      },
      {
        productId: "p6",
        productName: "School Backpack",
        size: "T3",
        quantity: 1,
        unitPrice: 65,
      },
    ],
  },
];

const INITIAL_SETTINGS = {
  systemName: "Wonderworld Uniforms",
  welcomeTitle: "Welcome to Wonderworld! 🌈",
  welcomeText:
    "Browse and order your child's school uniforms easily online. Orders are processed within 2–3 business days.",
  orderInstructions:
    "Please fill in all required fields accurately. Our team will review your order and update the status shortly.",
  noticeText: "Orders of $500 or more receive an automatic 15% discount!",
  discountThreshold: 500,
  discountRate: 0.15,
  logoEmoji: "🎒",
};

const INITIAL_FORM_FIELDS = [
  {
    id: "ff1",
    label: "Child's Name",
    fieldKey: "childName",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: "ff2",
    label: "Class",
    fieldKey: "childClass",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 2,
  },
  {
    id: "ff3",
    label: "Parent Name",
    fieldKey: "parentName",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 3,
  },
  {
    id: "ff4",
    label: "Phone Number",
    fieldKey: "parentPhone",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 4,
  },
  {
    id: "ff5",
    label: "School Location",
    fieldKey: "locationId",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 5,
  },
  {
    id: "ff6",
    label: "Notes / Special Requests",
    fieldKey: "notes",
    isRequired: false,
    isVisible: true,
    isSystem: false,
    sortOrder: 6,
  },
  {
    id: "ff7",
    label: "Teacher's Name",
    fieldKey: "teacherName",
    isRequired: false,
    isVisible: false,
    isSystem: false,
    sortOrder: 7,
  },
];

const PARENT_USER = {
  id: "par1",
  firstName: "Sarah",
  lastName: "Chen",
  email: "sarah@example.com",
  phone: "604-555-0100",
};
const ADMIN_USER = {
  id: "adm1",
  name: "Principal Wang",
  email: "wang@wonderworld.edu",
  role: "SUPER_ADMIN",
};

const STATUS_LABELS = {
  SUBMITTED: "Submitted",
  REVIEW: "Review",
  READY_FOR_PICKUP: "Ready for Pick Up",
  PICKED_UP: "Picked Up",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};
const STATUS_COLORS = {
  SUBMITTED: "#d5e9e4:#1a5c47",
  REVIEW: "#fdf8ec:#8a6a10",
  READY_FOR_PICKUP: "#d6ede5:#1e6e4a",
  PICKED_UP: "#d6edda:#1a5c1a",
  PAID: "#ece8f5:#4a35a0",
  CANCELLED: "#fdf0e6:#c45e18",
};

// ─── CONTEXT ──────────────────────────────────────────────────
const AppCtx = createContext(null);
function useApp() {
  return useContext(AppCtx);
}

// ─── GLOBAL STYLES ────────────────────────────────────────────
const GLOBAL_CSS = `
${FONTS}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --mint:#e8f7f0; --mint-mid:#3db882; --mint-dark:#1a7a55;
  --sky-bg:#fdf0e6;      --sky-mid-bg:#e8833a;   --sky-dark-bg:#CC6D1A ;
   --sky-bg:#fdf0e6;      --sky-mid-bg:#e8833a;   --ww-bg:#FF9E3E ;
   --sky:#e6f3fb;  --sky-mid:#4da8da;  --sky-dark:#1a5f8a;
  --peach:#fef0eb;--peach-mid:#f5845a;--peach-dark:#a83d1e;
  --lemon:#fdfae7;--lemon-mid:#e8c83a;--lemon-dark:#8a6e0a;
  --purple:#f0eeff;--purple-mid:#8b72e8;--purple-dark:#4a2db5;
  --bg:#ffffff; --bg2:#f7f8fa; --bg3:#eef0f4;
  --border:#e2e5ea; --border2:#c8cdd6;
  --text:#1a1d23; --text2:#5a6072; --text3:#9198a8;
  --radius:12px; --radius-sm:8px; --radius-xs:5px;
  --shadow:0 2px 8px rgba(0,0,0,.07);
  --shadow-lg:0 8px 24px rgba(0,0,0,.10);
  --font-display:'DINPro',Georgia,sans-serif;
  --font-body:'DINPro',system-ui,sans-serif;
}
body { font-family:var(--font-body); color:var(--text); background:var(--bg2); min-height:100vh; }
button { cursor:pointer; font-family:var(--font-body); }
input,select,textarea { font-family:var(--font-body); }
::-webkit-scrollbar { width:5px; height:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:10px; }
@keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
@keyframes popIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
.animate-fade { animation:fadeIn .25s ease both; }
.animate-slide { animation:slideIn .2s ease both; }
.animate-pop  { animation:popIn .2s ease both; }

/* ── Typography scale — edit here to resize the whole app ── */
body          { font-size:15px; }
.txt-xs       { font-size:11px; }
.txt-sm       { font-size:13px; }
.txt-base     { font-size:15px; }
.txt-lg       { font-size:17px; }
.txt-xl       { font-size:20px; }
.txt-2xl      { font-size:24px; }
.txt-label    { font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--text2); }
.txt-muted    { font-size:12px; color:var(--text3); }
.txt-price    { font-size:14px; font-weight:800; color:var(--sky-dark); }
.txt-section  { font-family:var(--font-display); font-size:17px; font-weight:700; color:var(--text); }
.txt-stat-val { font-family:var(--font-display); font-size:22px; font-weight:900; }
.txt-stat-lbl { font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--text3); }
.txt-badge    { font-size:10px; font-weight:800; white-space:nowrap; }
.txt-th       { font-size:10px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--text3); }
.txt-card-h3  { font-size:14px; font-weight:700; }
`;

// ─── SHARED COMPONENTS ────────────────────────────────────────
function Btn({
  children,
  variant = "primary",
  size = "md",
  onClick,
  style = {},
  disabled = false,
  fullWidth = false,
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "var(--radius-sm)",
    transition: "all .15s",
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? "100%" : "auto",
  };
  const sizes = {
    sm: { padding: "5px 12px", fontSize: 11 },
    md: { padding: "9px 18px", fontSize: 13 },
    lg: { padding: "12px 24px", fontSize: 15 },
  };
  const variants = {
    primary: { background: "var(--sky-dark)", color: "#fff" },
    admin: { background: "var(--sky-mid-bg)", color: "#fff" },
    danger: { background: "var(--peach-dark)", color: "#fff" },
    ghost: {
      background: "transparent",
      color: "var(--text2)",
      border: "1px solid var(--border)",
    },
    soft: { background: "var(--sky)", color: "var(--sky-dark)" },
    softBlue: { background: "var(--sky)", color: "var(--sky-dark)" },
    softRed: { background: "var(--peach)", color: "var(--peach-dark)" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  options = null,
  rows = 2,
  style = {},
}) {
  const field = options ? (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        background: "var(--bg)",
        color: "var(--text)",
        outline: "none",
      }}
    >
      <option value="">— Select —</option>
      {options.map((o) => (
        <option key={o.value || o} value={o.value || o}>
          {o.label || o}
        </option>
      ))}
    </select>
  ) : type === "textarea" ? (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        resize: "vertical",
        background: "var(--bg)",
        color: "var(--text)",
        outline: "none",
      }}
    />
  ) : (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        background: "var(--bg)",
        color: "var(--text)",
        outline: "none",
      }}
    />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && (
        <label className="txt-label">
          {label}
          {required && <span style={{ color: "var(--peach-dark)" }}> *</span>}
        </label>
      )}
      {field}
    </div>
  );
}

function Badge({ status }) {
  const [bg, col] = (STATUS_COLORS[status] || "#eef0f4:#5a6072").split(":");
  return (
    <span
      className="txt-badge"
      style={{
        background: bg,
        color: col,
        padding: "3px 10px",
        borderRadius: 30,
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        boxShadow: "var(--shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Modal({ children, onClose, title, width = 480 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="animate-pop"
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius)",
          padding: 24,
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflowY: "auto",
          margin: "16px 0", // ← add this
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2 className="txt-section">{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--text3)",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label
      style={{
        position: "relative",
        display: "inline-block",
        width: 38,
        height: 20,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          position: "absolute",
          cursor: "pointer",
          inset: 0,
          background: checked ? "#2a7a4e" : "var(--border2)",
          borderRadius: 10,
          transition: ".3s",
        }}
      >
        <span
          style={{
            position: "absolute",
            content: "''",
            width: 16,
            height: 16,
            left: 2,
            top: 2,
            background: "#fff",
            borderRadius: "50%",
            transition: ".3s",
            transform: checked ? "translateX(18px)" : "none",
          }}
        />
      </span>
    </label>
  );
}

function StatCard({ label, value, sub, color = "var(--sky-dark)" }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="txt-stat-lbl" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className="txt-stat-val" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="txt-muted" style={{ marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <h2 className="txt-section">{children}</h2>
      {action}
    </div>
  );
}

function EmptyState({ emoji, message }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px",
        color: "var(--text3)",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
      <div className="txt-sm" style={{ fontWeight: 600 }}>
        {message}
      </div>
    </div>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="animate-fade txt-sm"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "var(--sky-dark-bg)",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "var(--radius-sm)",
        fontWeight: 700,
        boxShadow: "var(--shadow-lg)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      ✅ {message}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,.7)",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── APP STATE REDUCER ────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case "SET_VIEW":
      return {
        ...state,
        view: action.view,
        adminPage: action.adminPage || state.adminPage,
        parentPage: action.parentPage || state.parentPage,
      };
    case "SET_PARENT_PAGE":
      return { ...state, parentPage: action.page };
    case "SET_ADMIN_PAGE":
      return { ...state, adminPage: action.page };
    case "LOGIN":
      // Persist user so page refresh can restore the session
      try {
        localStorage.setItem("ww_user", JSON.stringify(action.user));
      } catch {}
      return {
        ...state,
        currentUser: action.user,
        userRole: action.role,
        parentPage: action.role === "admin" ? state.parentPage : "home",
      };
    case "LOGOUT":
      localStorage.removeItem("ww_token");
      localStorage.removeItem("ww_role");
      return {
        ...state,
        currentUser: null,
        userRole: null,
        parentPage: "login",
        adminPage: "dashboard",
        cart: [],
        orders: [],
      };
    case "ADD_TO_CART": {
      const existing = state.cart.findIndex(
        (i) =>
          i.productId === action.item.productId && i.size === action.item.size,
      );
      if (existing >= 0) {
        const cart = [...state.cart];
        cart[existing] = {
          ...cart[existing],
          quantity: cart[existing].quantity + action.item.quantity,
        };
        return { ...state, cart };
      }
      return { ...state, cart: [...state.cart, action.item] };
    }
    case "REMOVE_FROM_CART":
      return {
        ...state,
        cart: state.cart.filter((_, i) => i !== action.index),
      };
    case "UPDATE_CART_QTY": {
      const cart = [...state.cart];
      cart[action.index] = { ...cart[action.index], quantity: action.qty };
      return { ...state, cart };
    }
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "ADD_ORDER":
      return { ...state, orders: [action.order, ...state.orders] };
    case "UPDATE_ORDER_STATUS":
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.id
            ? {
                ...o,
                status: action.status,
                updatedAt: new Date().toISOString(),
              }
            : o,
        ),
      };
    case "ADD_PRODUCT":
      return { ...state, products: [...state.products, action.product] };
    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.product.id ? action.product : p,
        ),
      };
    case "DELETE_PRODUCT":
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.id),
      };
    case "UPDATE_INVENTORY":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.productId]: {
            ...state.inventory[action.productId],
            [action.size]: action.inv,
          },
        },
      };
    case "ADD_LOCATION":
      return { ...state, locations: [...state.locations, action.location] };
    case "UPDATE_LOCATION":
      return {
        ...state,
        locations: state.locations.map((l) =>
          l.id === action.location.id ? action.location : l,
        ),
      };
    case "DELETE_LOCATION":
      return {
        ...state,
        locations: state.locations.filter((l) => l.id !== action.id),
      };
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case "UPDATE_FORM_FIELDS":
      return { ...state, formFields: action.fields };
    case "SET_TOAST":
      return { ...state, toast: action.message };
    case "CLEAR_TOAST":
      return { ...state, toast: null };
    case "SET_PRODUCT_DETAIL":
      return { ...state, productDetail: action.product };
    case "SET_INITIAL_DATA": {
      try {
        const { products, locations, settings, formFields } = action.payload;
        return {
          ...state,
          ...(Array.isArray(products) ? { products } : {}),
          ...(Array.isArray(locations) ? { locations } : {}),
          ...(settings ? { settings } : {}),
          // ...(Array.isArray(formFields) ? { formFields } : {}),
        };
      } catch (e) {
        return state;
      }
    }
    case "SET_ORDERS":
      return { ...state, orders: action.orders };
    case "SET_ADMIN_DATA":
      return {
        ...state,
        ...(action.orders ? { orders: action.orders } : {}),
        ...(action.inventory ? { inventory: action.inventory } : {}),
        ...(action.products ? { products: action.products } : {}),
      };

    default:
      return state;
  }
}

const INITIAL_STATE = {
  view: "parent",
  parentPage: "login",
  adminPage: "dashboard",
  currentUser: null,
  userRole: null,
  cart: [],
  products: INITIAL_PRODUCTS,
  inventory: INITIAL_INVENTORY,
  orders: [],
  locations: INITIAL_LOCATIONS,
  settings: INITIAL_SETTINGS,
  formFields: INITIAL_FORM_FIELDS,
  toast: null,
  productDetail: null,
};

// ══════════════════════════════════════════════════════════════
//  PARENT SCREENS
// ══════════════════════════════════════════════════════════════

function ParentLogin() {
  const { dispatch, state } = useApp();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [isReg, setIsReg] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loginLoading, setLoginLoading] = useState(false);

  async function handleLogin() {
    if (!email || !pass) {
      dispatch({
        type: "SET_TOAST",
        message: "Please fill in email and password",
      });
      return;
    }
    setLoginLoading(true);
    try {
      const data = await api("/api/auth/parent/login", {
        method: "POST",
        body: { email, password: pass },
      });
      localStorage.setItem("ww_token", data.token);
      localStorage.setItem("ww_role", "parent");
      dispatch({ type: "LOGIN", user: data.parent, role: "parent" });
      dispatch({ type: "SET_PARENT_PAGE", page: "home" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Login failed. Check your email and password.",
      });
    } finally {
      setLoginLoading(false);
    }
  }
  async function handleRegister() {
    if (!form.firstName || !form.email || !form.password) {
      dispatch({
        type: "SET_TOAST",
        message: "Please fill in all required fields",
      });
      return;
    }
    setLoginLoading(true);
    try {
      const data = await api("/api/auth/parent/register", {
        method: "POST",
        body: form,
      });
      localStorage.setItem("ww_token", data.token);
      localStorage.setItem("ww_role", "parent");
      dispatch({ type: "LOGIN", user: data.parent, role: "parent" });
      dispatch({ type: "SET_PARENT_PAGE", page: "home" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message:
          err.message || "Registration failed. Email may already be in use.",
      });
    } finally {
      setLoginLoading(false);
    }
  }
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,var(--mint) 0%,var(--sky) 100%)",
        padding: 16,
      }}
    >
      <div
        className="animate-pop"
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius)",
          padding: 32,
          width: "100%",
          maxWidth: 380,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 60,
              height: 60,
              //borderRadius: "95%",
              // background: "var(--ww-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 12px",
              overflow: "hidden",
            }}
          >
            {/* {state.settings.logoEmoji} */}
            {state.settings.logoUrl ? (
              <img
                src={state.settings.logoUrl}
                alt="Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              state.settings.logoEmoji
            )}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              color: "var(--mint-dark)",
            }}
          >
            {state.settings.systemName}
          </h1>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
            {isReg ? "Create your parent account" : "Parent Portal"}
          </p>
        </div>
        {!isReg ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="parent@email.com"
              required
            />
            <Input
              label="Password"
              value={pass}
              onChange={setPass}
              type="password"
              placeholder="••••••••"
              required
            />
            <Btn
              onClick={handleLogin}
              fullWidth
              size="lg"
              disabled={loginLoading}
              style={{ marginTop: 4 }}
              variant="admin"
            >
              {loginLoading ? "Logging in…" : "Log In"}
            </Btn>
            <p
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--text3)",
              }}
            >
              New to Wonderworld?{" "}
              <button
                onClick={() => setIsReg(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--sky-dark-bg)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Register here
              </button>
            </p>
            <div
              style={{ borderTop: "1px dashed var(--border)", paddingTop: 12 }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text3)",
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Admin?{" "}
                <button
                  onClick={() => dispatch({ type: "SET_VIEW", view: "admin" })}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--sky-dark-bg)",
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Go to Admin Login →
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <Input
                label="First Name"
                value={form.firstName}
                onChange={(v) => setForm({ ...form, firstName: v })}
                required
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChange={(v) => setForm({ ...form, lastName: v })}
              />
            </div>
            <Input
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              type="email"
              placeholder="email@example.com"
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="123-456-7890"
            />
            <Input
              label="Password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              type="password"
              placeholder="Create a password"
              required
            />
            <Btn
              onClick={handleRegister}
              fullWidth
              size="lg"
              disabled={loginLoading}
              style={{ marginTop: 4 }}
            >
              {loginLoading ? "Creating account…" : "Create Account"}
            </Btn>
            <p
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--text3)",
              }}
            >
              Already registered?{" "}
              <button
                onClick={() => setIsReg(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--sky-dark-bg)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Log in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PRODUCT IMAGE GALLERY (shared parent/admin) ──────────────
// Shows a scrollable carousel if images[] exist, else shows emoji fallback.
function ProductImageGallery({
  images = [],
  imageEmoji = "👕",
  imageBg = "#e8f7f0",
  height = 180,
  showThumbs = true,
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const hasImages = images && images.length > 0;

  function prev(e) {
    e.stopPropagation();
    setActiveIdx((i) => (i - 1 + images.length) % images.length);
  }
  function next(e) {
    e.stopPropagation();
    setActiveIdx((i) => (i + 1) % images.length);
  }

  // touch/swipe support
  const touchStart = useState(null);
  function onTouchStart(e) {
    touchStart[1](e.touches[0].clientX);
  }
  function onTouchEnd(e) {
    if (touchStart[0] === null) return;
    const dx = e.changedTouches[0].clientX - touchStart[0];
    if (Math.abs(dx) > 40) dx < 0 ? next(e) : prev(e);
    touchStart[1](null);
  }

  if (!hasImages) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.35,
          background: imageBg,
          borderRadius: "var(--radius-sm)",
          flexShrink: 0,
        }}
      >
        {imageEmoji}
      </div>
    );
  }

  return (
    <div style={{ userSelect: "none" }}>
      {/* Main image */}
      <div
        style={{
          position: "relative",
          height,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          background: "#f0f0f0",
          cursor: images.length > 1 ? "grab" : "default",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[activeIdx]}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            transition: "opacity .2s",
          }}
        />
        {/* Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              style={{
                position: "absolute",
                left: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(0,0,0,.45)",
                border: "none",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
              }}
            >
              ‹
            </button>
            <button
              onClick={next}
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(0,0,0,.45)",
                border: "none",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
              }}
            >
              ›
            </button>
            {/* Dot indicators */}
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: 5,
              }}
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIdx(i);
                  }}
                  style={{
                    width: i === activeIdx ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    background:
                      i === activeIdx ? "#fff" : "rgba(255,255,255,.55)",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "all .2s",
                  }}
                />
              ))}
            </div>
          </>
        )}
        {/* Counter pill */}
        {images.length > 1 && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0,0,0,.5)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 30,
            }}
          >
            {activeIdx + 1}/{images.length}
          </div>
        )}
      </div>
      {/* Thumbnails */}
      {showThumbs && images.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIdx(i);
              }}
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 6,
                overflow: "hidden",
                border: `2px solid ${i === activeIdx ? "var(--sky-dark-bg)" : "transparent"}`,
                background: "none",
                padding: 0,
                cursor: "pointer",
                transition: "border-color .15s",
              }}
            >
              <img
                src={src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── IMAGE UPLOADER (admin only) ─────────────────────────────
// Converts selected files to base64 data URIs for preview and storage.
// In production, swap the base64 logic for a presigned S3 upload.
// ImageUploader — two layers of state:
//   existingUrls  : string[]   — already-saved server URLs (can be reordered/deleted)
//   pendingFiles  : File[]     — newly picked files not yet uploaded
// The parent receives both via onChange(urls) and onNewFiles(files).
function ImageUploader({ images = [], onChange, onNewFiles }) {
  // Local preview URLs for File objects (revoked on unmount)
  const [previews, setPreviews] = useState([]); // { url, file }[]

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  function handleFiles(files) {
    const newPreviews = Array.from(files).map((file) => ({
      url: URL.createObjectURL(file),
      file,
    }));
    const updated = [...previews, ...newPreviews];
    setPreviews(updated);
    if (onNewFiles) onNewFiles(updated.map((p) => p.file));
  }

  // Remove from existing saved URLs
  function removeExisting(idx) {
    onChange(images.filter((_, i) => i !== idx));
  }

  // Remove from pending (not-yet-uploaded) previews
  function removePending(idx) {
    URL.revokeObjectURL(previews[idx].url);
    const updated = previews.filter((_, i) => i !== idx);
    setPreviews(updated);
    if (onNewFiles) onNewFiles(updated.map((p) => p.file));
  }

  function moveLeft(idx) {
    if (idx === 0) return;
    const next = [...images];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveRight(idx) {
    if (idx === images.length - 1) return;
    const next = [...images];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  const allThumbs = [
    ...images.map((src, i) => ({ src, type: "existing", idx: i })),
    ...previews.map((p, i) => ({ src: p.url, type: "pending", idx: i })),
  ];

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text2)",
          marginBottom: 6,
        }}
      >
        Product Photos{" "}
        <span style={{ fontWeight: 400, color: "var(--text3)" }}>
          (first photo = cover · reorder saved photos with ‹ ›)
        </span>
      </div>
      {allThumbs.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          {allThumbs.map(({ src, type, idx }, i) => (
            <div
              key={`${type}-${idx}`}
              style={{
                position: "relative",
                width: 72,
                height: 72,
                borderRadius: 8,
                overflow: "hidden",
                border: `2px solid ${i === 0 ? "var(--sky-dark-bg)" : type === "pending" ? "var(--sky-mid)" : "var(--border)"}`,
              }}
            >
              <img
                src={src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              {i === 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(30,110,74,.9)",
                    color: "#fff",
                    fontSize: 8,
                    fontWeight: 800,
                    textAlign: "center",
                    padding: "2px 0",
                  }}
                >
                  COVER
                </div>
              )}
              {type === "pending" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(77,168,218,.85)",
                    color: "#fff",
                    fontSize: 7,
                    fontWeight: 800,
                    textAlign: "center",
                    padding: "2px 0",
                  }}
                >
                  NEW
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  top: type === "pending" ? 14 : 2,
                  right: 2,
                  display: "flex",
                  gap: 2,
                }}
              >
                {type === "existing" && idx > 0 && (
                  <button
                    onClick={() => moveLeft(idx)}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      background: "rgba(0,0,0,.6)",
                      border: "none",
                      color: "#fff",
                      fontSize: 9,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ‹
                  </button>
                )}
                {type === "existing" && idx < images.length - 1 && (
                  <button
                    onClick={() => moveRight(idx)}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      background: "rgba(0,0,0,.6)",
                      border: "none",
                      color: "#fff",
                      fontSize: 9,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ›
                  </button>
                )}
                <button
                  onClick={() =>
                    type === "existing"
                      ? removeExisting(idx)
                      : removePending(idx)
                  }
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    background: "rgba(180,0,0,.75)",
                    border: "none",
                    color: "#fff",
                    fontSize: 10,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: "14px 10px",
          border: "2px dashed var(--border)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          background: "var(--bg2)",
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <span style={{ fontSize: 22 }}>📷</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}>
          Click or drag photos here
        </span>
        <span style={{ fontSize: 10, color: "var(--text3)" }}>
          JPG, PNG, WebP · up to 10 files · 8 MB each
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
    </div>
  );
}

function ParentHome() {
  const { state, dispatch } = useApp();
  const [cat, setCat] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addSize, setAddSize] = useState("");
  const [addQty, setAddQty] = useState(1);
  const cats = ["All", "Tops", "Bottoms", "Accessories"];

  // Products come from initAppData via SET_INITIAL_DATA.
  // Show a loading message until at least one product arrives.
  const productsLoaded = state.products.length > 0;
  const filtered = state.products.filter(
    (p) => p.isActive && (cat === "All" || p.category === cat),
  );

  function handleAddToCart() {
    if (!addSize) {
      dispatch({ type: "SET_TOAST", message: "Please select a size" });
      return;
    }
    dispatch({
      type: "ADD_TO_CART",
      item: {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        size: addSize,
        quantity: addQty,
        unitPrice: selectedProduct.sellingPrice,
        imageEmoji: selectedProduct.imageEmoji,
        imageBg: selectedProduct.imageBg,
        images: selectedProduct.images || [],
      },
    });
    dispatch({
      type: "SET_TOAST",
      message: `${selectedProduct.name} (${addSize}) added to cart!`,
    });
    setSelectedProduct(null);
    setAddSize("");
    setAddQty(1);
  }

  if (!productsLoaded)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "var(--text3)",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>🎒</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Loading uniforms…</div>
      </div>
    );

  return (
    <div className="animate-fade">
      {/* Hero */}
      <div
        style={{
          background:
            "linear-gradient(150deg,#c8e6d8 0%,#d6ede5 40%,#fdf8ec 100%)",
          borderRadius: "var(--radius)",
          padding: "20px 22px",
          marginBottom: 16,
          border: "1px solid rgba(61,184,130,.25)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--sky-dark-bg)",
            marginBottom: 4,
          }}
        >
          {state.settings.welcomeTitle}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,.88)",
            lineHeight: 1.5,
          }}
        >
          {state.settings.welcomeText}
        </p>
        {state.settings.noticeText && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--sky-dark-bg)",
              color: "#fff",
              padding: "5px 14px",
              borderRadius: 30,
              fontSize: 11,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            🎉 {state.settings.noticeText}
          </div>
        )}
      </div>
      {/* Categories */}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}
      >
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              padding: "6px 14px",
              borderRadius: 30,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              border: "1.5px solid",
              borderColor: cat === c ? "var(--sky-dark-bg)" : "var(--border)",
              background: cat === c ? "var(--sky-dark-bg)" : "var(--bg)",
              color: cat === c ? "#fff" : "var(--text2)",
              transition: "all .15s",
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
          gap: 12,
        }}
      >
        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => {
              setSelectedProduct(p);
              setAddSize("");
              setAddQty(1);
            }}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              cursor: "pointer",
              transition: "all .2s",
              boxShadow: "var(--shadow)",
            }}
          >
            <div
              style={{
                height: 100,
                overflow: "hidden",
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                flexShrink: 0,
              }}
            >
              <ProductImageGallery
                images={p.images}
                imageEmoji={p.imageEmoji}
                imageBg={p.imageBg}
                height={100}
                showThumbs={false}
              />
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                {p.name}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--sky-dark)",
                  fontWeight: 800,
                }}
              >
                ${p.sellingPrice.toFixed(2)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {p.sizes.map((s) => (
                  <span
                    key={s}
                    style={{
                      background: "var(--bg2)",
                      border: "0.5px solid var(--border)",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 5px",
                      color: "var(--text3)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <EmptyState emoji="👕" message="No products in this category" />
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Modal
          title={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        >
          <div style={{ marginBottom: 14 }}>
            <ProductImageGallery
              images={selectedProduct.images}
              imageEmoji={selectedProduct.imageEmoji}
              imageBg={selectedProduct.imageBg}
              height={200}
              showThumbs={true}
            />
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text2)",
              marginBottom: 14,
              lineHeight: 1.6,
            }}
          >
            {selectedProduct.description}
          </p>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "var(--sky-dark)",
              fontFamily: "var(--font-display)",
              marginBottom: 14,
            }}
          >
            ${selectedProduct.sellingPrice.toFixed(2)}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            {selectedProduct.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setAddSize(s)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "2px solid",
                  borderColor:
                    addSize === s ? "var(--sky-dark)" : "var(--border)",
                  background: addSize === s ? "var(--sky)" : "var(--bg)",
                  color: addSize === s ? "var(--sky-dark)" : "var(--text2)",
                  transition: "all .15s",
                }}
              >
                {s}{" "}
                <span style={{ fontSize: 10, opacity: 0.7 }}>
                  Age {s.replace("T", "")}
                </span>
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span
              style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}
            >
              Quantity:
            </span>
            <button
              onClick={() => setAddQty(Math.max(1, addQty - 1))}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              −
            </button>
            <span
              style={{
                fontWeight: 800,
                fontSize: 16,
                minWidth: 24,
                textAlign: "center",
              }}
            >
              {addQty}
            </span>
            <button
              onClick={() => setAddQty(addQty + 1)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              +
            </button>
            <span
              style={{
                marginLeft: "auto",
                fontWeight: 800,
                fontSize: 16,
                color: "var(--sky-dark)",
              }}
            >
              ${(selectedProduct.sellingPrice * addQty).toFixed(2)}
            </span>
          </div>
          <Btn onClick={handleAddToCart} fullWidth size="lg">
            Add to Cart 🛒
          </Btn>
        </Modal>
      )}
    </div>
  );
}

function ParentCart() {
  const { state, dispatch } = useApp();
  const { cart, locations, settings, formFields } = state;
  const [form, setForm] = useState({
    childName: "",
    childClass: "",
    parentName:
      state.currentUser?.firstName + " " + state.currentUser?.lastName || "",
    parentPhone: state.currentUser?.phone || "",
    locationId: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const threshold = settings.discountThreshold;
  const discountRate = subtotal >= threshold ? settings.discountRate : 0;
  const discountAmount = subtotal * discountRate;
  const total = subtotal - discountAmount;

  const visibleFields = formFields.filter((f) => f.isVisible);

  async function handleSubmit() {
    if (submitting) return;
    const required = visibleFields.filter((f) => f.isRequired);
    for (const f of required) {
      if (!form[f.fieldKey]) {
        dispatch({ type: "SET_TOAST", message: `Please fill in: ${f.label}` });
        return;
      }
    }
    if (cart.length === 0) {
      dispatch({ type: "SET_TOAST", message: "Your cart is empty" });
      return;
    }
    setSubmitting(true);
    try {
      const newOrder = await api("/api/orders", {
        method: "POST",
        body: {
          ...form,
          items: cart.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            size: i.size,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      });
      dispatch({ type: "ADD_ORDER", order: newOrder });
      dispatch({ type: "CLEAR_CART" });
      dispatch({ type: "SET_TOAST", message: "Order submitted successfully!" });
      setSubmitted(true);
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to submit order. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted)
    return (
      <div
        className="animate-fade"
        style={{ textAlign: "center", padding: "60px 20px" }}
      >
        <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 22,
            color: "var(--sky-dark)",
            marginBottom: 8,
          }}
        >
          Order Submitted!
        </h2>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 24 }}>
          Your order has been received. We'll update you when it's ready.
        </p>
        <Btn
          onClick={() => {
            setSubmitted(false);
            dispatch({ type: "SET_PARENT_PAGE", page: "orders" });
          }}
        >
          View My Orders
        </Btn>
      </div>
    );

  if (cart.length === 0)
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>🛒</div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 8,
          }}
        >
          Your cart is empty
        </h2>
        <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>
          Browse the product list to add items.
        </p>
        <Btn
          onClick={() => dispatch({ type: "SET_PARENT_PAGE", page: "home" })}
        >
          Browse Products
        </Btn>
      </div>
    );

  return (
    <div
      className="animate-fade"
      style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}
    >
      {/* Cart Items */}
      <Card>
        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          Cart Items ({cart.length})
        </h3>
        {cart.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {item.images && item.images.length > 0 ? (
                <img
                  src={item.images[0]}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: item.imageBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  {item.imageEmoji}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {item.productName}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>
                Size {item.size} · Age {item.size.replace("T", "")}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() =>
                  item.quantity > 1
                    ? dispatch({
                        type: "UPDATE_CART_QTY",
                        index: i,
                        qty: item.quantity - 1,
                      })
                    : dispatch({ type: "REMOVE_FROM_CART", index: i })
                }
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                −
              </button>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  minWidth: 16,
                  textAlign: "center",
                }}
              >
                {item.quantity}
              </span>
              <button
                onClick={() =>
                  dispatch({
                    type: "UPDATE_CART_QTY",
                    index: i,
                    qty: item.quantity + 1,
                  })
                }
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                +
              </button>
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                color: "var(--sky-dark)",
                minWidth: 56,
                textAlign: "right",
              }}
            >
              ${(item.unitPrice * item.quantity).toFixed(2)}
            </div>
            <button
              onClick={() => dispatch({ type: "REMOVE_FROM_CART", index: i })}
              style={{
                background: "none",
                border: "none",
                color: "var(--peach-dark)",
                cursor: "pointer",
                fontSize: 16,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        ))}
        {/* Totals */}
        <div
          style={{
            background: subtotal >= threshold ? "var(--lemon)" : "var(--bg2)",
            border: `1px solid ${subtotal >= threshold ? "var(--lemon-mid)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            padding: 12,
            marginTop: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            <span style={{ color: "var(--text2)" }}>Subtotal</span>
            <span style={{ fontWeight: 700 }}>${subtotal.toFixed(2)}</span>
          </div>
          {discountRate > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 4,
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--text2)" }}>
                  Discount{" "}
                  <span
                    style={{
                      background: "var(--peach-dark)",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 30,
                      marginLeft: 4,
                    }}
                  >
                    15% OFF — Order ≥ ${threshold}
                  </span>
                </span>
                <span style={{ color: "var(--peach-dark)", fontWeight: 700 }}>
                  −${isNaN(discountAmount) ? "0.00" : discountAmount.toFixed(2)}
                </span>
              </div>
            </>
          )}
          {subtotal > 0 && subtotal < threshold && (
            <div
              style={{
                fontSize: 11,
                color: "var(--lemon-dark)",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              💡 Add ${(threshold - subtotal).toFixed(2)} more to unlock 15%
              off!
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 900,
              color: "var(--sky-dark)",
              paddingTop: 8,
              borderTop: "1px solid var(--border2)",
              marginTop: 4,
              fontFamily: "var(--font-display)",
            }}
          >
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Order Form */}
      <Card>
        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
          Delivery Details
        </h3>
        {state.settings.orderInstructions && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text2)",
              background: "var(--bg2)",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            {state.settings.orderInstructions}
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 10,
          }}
        >
          {visibleFields
            .filter((f) =>
              ["childName", "childClass", "parentName", "parentPhone"].includes(
                f.fieldKey,
              ),
            )
            .map((f) => (
              <Input
                key={f.fieldKey}
                label={f.label}
                value={form[f.fieldKey] || ""}
                onChange={(v) => setForm({ ...form, [f.fieldKey]: v })}
                required={f.isRequired}
                placeholder={`Enter ${f.label.toLowerCase()}`}
              />
            ))}
        </div>
        {visibleFields
          .filter((f) => f.fieldKey === "locationId")
          .map((f) => (
            <Input
              key={f.fieldKey}
              label={f.label}
              value={form.locationId}
              onChange={(v) => setForm({ ...form, locationId: v })}
              required={f.isRequired}
              options={locations
                .filter((l) => l.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((l) => ({ value: l.id, label: l.name }))}
              style={{ marginBottom: 10 }}
            />
          ))}
        {visibleFields
          .filter(
            (f) =>
              ![
                "childName",
                "childClass",
                "parentName",
                "parentPhone",
                "locationId",
              ].includes(f.fieldKey),
          )
          .map((f) => (
            <Input
              key={f.fieldKey}
              label={f.label}
              value={form[f.fieldKey] || ""}
              onChange={(v) => setForm({ ...form, [f.fieldKey]: v })}
              required={f.isRequired}
              type="textarea"
              placeholder="Optional…"
              style={{ marginBottom: 10 }}
            />
          ))}
        <Btn
          onClick={handleSubmit}
          fullWidth
          size="lg"
          disabled={submitting}
          style={{ marginTop: 6 }}
        >
          {submitting ? "Submitting…" : "Submit Order 🎉"}
        </Btn>
      </Card>
    </div>
  );
}

function ParentOrders() {
  const { state, dispatch } = useApp();
  const [myOrders, setMyOrders] = useState(
    state.orders.filter((o) => o.parentId === state.currentUser?.id),
  );
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/orders/mine")
      .then((orders) => {
        setMyOrders(orders);
        dispatch({ type: "SET_ORDERS", orders });
      })
      .catch(() =>
        setMyOrders(
          state.orders.filter((o) => o.parentId === state.currentUser?.id),
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          padding: 40,
          color: "var(--text3)",
          fontSize: 13,
        }}
      >
        Loading your orders…
      </div>
    );

  if (myOrders.length === 0)
    return (
      <EmptyState
        emoji="📋"
        message="No orders yet — place your first order!"
      />
    );

  return (
    <div className="animate-fade">
      <SectionTitle>My Orders</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {myOrders.map((o) => (
          <Card
            key={o.id}
            style={{ cursor: "pointer", transition: "box-shadow .2s" }}
            onClick={() => setDetail(o)}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)" }}
              >
                {o.orderNumber} ·{" "}
                {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ""}
              </span>
              <Badge status={o.status} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
              {o.childName} · {o.childClass}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}
            >
              {o.items
                .map((i) => `${i.productName} ${i.size} ×${i.quantity}`)
                .join(", ")}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--sky-dark)",
                }}
              >
                ${Number(o.totalAmount).toFixed(2)}
              </span>
              {o.discountRate > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--peach-dark)",
                    fontWeight: 700,
                  }}
                >
                  15% discount applied
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
      {detail && (
        <Modal
          title={`Order ${detail.orderNumber}`}
          onClose={() => setDetail(null)}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Badge status={detail.status} />
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {detail.createdAt
                ? new Date(detail.createdAt).toLocaleDateString()
                : ""}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Child
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childName}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Class
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childClass}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Parent
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentName}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Phone
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentPhone}</div>
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
              marginBottom: 12,
            }}
          >
            {detail.items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "4px 0",
                }}
              >
                <span>
                  {item.productName} ({item.size}) ×{item.quantity}
                </span>
                <span style={{ fontWeight: 700 }}>
                  ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "var(--bg2)",
              borderRadius: "var(--radius-sm)",
              padding: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              <span style={{ color: "var(--text3)" }}>Subtotal</span>
              <span>${Number(detail.subtotal).toFixed(2)}</span>
            </div>
            {detail.discountRate > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 2,
                  color: "var(--peach-dark)",
                }}
              >
                <span>Discount (15%)</span>
                <span>
                  −$
                  {isNaN(detail.discountAmount)
                    ? "0.00"
                    : detail.discountAmount}
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
                fontWeight: 900,
                color: "var(--sky-dark)",
                paddingTop: 6,
                borderTop: "1px solid var(--border)",
                marginTop: 4,
              }}
            >
              <span>Total</span>
              <span>${Number(detail.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PARENT SHELL ─────────────────────────────────────────────
function ParentShell() {
  const { state, dispatch } = useApp();
  const { parentPage, cart } = state;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const tabs = [
    { id: "home", label: "Shop", icon: "🏪" },
    {
      id: "cart",
      label: `Cart${cartCount > 0 ? ` (${cartCount})` : ""}`,
      icon: "🛒",
    },
    { id: "orders", label: "My Orders", icon: "📋" },
  ];

  if (parentPage === "login") return <ParentLogin />;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {state.settings.logoUrl ? (
            <img
              src={state.settings.logoUrl}
              alt="Logo"
              style={{
                width: 28,
                height: 28,
                objectFit: "contain",
                borderRadius: 4,
              }}
            />
          ) : (
            <span style={{ fontSize: 20 }}>{state.settings.logoEmoji}</span>
          )}
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--mint-dark)",
            }}
          >
            {state.settings.systemName}
          </span>
        </div>
        <button
          onClick={() => {
            dispatch({ type: "LOGOUT" });
          }}
          style={{
            background: "none",
            border: "none",
            fontSize: 12,
            color: "var(--text3)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          Sign out
        </button>
      </div>
      {/* Content */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        {parentPage === "home" && <ParentHome />}
        {parentPage === "cart" && <ParentCart />}
        {parentPage === "orders" && <ParentOrders />}
      </div>
      {/* Bottom Nav */}
      <div
        style={{
          background: "var(--bg)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          position: "sticky",
          bottom: 0,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => dispatch({ type: "SET_PARENT_PAGE", page: t.id })}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              borderTop: `2.5px solid ${parentPage === t.id ? "var(--sky-dark)" : "transparent"}`,
              transition: "all .15s",
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: parentPage === t.id ? "var(--sky-dark)" : "var(--text3)",
              }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ADMIN SCREENS
// ══════════════════════════════════════════════════════════════

function AdminDashboard() {
  const { state, dispatch } = useApp();
  const { orders, products } = state;
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Load real stats from the backend
    api("/api/admin/stats")
      .then(setStats)
      .catch(() => {});
    // Also refresh the admin product list (includes costPrice) and recent orders
    Promise.all([api("/api/admin/products"), api("/api/admin/orders?limit=20")])
      .then(([prods, ordersData]) => {
        dispatch({
          type: "SET_ADMIN_DATA",
          products: prods,
          orders: ordersData.orders || ordersData,
        });
      })
      .catch(() => {});
  }, []);

  const totalRev =
    stats?.revenue ??
    orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((s, o) => s + Number(o.totalAmount), 0);
  const profit = stats?.profit ?? 0;
  const pending =
    stats?.pendingOrders ??
    orders.filter((o) => ["SUBMITTED", "REVIEW"].includes(o.status)).length;
  const totalOrders = stats?.totalOrders ?? orders.length;

  const productQtys = stats?.topProducts
    ? stats.topProducts.map((p) => ({
        id: p.productId,
        name: p.productName,
        totalQty: p._sum?.quantity || 0,
      }))
    : products
        .map((p) => ({
          ...p,
          totalQty: orders
            .filter((o) => o.status !== "CANCELLED")
            .reduce(
              (s, o) =>
                s +
                o.items
                  .filter((i) => i.productId === p.id)
                  .reduce((ss, i) => ss + i.quantity, 0),
              0,
            ),
        }))
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 6);

  const maxQty = Math.max(...productQtys.map((p) => p.totalQty), 1);

  console.log(orders);
  return (
    <div className="animate-fade">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Total Orders"
          value={totalOrders}
          sub={`${pending} pending review`}
        />
        <StatCard
          label="Revenue"
          value={`$${totalRev.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`}
          sub="After discounts"
        />
        <StatCard
          label="Gross Profit"
          value={`$${profit.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`}
          sub={`Margin ${totalRev > 0 ? ((profit / totalRev) * 100).toFixed(1) : 0}%`}
          color="var(--sky-dark)"
        />
        <StatCard
          label="Pending"
          value={pending}
          sub="Needs action"
          color="var(--peach-dark)"
        />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <h3 className="txt-card-h3" style={{ marginBottom: 12 }}>
          Recent Orders
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr>
                {["Order", "Child", "Location", "Total", "Status"].map((h) => (
                  <th
                    key={h}
                    className="txt-th"
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => {
                const amount = parseFloat(o.totalAmount);
                return (
                  <tr key={o.id}>
                    {[
                      o.orderNumber,
                      `${o.childName} · ${o.childClass}`,
                      state.locations.find((l) => l.id === o.locationId)
                        ?.name ||
                        o.locationName ||
                        "",
                      `${isNaN(amount) ? "0.00" : amount.toFixed(2)}`,
                      <Badge status={o.status} />,
                    ].map((cell, i) => (
                      <td
                        key={i}
                        style={{
                          padding: "8px 8px",
                          borderBottom: "0.5px solid var(--border)",
                          whiteSpace: i < 3 ? "nowrap" : "normal",
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="txt-card-h3" style={{ marginBottom: 12 }}>
          Products by Order Volume
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {productQtys.map((p, i) => {
            const colors = [
              "var(--mint-mid)",
              "var(--sky-mid)",
              "var(--peach-mid)",
              "var(--purple-mid)",
              "var(--lemon-mid)",
              "var(--text3)",
            ];
            return (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    width: 100,
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </span>
                <div
                  style={{
                    flex: 1,
                    background: "var(--bg3)",
                    borderRadius: 4,
                    height: 10,
                  }}
                >
                  <div
                    style={{
                      width: `${((p.totalQty / maxQty) * 100).toFixed(0)}%`,
                      height: "100%",
                      background: colors[i],
                      borderRadius: 4,
                      transition: "width .5s ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text3)",
                    minWidth: 28,
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {p.totalQty}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function AdminProducts() {
  const { state, dispatch } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Load admin product list (includes costPrice) on mount
  useEffect(() => {
    api("/api/admin/products")
      .then((prods) => dispatch({ type: "SET_ADMIN_DATA", products: prods }))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  const [form, setForm] = useState({
    name: "",
    description: "",
    imageEmoji: "👕",
    imageBg: "#e8f7f0",
    images: [],
    category: "Tops",
    sellingPrice: "",
    costPrice: "",
    sizes: ["T1", "T2", "T3", "T4", "T5"],
    isActive: true,
  });
  const sizes = ["T1", "T2", "T3", "T4", "T5"];
  const categories = ["Tops", "Bottoms", "Accessories", "Sets"];

  function openNew() {
    setEditing(null);
    setPendingFiles([]);
    setForm({
      name: "",
      description: "",
      imageEmoji: "👕",
      imageBg: "#e8f7f0",
      images: [],
      category: "Tops",
      sellingPrice: "",
      costPrice: "",
      sizes: ["T1", "T2", "T3"],
      isActive: true,
    });
    setShowForm(true);
  }
  function openEdit(p) {
    setEditing(p);
    setPendingFiles([]);
    setForm({
      ...p,
      images: p.images || [],
      sellingPrice: String(p.sellingPrice),
      costPrice: String(p.costPrice),
    });
    setShowForm(true);
  }
  // Track which images are brand-new File objects vs existing URLs
  const [pendingFiles, setPendingFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    if (!form.name || !form.sellingPrice || !form.costPrice) {
      dispatch({
        type: "SET_TOAST",
        message: "Name, selling price and cost price are required",
      });
      return;
    }
    dispatch({ type: "SET_TOAST", message: "Saving…" });
    try {
      const body = {
        name: form.name,
        description: form.description,
        imageEmoji: form.imageEmoji,
        imageBg: form.imageBg,
        category: form.category,
        sellingPrice: parseFloat(form.sellingPrice),
        costPrice: parseFloat(form.costPrice),
        sizes: form.sizes,
        isActive: form.isActive,
      };

      let product;
      if (editing) {
        // 1a. Update metadata
        product = await api(`/api/admin/products/${editing.id}`, {
          method: "PUT",
          body,
        });
      } else {
        // 1b. Create new product (no images yet)
        product = await api("/api/admin/products", { method: "POST", body });
      }

      const productId = product.id;

      // 2. Separate existing URLs from new File objects
      const existingUrls = form.images.filter((img) => typeof img === "string");
      const newFiles = pendingFiles; // File objects collected by ImageUploader

      // 3. If editing and the URL list changed (reordered/deleted), sync it
      if (editing && existingUrls.length !== (editing.images || []).length) {
        await api(`/api/admin/products/${productId}/images`, {
          method: "PUT",
          body: { images: existingUrls },
        });
      }

      // 4. Upload any new File objects via multipart POST
      if (newFiles.length > 0) {
        const fd = new FormData();
        newFiles.forEach((file) => fd.append("images", file));
        const uploaded = await apiUpload(
          `/api/admin/products/${productId}/images`,
          fd,
        );
        product = { ...product, images: uploaded.images };
      } else {
        product = { ...product, images: existingUrls };
      }

      // 5. Reload full product list so admin table is fresh
      const updatedProducts = await api("/api/admin/products");
      dispatch({ type: "SET_ADMIN_DATA", products: updatedProducts });

      dispatch({
        type: "SET_TOAST",
        message: editing ? "Product updated!" : "Product added!",
      });
      setPendingFiles([]);
      setShowForm(false);
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to save product",
      });
    } finally {
      setSaving(false);
    }
  }
  function toggleSize(s) {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(s)
        ? f.sizes.filter((x) => x !== s)
        : [...f.sizes, s].sort(),
    }));
  }

  return (
    <div className="animate-fade">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 14,
        }}
      >
        <Btn variant="admin" size="sm" onClick={openNew}>
          + Add Product
        </Btn>
      </div>
      {loadingProducts && (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "var(--text3)",
            fontSize: 13,
          }}
        >
          Loading products…
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            minWidth: 560,
          }}
        >
          <thead>
            <tr>
              {[
                "Product",
                "Selling",
                "Cost 🔒",
                "Profit",
                "Sizes",
                "Status",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="txt-th"
                  style={{
                    padding: "7px 10px",
                    textAlign: "left",
                    background: "var(--bg2)",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.products.map((p) => (
              <tr key={p.id} style={{ transition: "background .15s" }}>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {p.images && p.images.length > 0 ? (
                        <img
                          src={p.images[0]}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            background: p.imageBg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                          }}
                        >
                          {p.imageEmoji}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>
                        {p.category}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                    color: "#2a7a4e",
                  }}
                >
                  ${p.sellingPrice}
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                    color: "var(--peach-dark)",
                  }}
                >
                  ${p.costPrice}
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                    color: "#1a5c47",
                  }}
                >
                  ${(p.sellingPrice - p.costPrice).toFixed(2)}
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {p.sizes.map((s) => (
                      <span
                        key={s}
                        style={{
                          background: "var(--bg3)",
                          border: "0.5px solid var(--border)",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 5px",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <Toggle
                    checked={p.isActive}
                    onChange={async (v) => {
                      try {
                        await api(`/api/admin/products/${p.id}`, {
                          method: "PUT",
                          body: { isActive: v },
                        });
                        dispatch({
                          type: "UPDATE_PRODUCT",
                          product: { ...p, isActive: v },
                        });
                      } catch (err) {
                        dispatch({
                          type: "SET_TOAST",
                          message: err.message || "Failed to update product",
                        });
                      }
                    }}
                  />
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => openEdit(p)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "none",
                        background: "#dce6f0",
                        color: "#1a3f6e",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api(`/api/admin/products/${p.id}`, {
                            method: "DELETE",
                          });
                          dispatch({ type: "DELETE_PRODUCT", id: p.id });
                          dispatch({
                            type: "SET_TOAST",
                            message: "Product deleted",
                          });
                        } catch (err) {
                          dispatch({
                            type: "SET_TOAST",
                            message: err.message || "Failed to delete product",
                          });
                        }
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "none",
                        background: "var(--peach)",
                        color: "var(--peach-dark)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? "Edit Product" : "Add Product"}
          onClose={() => {
            setShowForm(false);
            setPendingFiles([]);
          }}
          width={500}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <Input
              label="Product Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
              style={{ gridColumn: "1/-1" }}
            />
            <Input
              label="Selling Price ($)"
              value={form.sellingPrice}
              onChange={(v) => setForm({ ...form, sellingPrice: v })}
              type="number"
              required
            />
            <Input
              label="Cost Price ($) 🔒"
              value={form.costPrice}
              onChange={(v) => setForm({ ...form, costPrice: v })}
              type="number"
              required
            />
            <Input
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={categories}
            />
            <Input
              label="Fallback Emoji"
              value={form.imageEmoji}
              onChange={(v) => setForm({ ...form, imageEmoji: v })}
              placeholder="👕"
            />
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            type="textarea"
            style={{ marginBottom: 10 }}
          />
          <div style={{ marginBottom: 14 }}>
            <ImageUploader
              images={form.images || []}
              onChange={(imgs) => setForm({ ...form, images: imgs })}
              onNewFiles={(files) => setPendingFiles(files)}
            />
          </div>
          {/* Preview of uploaded images */}
          {form.images && form.images.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text2)",
                  marginBottom: 6,
                }}
              >
                Preview
              </div>
              <ProductImageGallery
                images={form.images}
                imageEmoji={form.imageEmoji}
                imageBg={form.imageBg || "#e8f7f0"}
                height={160}
                showThumbs={true}
              />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text2)",
                marginBottom: 6,
              }}
            >
              Available Sizes
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sizes.map((s) => (
                <label
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    padding: "5px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: `2px solid ${form.sizes.includes(s) ? "var(--sky-dark)" : "var(--border)"}`,
                    background: form.sizes.includes(s)
                      ? "var(--sky)"
                      : "var(--bg)",
                    transition: "all .15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.sizes.includes(s)}
                    onChange={() => toggleSize(s)}
                    style={{ accentColor: "var(--sky-dark)" }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: form.sizes.includes(s)
                        ? "var(--sky-dark)"
                        : "var(--text2)",
                    }}
                  >
                    {s}{" "}
                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                      Age {s.replace("T", "")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn
              variant="admin"
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Product"}
            </Btn>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminInventory() {
  const { state, dispatch } = useApp();
  const [filter, setFilter] = useState("");
  const [apiRows, setApiRows] = useState(null);
  const [saving, setSaving] = useState({});
  const [editingRow, setEditingRow] = useState(null); // { invId, value }

  useEffect(() => {
    api("/api/admin/inventory")
      .then((data) => setApiRows(data))
      .catch(() => {});
  }, []);

  const rows = apiRows
    ? apiRows.map((i) => ({
        invId: i.id,
        product: { id: i.productId, name: i.product?.name || "" },
        size: i.size,
        total: i.totalQty,
        reserved: i.reservedQty,
        available: i.availableQty,
      }))
    : state.products
        .filter((p) => p.isActive)
        .flatMap((p) =>
          p.sizes.map((s) => {
            const inv = state.inventory[p.id]?.[s] || { total: 0, reserved: 0 };
            return {
              product: p,
              size: s,
              total: inv.total,
              reserved: inv.reserved,
              available: inv.total - inv.reserved,
            };
          }),
        );

  const filtered = filter
    ? rows.filter(
        (r) =>
          r.product.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.size === filter,
      )
    : rows;

  function startEdit(r) {
    setEditingRow({ invId: r.invId, value: String(r.total) });
  }

  async function saveEdit(row) {
    if (!editingRow) return;
    const newTotal = Math.max(parseInt(editingRow.value) || 0, 0);
    const key = row.invId;
    setSaving((s) => ({ ...s, [key]: true }));
    setApiRows((prev) =>
      prev
        ? prev.map((r) =>
            r.id === row.invId
              ? {
                  ...r,
                  totalQty: newTotal,
                  availableQty: newTotal - r.reservedQty,
                }
              : r,
          )
        : prev,
    );
    dispatch({
      type: "UPDATE_INVENTORY",
      productId: row.product.id,
      size: row.size,
      inv: { total: newTotal, reserved: row.reserved },
    });
    try {
      if (row.invId) {
        await api(`/api/admin/inventory/${row.invId}`, {
          method: "PUT",
          body: { totalQty: newTotal },
        });
        dispatch({
          type: "SET_TOAST",
          message: `Updated: ${row.product.name} ${row.size} → ${newTotal}`,
        });
      }
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update inventory",
      });
    } finally {
      setSaving((s) => {
        const n = { ...s };
        delete n[key];
        return n;
      });
      setEditingRow(null);
    }
  }
  function exportCSV() {
    window.open(`${API_BASE_URL}/api/admin/inventory/export`, "_blank");
  }

  return (
    <div className="animate-fade">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 14,
        }}
      >
        <Btn variant="admin" size="sm" onClick={exportCSV}>
          Export CSV
        </Btn>
      </div>
      <div
        style={{
          background: "var(--lemon)",
          border: "1px solid var(--lemon-mid)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--lemon-dark)",
          fontWeight: 600,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        📋 <strong>Submitted / Review</strong> → reserves stock &nbsp;|&nbsp;{" "}
        <strong>Ready for Pick Up</strong> → deducts from total &nbsp;|&nbsp;{" "}
        <strong>Cancelled</strong> → restores stock
      </div>
      <div style={{ marginBottom: 10 }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by product name…"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            minWidth: 480,
          }}
        >
          <thead>
            <tr>
              {[
                "Product · Size",
                "Total Stock",
                "Reserved",
                "Available",
                "Update",
              ].map((h) => (
                <th
                  key={h}
                  className="txt-th"
                  style={{
                    padding: "7px 10px",
                    textAlign: "left",
                    background: "var(--bg2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                  }}
                >
                  <span>{r.product.name}</span>{" "}
                  <span
                    style={{
                      fontSize: 11,
                      background: "var(--bg3)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 700,
                      marginLeft: 4,
                    }}
                  >
                    {r.size}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      background: "var(--sky)",
                      color: "var(--sky-dark)",
                      padding: "3px 9px",
                      borderRadius: 30,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {r.total}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      background: "var(--lemon)",
                      color: "var(--lemon-dark)",
                      padding: "3px 9px",
                      borderRadius: 30,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {r.reserved}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      background: "var(--sky)",
                      color: "var(--sky-dark)",
                      padding: "3px 9px",
                      borderRadius: 30,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {r.available}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  {editingRow?.invId === r.invId ? (
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <input
                        type="number"
                        value={editingRow?.value}
                        min={0}
                        autoFocus
                        onChange={(e) =>
                          setEditingRow({
                            ...editingRow,
                            value: e.target.value,
                          })
                        }
                        style={{
                          width: 64,
                          padding: "5px 8px",
                          border: "1px solid var(--sky-dark)",
                          borderRadius: "var(--radius-xs)",
                          fontSize: 12,
                          background: "var(--bg)",
                          color: "var(--text)",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => saveEdit(r)}
                        disabled={saving[r.invId]}
                        style={{
                          padding: "5px 10px",
                          border: "none",
                          borderRadius: "var(--radius-xs)",
                          fontSize: 11,
                          fontWeight: 700,
                          background: "var(--sky-dark)",
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        {saving[r.invId] ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingRow(null)}
                        style={{
                          padding: "5px 8px",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-xs)",
                          fontSize: 11,
                          fontWeight: 700,
                          background: "var(--bg)",
                          color: "var(--text2)",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(r)}
                      style={{
                        padding: "5px 10px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-xs)",
                        fontSize: 11,
                        fontWeight: 700,
                        background: "var(--bg)",
                        color: "var(--text2)",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminOrders() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLoc, setFilterLoc] = useState("");
  const [detail, setDetail] = useState(null);
  const [allOrders, setAllOrders] = useState(state.orders);
  const [loading, setLoading] = useState(true);

  // Re-fetch whenever search/filter changes
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterLoc) params.set("locationId", filterLoc);
    api(`/api/admin/orders?${params}`)
      .then((data) => {
        const orders = data.orders || data;
        setAllOrders(orders);
        dispatch({ type: "SET_ORDERS", orders });
      })
      .catch(() => setAllOrders(state.orders))
      .finally(() => setLoading(false));
  }, [search, filterStatus, filterLoc]);

  // Client-side filter as a fast fallback while API data loads
  const filtered = allOrders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.childName?.toLowerCase().includes(q) ||
      o.parentName?.toLowerCase().includes(q) ||
      o.childClass?.toLowerCase().includes(q) ||
      o.orderNumber?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || o.status === filterStatus;
    const matchLoc = !filterLoc || o.locationId === filterLoc;
    return matchSearch && matchStatus && matchLoc;
  });

  function exportCSV() {
    window.open(`${API_BASE_URL}/api/admin/orders/export`, "_blank");
  }

  async function handleStatusChange(orderId, newStatus) {
    try {
      await api(`/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        body: { status: newStatus },
      });
      setAllOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      dispatch({ type: "UPDATE_ORDER_STATUS", id: orderId, status: newStatus });
      dispatch({
        type: "SET_TOAST",
        message: `Status updated to ${STATUS_LABELS[newStatus]}`,
      });
      if (detail?.id === orderId)
        setDetail((d) => ({ ...d, status: newStatus }));
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update status",
      });
    }
  }

  return (
    <div className="animate-fade">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 14,
        }}
      >
        <Btn variant="admin" size="sm" onClick={exportCSV}>
          Export CSV
        </Btn>
      </div>
      <div
        style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders…"
          style={{
            flex: 1,
            minWidth: 140,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filterLoc}
          onChange={(e) => setFilterLoc(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        >
          <option value="">All Locations</option>
          {state.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "var(--text3)",
            fontSize: 13,
          }}
        >
          Loading orders…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState emoji="🔍" message="No orders match your search" />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: 640,
            }}
          >
            <thead>
              <tr>
                {[
                  "Order",
                  "Child · Class",
                  "Parent",
                  "Location",
                  "Total",
                  "Status",
                  "Update",
                ].map((h) => (
                  <th
                    key={h}
                    className="txt-th"
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      background: "var(--bg2)",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const amount = parseFloat(o.totalAmount);
                return (
                  <tr
                    key={o.id}
                    style={{ cursor: "pointer", transition: "background .15s" }}
                    onClick={() => setDetail(o)}
                  >
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                        fontWeight: 700,
                        color: "var(--sky-dark)",
                      }}
                    >
                      {o.orderNumber}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{o.childName}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>
                        {o.childClass}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                      }}
                    >
                      {o.parentName}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                        fontSize: 11,
                      }}
                    >
                      {state.locations.find((l) => l.id === o.locationId)
                        ?.name ||
                        o.locationName ||
                        "—"}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                        fontWeight: 800,
                        color: "var(--sky-dark)",
                      }}
                    >
                      {/* ${o.totalAmount.toFixed(2)} */}
                      {`${isNaN(amount) ? "0.00" : amount.toFixed(2)}`}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                      }}
                    >
                      <Badge status={o.status} />
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={o.status}
                        onChange={(e) =>
                          handleStatusChange(o.id, e.target.value)
                        }
                        style={{
                          padding: "4px 8px",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-xs)",
                          fontSize: 11,
                          background: "var(--bg)",
                          color: "var(--text)",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal
          title={`Order ${detail.orderNumber}`}
          onClose={() => setDetail(null)}
          width={520}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Badge status={detail.status} />
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {detail.createdAt}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Child
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childName}</div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Class
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childClass}</div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Parent
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentName}</div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Phone
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentPhone}</div>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Location
              </div>
              <div style={{ fontWeight: 700 }}>
                {state.locations.find((l) => l.id === detail.locationId)
                  ?.name || detail.locationName}
              </div>
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 10,
              marginBottom: 10,
            }}
          >
            {detail.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  padding: "4px 0",
                }}
              >
                <span>
                  {it.productName} ({it.size}) ×{it.quantity}
                </span>
                <span style={{ fontWeight: 700 }}>
                  ${(it.unitPrice * it.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "var(--bg2)",
              borderRadius: "var(--radius-sm)",
              padding: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              <span style={{ color: "var(--text3)" }}>Subtotal</span>
              <span>${parseFloat(detail.subtotal).toFixed(2)}</span>
            </div>
            {detail.discountRate > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 2,
                  color: "var(--peach-dark)",
                }}
              >
                <span>
                  Discount ({(detail.discountRate * 100).toFixed(0)}%)
                </span>
                <span>
                  −$
                  {isNaN(detail.discountAmount)
                    ? "0.00"
                    : detail.discountAmount}
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
                fontWeight: 900,
                color: "var(--sky-dark)",
                paddingTop: 6,
                borderTop: "1px solid var(--border)",
                marginTop: 4,
              }}
            >
              <span>Total</span>
              <span>${parseFloat(detail.totalAmount).toFixed(2)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              Update status:
            </span>
            <select
              value={detail.status}
              onChange={(e) => {
                handleStatusChange(detail.id, e.target.value);
                setDetail({ ...detail, status: e.target.value });
              }}
              style={{
                flex: 1,
                padding: "7px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                background: "var(--bg)",
                outline: "none",
              }}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminMasterControl() {
  const { state, dispatch } = useApp();
  const [settings, setSettings] = useState({ ...state.settings });
  const [locations, setLocations] = useState([...state.locations]);
  const [fields, setFields] = useState([...state.formFields]);
  const [newLocName, setNewLocName] = useState("");
  const [tab, setTab] = useState("locations");

  // Re-sync local state if the global state loads fresh data from the API
  useEffect(() => {
    setSettings({ ...state.settings });
  }, [state.settings]);
  useEffect(() => {
    setLocations([...state.locations]);
  }, [state.locations]);
  useEffect(() => {
    setFields([...state.formFields]);
  }, [state.formFields]);

  // Load admin-side locations (includes inactive ones) on mount
  useEffect(() => {
    api("/api/admin/locations")
      .then((locs) => setLocations(locs))
      .catch(() => {});
  }, []);

  async function saveSettings() {
    try {
      const saved = await api("/api/admin/settings", {
        method: "PUT",
        body: { ...settings },
      });
      dispatch({ type: "UPDATE_SETTINGS", settings: saved });
      dispatch({ type: "SET_TOAST", message: "Settings saved!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to save settings",
      });
    }
  }
  async function addLocation() {
    if (!newLocName.trim()) {
      dispatch({ type: "SET_TOAST", message: "Enter a location name" });
      return;
    }
    try {
      const loc = await api("/api/admin/locations", {
        method: "POST",
        body: { name: newLocName.trim(), sortOrder: locations.length + 1 },
      });
      const updated = [...locations, loc];
      setLocations(updated);
      dispatch({ type: "ADD_LOCATION", location: loc });
      setNewLocName("");
      dispatch({ type: "SET_TOAST", message: "Location added!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to add location",
      });
    }
  }
  async function setDefault(id) {
    try {
      await api(`/api/admin/locations/${id}`, {
        method: "PUT",
        body: { isDefault: true },
      });
      const updated = locations.map((l) => ({ ...l, isDefault: l.id === id }));
      setLocations(updated);
      updated.forEach((l) =>
        dispatch({ type: "UPDATE_LOCATION", location: l }),
      );
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to set default",
      });
    }
  }
  async function deleteLoc(id) {
    try {
      await api(`/api/admin/locations/${id}`, { method: "DELETE" });
      const updated = locations.filter((l) => l.id !== id);
      setLocations(updated);
      dispatch({ type: "DELETE_LOCATION", id });
      dispatch({ type: "SET_TOAST", message: "Location removed" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to remove location",
      });
    }
  }
  // ── form-field editing state ─────────────────────────────
  const BLANK_FIELD = {
    label: "",
    fieldKey: "",
    fieldType: "text",
    isRequired: false,
    isVisible: true,
    isSystem: false,
  };
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingField, setEditingField] = useState(null); // null = adding new
  const [fieldForm, setFieldForm] = useState(BLANK_FIELD);

  function openAddField() {
    setEditingField(null);
    setFieldForm(BLANK_FIELD);
    setShowFieldForm(true);
  }
  function openEditField(f) {
    setEditingField(f);
    setFieldForm({
      label: f.label,
      fieldKey: f.fieldKey,
      fieldType: f.fieldType || "text",
      isRequired: f.isRequired,
      isVisible: f.isVisible,
      isSystem: f.isSystem,
    });
    setShowFieldForm(true);
  }

  async function saveFields() {
    try {
      await api("/api/admin/form-fields", { method: "PUT", body: { fields } });
      dispatch({ type: "UPDATE_FORM_FIELDS", fields });
      dispatch({ type: "SET_TOAST", message: "Form fields saved!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to save fields",
      });
    }
  }

  async function submitFieldForm() {
    if (!fieldForm.label.trim() || !fieldForm.fieldKey.trim()) {
      dispatch({
        type: "SET_TOAST",
        message: "Label and Field Key are required",
      });
      return;
    }
    // Validate fieldKey: lowercase letters, numbers, no spaces
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldForm.fieldKey)) {
      dispatch({
        type: "SET_TOAST",
        message:
          "Field Key must start with a letter and contain only letters, numbers, underscores",
      });
      return;
    }
    try {
      if (editingField) {
        // Update existing via PUT (toggles + label)
        const updated = fields.map((f) =>
          f.id === editingField.id
            ? {
                ...f,
                label: fieldForm.label,
                fieldType: fieldForm.fieldType,
                isRequired: fieldForm.isRequired,
                isVisible: fieldForm.isVisible,
              }
            : f,
        );
        await api("/api/admin/form-fields", {
          method: "PUT",
          body: { fields: updated },
        });
        setFields(updated);
        dispatch({ type: "UPDATE_FORM_FIELDS", fields: updated });
        dispatch({ type: "SET_TOAST", message: "Field updated!" });
      } else {
        // Create new via POST
        const newField = await api("/api/admin/form-fields", {
          method: "POST",
          body: { ...fieldForm, sortOrder: fields.length + 1 },
        });
        const updated = [...fields, newField];
        setFields(updated);
        dispatch({ type: "UPDATE_FORM_FIELDS", fields: updated });
        dispatch({ type: "SET_TOAST", message: "Field added!" });
      }
      setShowFieldForm(false);
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to save field",
      });
    }
  }

  async function deleteField(f) {
    if (!window.confirm(`Delete field "${f.label}"? This cannot be undone.`))
      return;
    try {
      await api(`/api/admin/form-fields/${f.id}`, { method: "DELETE" });
      const updated = fields.filter((x) => x.id !== f.id);
      setFields(updated);
      dispatch({ type: "UPDATE_FORM_FIELDS", fields: updated });
      dispatch({ type: "SET_TOAST", message: "Field deleted" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to delete field",
      });
    }
  }

  const tabs = ["locations", "branding", "form"];
  const tabLabels = {
    locations: "📍 Locations",
    branding: "🎨 Branding",
    form: "📝 Form Fields",
  };

  return (
    <div className="animate-fade">
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              borderBottom: `2.5px solid ${tab === t ? "var(--sky-dark)" : "transparent"}`,
              color: tab === t ? "var(--sky-dark)" : "var(--text3)",
              paddingBottom: 10,
              marginBottom: -1,
              transition: "all .15s",
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {tab === "locations" && (
        <Card>
          <h3 className="txt-card-h3" style={{ marginBottom: 12 }}>
            School Locations
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {locations.map((l) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: "var(--bg2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                  {l.name}
                </span>
                {l.isDefault && (
                  <span
                    style={{
                      background: "var(--sky)",
                      color: "var(--sky-dark)",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 30,
                    }}
                  >
                    Default
                  </span>
                )}
                {!l.isDefault && (
                  <button
                    onClick={() => setDefault(l.id)}
                    style={{
                      padding: "3px 9px",
                      border: "none",
                      borderRadius: 5,
                      background: "var(--bg3)",
                      color: "var(--text3)",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => deleteLoc(l.id)}
                  style={{
                    padding: "3px 9px",
                    border: "none",
                    borderRadius: 5,
                    background: "var(--peach)",
                    color: "var(--peach-dark)",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newLocName}
              onChange={(e) => setNewLocName(e.target.value)}
              placeholder="New location name…"
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                background: "var(--bg)",
                color: "var(--text)",
                outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
            />
            <Btn variant="admin" onClick={addLocation}>
              + Add
            </Btn>
          </div>
        </Card>
      )}

      {tab === "branding" && (
        <Card>
          <h3 className="txt-card-h3" style={{ marginBottom: 12 }}>
            Branding & Page Content
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input
              label="System / Page Title"
              value={settings.systemName}
              onChange={(v) => setSettings({ ...settings, systemName: v })}
            />
            <Input
              label="Logo Emoji"
              value={settings.logoEmoji}
              onChange={(v) => setSettings({ ...settings, logoEmoji: v })}
              placeholder="🎒"
            />
            {/* Logo image upload */}
            <div>
              <label
                className="txt-label"
                style={{ display: "block", marginBottom: 6 }}
              >
                Logo Image (overrides emoji)
              </label>
              {settings.logoUrl && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "contain",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--bg2)",
                      padding: 4,
                    }}
                  />
                  <button
                    onClick={() => setSettings({ ...settings, logoUrl: "" })}
                    style={{
                      padding: "4px 10px",
                      border: "none",
                      borderRadius: 5,
                      background: "var(--peach)",
                      color: "var(--peach-dark)",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  border: "2px dashed var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  background: "var(--bg2)",
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("logo", file);
                  try {
                    const result = await apiUpload(
                      "/api/admin/settings/logo",
                      fd,
                    );
                    setSettings((s) => ({ ...s, logoUrl: result.logoUrl }));
                    dispatch({
                      type: "UPDATE_SETTINGS",
                      settings: { logoUrl: result.logoUrl },
                    });
                    dispatch({ type: "SET_TOAST", message: "Logo uploaded!" });
                  } catch (err) {
                    dispatch({
                      type: "SET_TOAST",
                      message: err.message || "Upload failed",
                    });
                  }
                }}
              >
                <span style={{ fontSize: 18 }}>🖼️</span>
                <span style={{ fontSize: 12, color: "var(--text2)" }}>
                  Click or drag an image here
                </span>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append("logo", file);
                    try {
                      const result = await apiUpload(
                        "/api/admin/settings/logo",
                        fd,
                      );
                      setSettings((s) => ({ ...s, logoUrl: result.logoUrl }));
                      dispatch({
                        type: "UPDATE_SETTINGS",
                        settings: { logoUrl: result.logoUrl },
                      });
                      dispatch({
                        type: "SET_TOAST",
                        message: "Logo uploaded!",
                      });
                    } catch (err) {
                      dispatch({
                        type: "SET_TOAST",
                        message: err.message || "Upload failed",
                      });
                    }
                  }}
                />
              </label>
            </div>
            <Input
              label="Homepage Welcome Title"
              value={settings.welcomeTitle}
              onChange={(v) => setSettings({ ...settings, welcomeTitle: v })}
            />
            <Input
              label="Homepage Welcome Text"
              value={settings.welcomeText}
              onChange={(v) => setSettings({ ...settings, welcomeText: v })}
              type="textarea"
            />
            <Input
              label="Order Page Instructions"
              value={settings.orderInstructions}
              onChange={(v) =>
                setSettings({ ...settings, orderInstructions: v })
              }
              type="textarea"
            />
            <Input
              label="Notice / Announcement Text"
              value={settings.noticeText}
              onChange={(v) => setSettings({ ...settings, noticeText: v })}
              type="textarea"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <Input
                label="Discount Threshold ($)"
                value={String(settings.discountThreshold)}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    discountThreshold: parseFloat(v) || 500,
                  })
                }
                type="number"
              />
              <Input
                label="Discount Rate (0–1)"
                value={String(settings.discountRate)}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    discountRate: parseFloat(v) || 0.15,
                  })
                }
                type="number"
              />
            </div>
            <Btn variant="admin" onClick={saveSettings} fullWidth>
              Save Branding Settings
            </Btn>
          </div>
        </Card>
      )}

      {tab === "form" && (
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h3 className="txt-card-h3">Order Form Fields</h3>
            <Btn variant="admin" size="sm" onClick={openAddField}>
              + Add Field
            </Btn>
          </div>

          {/* Add / Edit field inline form */}
          {showFieldForm && (
            <div
              style={{
                background: "var(--sky)",
                borderRadius: "var(--radius-sm)",
                padding: 14,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 10,
                  color: "var(--sky-dark)",
                }}
              >
                {editingField ? "Edit Field" : "New Field"}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Input
                  label="Label (shown to user)"
                  value={fieldForm.label}
                  onChange={(v) => setFieldForm({ ...fieldForm, label: v })}
                  placeholder="e.g. Teacher Name"
                  required
                />
                <Input
                  label="Field Key (unique ID)"
                  value={fieldForm.fieldKey}
                  onChange={(v) =>
                    setFieldForm({
                      ...fieldForm,
                      fieldKey: v.replace(/\s/g, ""),
                    })
                  }
                  placeholder="e.g. teacherName"
                  required
                  style={{ opacity: editingField ? 0.5 : 1 }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <Input
                  label="Field Type"
                  value={fieldForm.fieldType}
                  onChange={(v) => setFieldForm({ ...fieldForm, fieldType: v })}
                  options={[
                    { value: "text", label: "Text" },
                    { value: "textarea", label: "Text Area" },
                    { value: "select", label: "Dropdown" },
                    { value: "phone", label: "Phone" },
                    { value: "email", label: "Email" },
                  ]}
                />
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={fieldForm.isRequired}
                    onChange={(e) =>
                      setFieldForm({
                        ...fieldForm,
                        isRequired: e.target.checked,
                      })
                    }
                    style={{ accentColor: "var(--sky-dark)" }}
                  />
                  Required
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={fieldForm.isVisible}
                    onChange={(e) =>
                      setFieldForm({
                        ...fieldForm,
                        isVisible: e.target.checked,
                      })
                    }
                    style={{ accentColor: "var(--sky-dark)" }}
                  />
                  Visible
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn
                  variant="admin"
                  onClick={submitFieldForm}
                  style={{ flex: 1 }}
                >
                  {editingField ? "Update Field" : "Add Field"}
                </Btn>
                <Btn variant="ghost" onClick={() => setShowFieldForm(false)}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}

          {/* Field list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {fields.map((f, i) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  background: "var(--bg2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {/* Label + type */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.label}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>
                    {f.fieldKey} · {f.fieldType || "text"}
                  </div>
                </div>

                {/* Badges */}
                {f.isSystem && (
                  <span
                    style={{
                      background: "var(--bg3)",
                      color: "var(--text3)",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 30,
                      flexShrink: 0,
                    }}
                  >
                    System
                  </span>
                )}

                {/* Visible toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>
                    Visible
                  </span>
                  <Toggle
                    checked={f.isVisible}
                    onChange={(v) => {
                      const updated = [...fields];
                      updated[i] = { ...f, isVisible: v };
                      setFields(updated);
                    }}
                  />
                </div>

                {/* Required toggle — non-system fields only */}
                {!f.isSystem && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>
                      Req.
                    </span>
                    <Toggle
                      checked={f.isRequired}
                      onChange={(v) => {
                        const updated = [...fields];
                        updated[i] = { ...f, isRequired: v };
                        setFields(updated);
                      }}
                    />
                  </div>
                )}

                {/* Edit / Delete — non-system fields only */}
                {!f.isSystem && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => openEditField(f)}
                      style={{
                        padding: "3px 9px",
                        border: "none",
                        borderRadius: 5,
                        background: "var(--sky)",
                        color: "var(--sky-dark)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteField(f)}
                      style={{
                        padding: "3px 9px",
                        border: "none",
                        borderRadius: 5,
                        background: "var(--peach)",
                        color: "var(--peach-dark)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Btn variant="admin" onClick={saveFields} fullWidth>
            Save Visibility &amp; Required Settings
          </Btn>
        </Card>
      )}
    </div>
  );
}

function AdminAdmins() {
  const { dispatch } = useApp();
  const [admins, setAdmins] = useState([]);

  // modal mode: null | "add" | "edit"
  const [modalMode, setModalMode] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // the admin being edited
  const BLANK = { name: "", email: "", role: "STAFF", password: "" };
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    api("/api/admin/accounts")
      .then(setAdmins)
      .catch(() => {});
  }, []);

  // How many active Super Admins are there right now?
  const superAdminCount = admins.filter(
    (a) => a.role === "SUPER_ADMIN" && a.isActive,
  ).length;

  const roleColors = {
    SUPER_ADMIN: "#dce8e0",
    MANAGER: "#dce6f0",
    STAFF: "var(--lemon)",
  };
  const roleTextColors = {
    SUPER_ADMIN: "#1e5c3a",
    MANAGER: "#1a3f6e",
    STAFF: "var(--lemon-dark)",
  };

  function openAdd() {
    setForm(BLANK);
    setEditTarget(null);
    setModalMode("add");
  }

  function openEdit(a) {
    setForm({ name: a.name, email: a.email, role: a.role, password: "" });
    setEditTarget(a);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditTarget(null);
    setForm(BLANK);
  }

  async function handleAdd() {
    if (!form.name || !form.email || !form.password) {
      dispatch({
        type: "SET_TOAST",
        message: "Name, email and password are required",
      });
      return;
    }
    try {
      const newAdmin = await api("/api/admin/accounts", {
        method: "POST",
        body: form,
      });
      setAdmins([...admins, { ...newAdmin, isActive: true }]);
      dispatch({ type: "SET_TOAST", message: "Admin account created!" });
      closeModal();
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to create admin",
      });
    }
  }

  async function handleUpdate() {
    if (!form.name) {
      dispatch({ type: "SET_TOAST", message: "Name is required" });
      return;
    }
    try {
      const body = {
        name: form.name,
        role: form.role,
        isActive: editTarget.isActive,
      };
      if (form.password) body.password = form.password;
      const updated = await api(`/api/admin/accounts/${editTarget.id}`, {
        method: "PUT",
        body,
      });
      setAdmins(admins.map((a) => (a.id === updated.id ? updated : a)));
      dispatch({ type: "SET_TOAST", message: "Account updated!" });
      closeModal();
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update admin",
      });
    }
  }

  async function handleToggleActive(a) {
    try {
      const updated = await api(`/api/admin/accounts/${a.id}`, {
        method: "PUT",
        body: { isActive: !a.isActive },
      });
      setAdmins(admins.map((x) => (x.id === updated.id ? updated : x)));
      dispatch({
        type: "SET_TOAST",
        message: updated.isActive ? "Account activated" : "Account deactivated",
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update account",
      });
    }
  }

  async function handleDelete(a) {
    if (
      !window.confirm(`Permanently delete "${a.name}"? This cannot be undone.`)
    )
      return;
    try {
      await api(`/api/admin/accounts/${a.id}`, { method: "DELETE" });
      setAdmins(admins.filter((x) => x.id !== a.id));
      dispatch({ type: "SET_TOAST", message: "Account deleted" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to delete admin",
      });
    }
  }

  // Whether deleting this account would leave zero Super Admins
  function isLastSuperAdmin(a) {
    return a.role === "SUPER_ADMIN" && superAdminCount <= 1;
  }

  const tdStyle = {
    padding: "10px 10px",
    borderBottom: "0.5px solid var(--border)",
  };
  const btnBase = {
    border: "none",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    padding: "4px 10px",
  };

  return (
    <div className="animate-fade">
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 14,
        }}
      >
        <Btn variant="admin" size="sm" onClick={openAdd}>
          + Add Admin
        </Btn>
      </div>

      {/* Accounts table */}
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr>
            {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
              <th
                key={h}
                className="txt-th"
                style={{
                  padding: "7px 10px",
                  textAlign: "left",
                  background: "var(--bg2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => {
            const lastSuper = isLastSuperAdmin(a);
            return (
              <tr key={a.id}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{a.name}</td>
                <td style={{ ...tdStyle, color: "var(--text2)" }}>{a.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: roleColors[a.role],
                      color: roleTextColors[a.role],
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 9px",
                      borderRadius: 30,
                    }}
                  >
                    {a.role.replace("_", " ")}
                  </span>
                </td>
                <td style={tdStyle}>
                  {/* Active / Inactive toggle — disabled for last Super Admin */}
                  <button
                    onClick={() => !lastSuper && handleToggleActive(a)}
                    title={
                      lastSuper
                        ? "Cannot deactivate the last Super Admin"
                        : a.isActive
                          ? "Click to deactivate"
                          : "Click to activate"
                    }
                    style={{
                      ...btnBase,
                      background: a.isActive ? "#dce8e0" : "var(--bg3)",
                      color: a.isActive ? "#1e5c3a" : "var(--text3)",
                      cursor: lastSuper ? "not-allowed" : "pointer",
                      opacity: lastSuper ? 0.5 : 1,
                    }}
                  >
                    {a.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {/* Edit */}
                    <button
                      onClick={() => openEdit(a)}
                      style={{
                        ...btnBase,
                        background: "#dce6f0",
                        color: "#1a3f6e",
                      }}
                    >
                      Edit
                    </button>

                    {/* Delete — disabled when this is the last Super Admin */}
                    <button
                      onClick={() => !lastSuper && handleDelete(a)}
                      disabled={lastSuper}
                      title={
                        lastSuper
                          ? "Cannot delete the last Super Admin account"
                          : "Delete account"
                      }
                      style={{
                        ...btnBase,
                        background: lastSuper ? "var(--bg3)" : "var(--peach)",
                        color: lastSuper ? "var(--text3)" : "var(--peach-dark)",
                        cursor: lastSuper ? "not-allowed" : "pointer",
                        opacity: lastSuper ? 0.5 : 1,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Super Admin note */}
      {superAdminCount <= 1 && (
        <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 10 }}>
          ⚠ At least one Super Admin account must remain. Add another Super
          Admin before deleting or demoting this one.
        </p>
      )}

      {/* Add / Edit modal */}
      {modalMode && (
        <Modal
          title={
            modalMode === "add"
              ? "Add Admin Account"
              : `Edit — ${editTarget?.name}`
          }
          onClose={closeModal}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="Full Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <Input
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              type="email"
              required
              style={{ opacity: modalMode === "edit" ? 0.5 : 1 }}
            />
            {modalMode === "edit" && (
              <p style={{ fontSize: 11, color: "var(--text3)", marginTop: -6 }}>
                Email cannot be changed.
              </p>
            )}
            <Input
              label="Role"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={[
                { value: "SUPER_ADMIN", label: "Super Admin" },
                { value: "MANAGER", label: "Manager" },
                { value: "STAFF", label: "Staff" },
              ]}
            />
            <Input
              label={
                modalMode === "edit"
                  ? "New Password (leave blank to keep current)"
                  : "Temporary Password"
              }
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              type="password"
              required={modalMode === "add"}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Btn
                variant="admin"
                onClick={modalMode === "add" ? handleAdd : handleUpdate}
                style={{ flex: 1 }}
              >
                {modalMode === "add" ? "Create Account" : "Save Changes"}
              </Btn>
              <Btn variant="ghost" onClick={closeModal}>
                Cancel
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ACCESS DENIED FALLBACK ──────────────────────────────────
function AccessDenied() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "var(--text3)",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text2)",
          marginBottom: 6,
        }}
      >
        Access Restricted
      </div>
      <div style={{ fontSize: 13 }}>
        Your account role does not have permission to view this page.
      </div>
    </div>
  );
}

// ─── ADMIN SHELL ──────────────────────────────────────────────
function AdminShell() {
  const { state, dispatch } = useApp();
  const { adminPage } = state;
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // The role stored on the logged-in admin user
  const adminRole = state.currentUser?.role || "STAFF";
  const isSuperAdmin = adminRole === "SUPER_ADMIN";
  const isManager = adminRole === "MANAGER";
  const canManage = isSuperAdmin || isManager;

  // All nav items with the minimum role required — null = any admin
  const ALL_NAV = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "📊",
      section: null,
      roles: null,
    },
    {
      id: "products",
      label: "Products",
      icon: "👕",
      section: "Products",
      roles: null,
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: "📦",
      section: "Products",
      roles: null,
    },
    {
      id: "orders",
      label: "Orders",
      icon: "📋",
      section: "Orders",
      roles: null,
    },
    {
      id: "parents",
      label: "Parents",
      icon: "👨‍👩‍👧",
      section: "Orders",
      roles: null,
    },
    {
      id: "master",
      label: "Master Control",
      icon: "⚙️",
      section: "Settings",
      roles: ["SUPER_ADMIN", "MANAGER"],
    },
    {
      id: "admins",
      label: "Admin Accounts",
      icon: "👤",
      section: "Settings",
      roles: ["SUPER_ADMIN"],
    },
  ];

  const navItems = ALL_NAV.filter(
    (item) => !item.roles || item.roles.includes(adminRole),
  );
  const sections = ["Products", "Orders", "Settings"];
  let lastSection = null;

  return (
    <div
      style={{ display: "flex", minHeight: "100vh", background: "var(--bg2)" }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? 160 : 52,
          background: "var(--sky-dark-bg)",
          flexShrink: 0,
          transition: "width .2s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid rgba(255,255,255,.15)",
          }}
        >
          {state.settings.logoUrl ? (
            <img
              src={state.settings.logoUrl}
              alt="Logo"
              style={{
                width: 24,
                height: 24,
                objectFit: "contain",
                borderRadius: 3,
                flexShrink: 0,
              }}
            />
          ) : (
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {state.settings.logoEmoji}
            </span>
          )}
          {sidebarOpen && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 13,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Wonderworld
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.6)",
              cursor: "pointer",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ☰
          </button>
        </div>
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item, idx) => {
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;
            return (
              <div key={item.id}>
                {showSection && sidebarOpen && (
                  <div
                    style={{
                      padding: "8px 14px 3px",
                      fontSize: 9,
                      fontWeight: 800,
                      color: "rgba(255,255,255,.65)",
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.section}
                  </div>
                )}
                <button
                  onClick={() =>
                    dispatch({ type: "SET_ADMIN_PAGE", page: item.id })
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: sidebarOpen ? "8px 14px" : "8px",
                    background:
                      adminPage === item.id ? "rgba(0,0,0,.2)" : "none",
                    border: "none",
                    color:
                      adminPage === item.id ? "#fff" : "rgba(255,255,255,.92)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: 12,
                    textAlign: "left",
                    transition: ".15s",
                    borderLeft: `3px solid ${adminPage === item.id ? "#e8c86a" : "transparent"}`,
                  }}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  {sidebarOpen && (
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
                      {item.label}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(255,255,255,.15)",
          }}
        >
          <button
            onClick={() => dispatch({ type: "LOGOUT" })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.6)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: 11,
              fontWeight: 600,
              justifyContent: sidebarOpen ? "flex-start" : "center",
            }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            {sidebarOpen && "Sign out"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Admin Top Bar */}
        <div
          style={{
            background: "var(--bg)",
            borderBottom: "1px solid var(--border)",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--text)",
            }}
          >
            {navItems.find((n) => n.id === adminPage)?.label || "Admin"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "var(--sky)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: "var(--sky-dark)",
              }}
            >
              {(state.currentUser?.name || "A").charAt(0)}
            </div>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}
            >
              {state.currentUser?.name || "Admin"}
            </span>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {adminPage === "dashboard" && <AdminDashboard />}
          {adminPage === "parents" && <AdminParents />}
          {adminPage === "products" && <AdminProducts />}
          {adminPage === "inventory" && <AdminInventory />}
          {adminPage === "orders" && <AdminOrders />}
          {adminPage === "master" &&
            (canManage ? <AdminMasterControl /> : <AccessDenied />)}
          {adminPage === "admins" &&
            (isSuperAdmin ? <AdminAdmins /> : <AccessDenied />)}
        </div>
      </div>
    </div>
  );
}

function AdminParents() {
  const { dispatch } = useApp();
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    api(`/api/admin/parents?${params}`)
      .then((data) => setParents(data.parents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  async function handleToggleActive(p) {
    try {
      const updated = await api(`/api/admin/parents/${p.id}`, {
        method: "PUT",
        body: { isActive: !p.isActive },
      });
      setParents(
        parents.map((x) =>
          x.id === updated.id ? { ...x, isActive: updated.isActive } : x,
        ),
      );
      dispatch({
        type: "SET_TOAST",
        message: updated.isActive
          ? `${p.firstName} activated`
          : `${p.firstName} deactivated`,
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update account",
      });
    }
  }

  const tdStyle = {
    padding: "10px 10px",
    borderBottom: "0.5px solid var(--border)",
    fontSize: 13,
  };

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          style={{
            width: "100%",
            maxWidth: 340,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--text3)",
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      ) : parents.length === 0 ? (
        <EmptyState emoji="👨‍👩‍👧" message="No parent accounts found" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Name", "Email", "Phone", "Orders", "Joined", "Status", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="txt-th"
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      background: "var(--bg2)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {parents.map((p) => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>
                  {p.firstName} {p.lastName}
                </td>
                <td style={{ ...tdStyle, color: "var(--text2)" }}>{p.email}</td>
                <td style={tdStyle}>{p.phone || "—"}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: "var(--sky)",
                      color: "var(--sky-dark)",
                      fontWeight: 800,
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 30,
                    }}
                  >
                    {p._count?.orders ?? 0}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: "var(--text3)" }}>
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      color: p.isActive ? "var(--sky-dark)" : "var(--text3)",
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={() => handleToggleActive(p)}
                    style={{
                      padding: "4px 10px",
                      border: "none",
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: p.isActive ? "var(--peach)" : "var(--sky)",
                      color: p.isActive
                        ? "var(--peach-dark)"
                        : "var(--sky-dark)",
                    }}
                  >
                    {p.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  // Inject global CSS once
  useEffect(() => {
    const id = "ww-global-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = GLOBAL_CSS;
      document.head.appendChild(style);
    }
    return () => {}; // leave styles in
  }, []);

  // Restore session from localStorage so a page refresh doesn't log the user out
  useEffect(() => {
    const token = localStorage.getItem("ww_token");
    const role = localStorage.getItem("ww_role");
    if (!token || !role) return;
    // Validate the token is still good by hitting a protected endpoint
    const endpoint =
      role === "admin" ? "/api/admin/settings" : "/api/orders/mine";
    api(endpoint)
      .then(() => {
        // Token still valid — restore the session with a minimal user object.
        // The real user details are loaded per-page (dashboard, etc.).
        const storedUser = (() => {
          try {
            return JSON.parse(localStorage.getItem("ww_user") || "null");
          } catch {
            return null;
          }
        })();
        if (storedUser) dispatch({ type: "LOGIN", user: storedUser, role });
      })
      .catch(() => {
        // Token expired — clear storage
        localStorage.removeItem("ww_token");
        localStorage.removeItem("ww_role");
        localStorage.removeItem("ww_user");
      });
  }, []);

  useEffect(() => {
    async function initAppData() {
      try {
        // Always fetch public data (products, locations, settings, form-fields)
        const [products, locations, settings, formFields] = await Promise.all([
          api("/api/products"),
          api("/api/locations"),
          api("/api/settings"),
          api("/api/form-fields"),
        ]);
        dispatch({
          type: "SET_INITIAL_DATA",
          payload: { products, locations, settings, formFields },
        });
      } catch (err) {
        console.error("Init failed:", err);
      }
    }
    initAppData();
  }, []);
  const showAdminDirect = !state.currentUser && state.view === "admin";

  const [adminLoginLoading, setAdminLoginLoading] = useState(false);

  async function handleAdminLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get("email")?.trim();
    const password = fd.get("password");
    if (!email || !password) {
      dispatch({
        type: "SET_TOAST",
        message: "Please enter email and password",
      });
      return;
    }
    setAdminLoginLoading(true);
    try {
      const data = await api("/api/auth/admin/login", {
        method: "POST",
        body: { email, password },
      });
      localStorage.setItem("ww_token", data.token);
      localStorage.setItem("ww_role", "admin");
      dispatch({ type: "LOGIN", user: data.admin, role: "admin" });
      dispatch({ type: "SET_VIEW", view: "admin", adminPage: "dashboard" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Admin login failed",
      });
    } finally {
      setAdminLoginLoading(false);
    }
  }

  return (
    <AppCtx.Provider value={{ state, dispatch }}>
      <div style={{ fontFamily: "var(--font-body)" }}>
        {/* Admin direct login */}
        {showAdminDirect && (
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(160deg,#d6ede5 0%,#f5f3ef 60%,#fdf8ec 100%)",
              padding: 16,
            }}
          >
            <div
              className="animate-pop"
              style={{
                background: "var(--bg)",
                borderRadius: "var(--radius)",
                padding: 32,
                width: "100%",
                maxWidth: 360,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: "var(--sky)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    margin: "0 auto 12px",
                  }}
                >
                  🏫
                </div>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 20,
                    color: "var(--sky-dark-bg)",
                  }}
                >
                  Admin Portal
                </h1>
                <p
                  style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}
                >
                  Wonderworld Admin Dashboard
                </p>
              </div>
              <form
                onSubmit={handleAdminLogin}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  name="email"
                  type="email"
                  placeholder="admin@school.com"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    background: "var(--bg)",
                    color: "var(--text)",
                    outline: "none",
                    marginBottom: 4,
                  }}
                />
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    background: "var(--bg)",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "11px",
                    background: "var(--sky-dark-bg)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {adminLoginLoading ? "Logging in…" : "Log In to Admin"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "SET_VIEW",
                      view: "parent",
                      parentPage: "login",
                    })
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text3)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  ← Parent Portal
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Main app */}
        {!showAdminDirect && (
          <>
            {/* View switcher (demo only) */}
            {!state.currentUser && (
              <div
                style={{
                  position: "fixed",
                  top: 12,
                  right: 12,
                  zIndex: 500,
                  display: "flex",
                  gap: 6,
                }}
              >
                <button
                  onClick={() =>
                    dispatch({
                      type: "SET_VIEW",
                      view: "parent",
                      parentPage: "login",
                    })
                  }
                  style={{
                    padding: "5px 12px",
                    borderRadius: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1.5px solid",
                    borderColor:
                      state.view === "parent"
                        ? "var(--sky-dark-bg)"
                        : "var(--border)",
                    background:
                      state.view === "parent"
                        ? "var(--sky-dark-bg)"
                        : "rgba(255,255,255,.9)",
                    color: state.view === "parent" ? "#fff" : "var(--text2)",
                  }}
                >
                  Parent
                </button>
                <button
                  onClick={() =>
                    dispatch({
                      type: "SET_VIEW",
                      view: "admin",
                      adminPage: "dashboard",
                    })
                  }
                  style={{
                    padding: "5px 12px",
                    borderRadius: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1.5px solid",
                    borderColor:
                      state.view === "admin"
                        ? "var(--sky-dark-bg)"
                        : "var(--border)",
                    background:
                      state.view === "admin"
                        ? "var(--sky-dark-bg)"
                        : "rgba(255,255,255,.9)",
                    color: state.view === "admin" ? "#fff" : "var(--text2)",
                  }}
                >
                  Admin
                </button>
              </div>
            )}
            {(state.userRole === "parent" ||
              (state.view === "parent" && !state.currentUser)) && (
              <ParentShell />
            )}
            {(state.userRole === "admin" ||
              (state.view === "admin" && state.currentUser)) && <AdminShell />}
          </>
        )}

        {/* Toast Notification */}
        {state.toast && (
          <Toast
            message={state.toast}
            onClose={() => dispatch({ type: "CLEAR_TOAST" })}
          />
        )}
      </div>
    </AppCtx.Provider>
  );
}
