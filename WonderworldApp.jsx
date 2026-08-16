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
  useMemo,
} from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import logo from "./public/logo-1777057887021.jpg";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const POLICY_NOTICE = (
  <div
    style={{
      background: "var(--lemon)",
      border: "1px solid var(--lemon-mid)",
      borderRadius: "var(--radius-sm)",
      padding: "12px 14px",
      fontSize: 12,
      color: "var(--lemon-dark)",
      lineHeight: 1.6,
      marginTop: 12,
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: 4 }}>
      📋 Return & Exchange Policy
    </div>
    <p style={{ margin: "0 0 6px 0" }}>
      All uniform orders are final — we are unable to issue refunds once an
      order has been placed and paid. Size exchanges may be available depending
      on current stock availability.
    </p>
    <p style={{ margin: 0 }}>
      <strong>Pick-Up:</strong> You will receive an email when your uniform
      order is ready for pick-up at the school front desk.
    </p>
  </div>
);

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

function displaySize(s) {
  if (!s) return s;
  return s.replace(/^T(\d+)$/, "$1T");
}

function sortSizes(sizes) {
  if (!sizes || !Array.isArray(sizes)) return [];
  return [...sizes].sort((a, b) => {
    const prefixA = a.replace(/\d/g, "");
    const prefixB = b.replace(/\d/g, "");
    const numA = parseInt(a.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.replace(/\D/g, "")) || 0;
    if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
    return numA - numB;
  });
}

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
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
  adminEmails: "",
  orderStockThreshold: 0,
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

const CHANGE_REQUEST_STYLES = {
  PENDING: {
    bg: "var(--peach)",
    color: "var(--peach-dark)",
    label: "⏳ Size Change Request Pending",
  },
  APPROVED: {
    bg: "var(--mint)",
    color: "var(--mint-dark)",
    label: "✓ Size Change Request Approved",
  },
  REJECTED: {
    bg: "var(--peach)",
    color: "var(--peach-dark)",
    label: "✕ Size Change Request Rejected",
  },
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
  --sky-bg:#fdf0e6;      --sky-mid-bg:#e8833a;   --sky-dark-bg:#86BAAF ;
  --sky-bg:#fdf0e6;      --sky-mid-bg:#86BAAF;   --ww-bg:#FF9E3E ;
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
  --font-size-table: 13px;
}
body { font-family:var(--font-body); color:var(--text); background:#fff; min-height:100vh; }
button { cursor:pointer; font-family:var(--font-body);  }
input,select,textarea { font-family:var(--font-body); }
::-webkit-scrollbar { width:5px; height:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:10px; }

/* ── Parent portal premium overrides ────────────────────── */
.pp-input {
  width:100%; padding:12px 14px;
  border:1.5px solid #e5e7eb;
  border-radius:8px; font-size:14px;
  background:#fff; color:#111;
  outline:none; transition:border-color .15s;
  font-family:var(--font-body);
}
.pp-input:focus { border-color:#111; }
.pp-label { font-size:12px; font-weight:600; color:#555; margin-bottom:5px; display:block; letter-spacing:.02em; }
.pp-card {
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:12px;
  overflow:hidden;
}
.pp-section-title { font-size:20px; font-weight:700; color:#111; letter-spacing:-.02em; margin-bottom:20px; }
.pp-divider { height:1px; background:#f3f4f6; margin:20px 0; }
.pp-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:4px 10px; border-radius:20px;
  font-size:11px; font-weight:700; letter-spacing:.02em;
}
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
.txt-badge    { font-size:12px; font-weight:800; white-space:nowrap; }
.txt-th       { font-size:13px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--text3); }
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
          position: "sticky",
          top: "1px",
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

  // if (!message) return null; // ← add this line
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
        children: action.user?.children || [],
      };
    case "SET_CHILDREN":
      return { ...state, children: action.children };
    case "LOGOUT":
      localStorage.removeItem("ww_token");
      localStorage.removeItem("ww_role");
      localStorage.removeItem("ww_user");
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
    case "UPDATE_CART_SIZE": {
      const cart = [...state.cart];
      const item = cart[action.index];
      if (!item || item.size === action.size) return state;
      // If another line already has this product+size, merge quantities
      // into it instead of creating a duplicate row.
      const dupIndex = cart.findIndex(
        (i, idx) =>
          idx !== action.index &&
          i.productId === item.productId &&
          i.size === action.size,
      );
      if (dupIndex >= 0) {
        cart[dupIndex] = {
          ...cart[dupIndex],
          quantity: cart[dupIndex].quantity + item.quantity,
        };
        cart.splice(action.index, 1);
        return { ...state, cart };
      }
      cart[action.index] = { ...item, size: action.size };
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
  children: [],
};

// ══════════════════════════════════════════════════════════════
//  PARENT SCREENS
// ══════════════════════════════════════════════════════════════

function ParentLogin() {
  const { dispatch, state } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isReg, setIsReg] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    children: [{ firstName: "", lastName: "", class: "" }],
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;

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
      if (data.mustChangePassword) {
        dispatch({ type: "SET_PARENT_PAGE", page: "changePassword" });
      } else {
        navigate("/parent");
      }
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
    if (form.password !== form.confirmPassword) {
      dispatch({ type: "SET_TOAST", message: "Passwords do not match" });
      return;
    }
    if (!form.children || form.children.length === 0) {
      dispatch({ type: "SET_TOAST", message: "Please add at least one child" });
      return;
    }
    if (
      form.children.some((c) => !c.firstName?.trim() || !c.lastName?.trim())
    ) {
      dispatch({
        type: "SET_TOAST",
        message: "Please enter a name for each child",
      });
      return;
    }
    if (form.children.some((c) => !c.class?.trim())) {
      dispatch({
        type: "SET_TOAST",
        message: "Please enter a class for each child",
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
      api("/api/parents/children")
        .then((children) => dispatch({ type: "SET_CHILDREN", children }))
        .catch(() => {});
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

  // Shared styles matching the premium centered-card design
  const cardInputWrap = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#eef2f7",
    borderRadius: 10,
    padding: "13px 16px",
    border: "1.5px solid transparent",
    transition: "border-color .15s, background .15s",
  };
  const cardInput = {
    flex: 1,
    border: "none",
    outline: "none",
    background: "none",
    fontSize: 14,
    color: "#222",
    fontFamily: "var(--font-body)",
  };
  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "#555",
    marginBottom: 6,
    display: "block",
  };
  const plainInput = {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-body)",
    background: "#fff",
    color: "#111",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(150deg, #d3e8de 0%, #e7e9ec 45%, #f3ede1 100%)",
        padding: 24,
      }}
    >
      <div
        className="animate-pop"
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: isReg ? "40px 36px" : "44px 40px",
          width: "100%",
          maxWidth: isReg ? 480 : 440,
          boxShadow: "0 24px 60px rgba(0,0,0,.12)",
        }}
      >
        {/* ── Logo + title ─────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 120,
              height: 64,
              borderRadius: 10,
              margin: "0 auto 18px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            {/* {state.settings.logoUrl && (
              <img
                src={state.settings.logoUrl}
                alt="Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            )} */}
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#5e9483",
              letterSpacing: "-.01em",
              marginBottom: 6,
            }}
          >
            {state.settings.systemName}
          </h1>
          <p style={{ fontSize: 14, color: "#7a8389", margin: 0 }}>
            {isReg ? "Create your parent account" : "Parent Portal"}
          </p>
        </div>

        {/* ── Login form ───────────────────────────────── */}
        {!isReg ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={cardInputWrap}>
              <span style={{ fontSize: 16, color: "#8a96a3" }}>✉</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                style={cardInput}
              />
            </div>
            <div style={cardInputWrap}>
              <span style={{ fontSize: 16, color: "#8a96a3" }}>🔒</span>
              <input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Password"
                style={cardInput}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                  color: "#8a96a3",
                  padding: 0,
                }}
                type="button"
                aria-label="Toggle password visibility"
              >
                {showPass ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button
              onClick={handleLogin}
              disabled={loginLoading}
              style={{
                width: "100%",
                padding: "14px",
                background: loginLoading ? "#a9c4ba" : "#6fa595",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: loginLoading ? "not-allowed" : "pointer",
                marginTop: 6,
                fontFamily: "var(--font-body)",
                transition: "background .15s",
              }}
              onMouseEnter={(e) => {
                if (!loginLoading) e.currentTarget.style.background = "#5e9483";
              }}
              onMouseLeave={(e) => {
                if (!loginLoading) e.currentTarget.style.background = "#6fa595";
              }}
            >
              {loginLoading ? "Signing in…" : "Sign In"}
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "6px 0",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "#e9ecef" }} />
              <span style={{ fontSize: 12, color: "#aab2b9" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#e9ecef" }} />
            </div>

            <button
              onClick={() => setIsReg(true)}
              style={{
                width: "100%",
                padding: "13px",
                background: "#fff",
                color: "#5e9483",
                border: "1.5px solid #cfe2da",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Create an account
            </button>

            <p
              style={{
                fontSize: 12,
                color: "#9aa2a8",
                textAlign: "center",
                marginTop: 6,
              }}
            >
              Forgot your password? Contact us at{" "}
              <a
                href="mailto:info@wonderworldmontessori.ca"
                style={{
                  color: "#5e9483",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                info@wonderworldmontessori.ca
              </a>
            </p>
          </div>
        ) : (
          /* ── Register form ─────────────────────────── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>First Name *</label>
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  placeholder="Jane"
                  style={plainInput}
                  onFocus={(e) => (e.target.style.borderColor = "#6fa595")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  placeholder="Smith"
                  style={plainInput}
                  onFocus={(e) => (e.target.style.borderColor = "#6fa595")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email address *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="parent@email.com"
                style={plainInput}
                onFocus={(e) => (e.target.style.borderColor = "#6fa595")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="123-456-7890"
                style={plainInput}
                onFocus={(e) => (e.target.style.borderColor = "#6fa595")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="Create a password"
                  style={plainInput}
                  onFocus={(e) => (e.target.style.borderColor = "#6fa595")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
              </div>
              <div>
                <label style={labelStyle}>Re-enter Password *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  style={plainInput}
                  onFocus={(e) => (e.target.style.borderColor = "#6fa595")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ ...labelStyle, fontSize: 13, color: "#111" }}>
                  Children
                </label>
                <span style={{ fontSize: 12, color: "#888" }}>
                  At least one child is required
                </span>
              </div>
              {form.children.map((child, i) => (
                <div
                  key={i}
                  style={{
                    background: "#f9fafb",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "14px 16px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#555",
                        letterSpacing: ".04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Child {form.children.length > 1 ? i + 1 : ""}
                    </span>
                    {form.children.length > 1 && (
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            children: form.children.filter((_, j) => j !== i),
                          })
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f87171",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>First Name *</label>
                      <input
                        placeholder="Child's first name"
                        value={child.firstName || ""}
                        onChange={(e) => {
                          const updated = [...form.children];
                          updated[i] = {
                            ...updated[i],
                            firstName: e.target.value,
                          };
                          setForm({ ...form, children: updated });
                        }}
                        style={plainInput}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "#6fa595")
                        }
                        onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Last Name *</label>
                      <input
                        placeholder="Child's last name"
                        value={child.lastName || ""}
                        onChange={(e) => {
                          const updated = [...form.children];
                          updated[i] = {
                            ...updated[i],
                            lastName: e.target.value,
                          };
                          setForm({ ...form, children: updated });
                        }}
                        style={plainInput}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "#6fa595")
                        }
                        onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Class *</label>
                    <input
                      placeholder="e.g. K1, Grade 2"
                      value={child.class || ""}
                      onChange={(e) => {
                        const updated = [...form.children];
                        updated[i] = { ...updated[i], class: e.target.value };
                        setForm({ ...form, children: updated });
                      }}
                      style={plainInput}
                      onFocus={(e) => (e.target.style.borderColor = "#6fa595")}
                      onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  setForm({
                    ...form,
                    children: [
                      ...form.children,
                      { firstName: "", lastName: "", class: "" },
                    ],
                  })
                }
                style={{
                  width: "100%",
                  fontSize: 13,
                  color: "#5e9483",
                  background: "#eef6f2",
                  border: "1.5px dashed #b9d9cb",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "10px 16px",
                  fontFamily: "var(--font-body)",
                }}
              >
                + Add another child
              </button>
            </div>

            <button
              onClick={handleRegister}
              disabled={loginLoading}
              style={{
                width: "100%",
                padding: "14px",
                background: loginLoading ? "#a9c4ba" : "#6fa595",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: loginLoading ? "not-allowed" : "pointer",
                marginTop: 4,
                fontFamily: "var(--font-body)",
                transition: "background .15s",
              }}
              onMouseEnter={(e) => {
                if (!loginLoading) e.currentTarget.style.background = "#5e9483";
              }}
              onMouseLeave={(e) => {
                if (!loginLoading) e.currentTarget.style.background = "#6fa595";
              }}
            >
              {loginLoading ? "Creating account…" : "Create Account"}
            </button>

            <p style={{ textAlign: "center", fontSize: 13, color: "#888" }}>
              Already registered?{" "}
              <button
                onClick={() => setIsReg(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#5e9483",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "var(--font-body)",
                }}
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
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
  const [cat, setCat] = useState("All Items");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addSize, setAddSize] = useState("");
  const { cart } = state;
  const [addQty, setAddQty] = useState(1);
  const [stockMap, setStockMap] = useState({}); // { "productId-size": availableQty }
  const cats = [
    "Tops",
    "Bottoms",
    "Event Essentials",
    "Outdoor Wear",
    "All Items",
  ];
  const [modalAlert, setModalAlert] = useState("");
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;
  useEffect(() => {
    api("/api/admin/inventory/available")
      .then((data) => setStockMap(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedProduct]);

  // Products come from initAppData via SET_INITIAL_DATA.
  // Show a loading message until at least one product arrives.
  const productsLoaded = state.products.length > 0;
  const filtered = state.products
    .filter((p) => p.isActive && (cat === "All Items" || p.category === cat))
    .sort((a, b) => {
      if (cat !== "All Items") return a.name.localeCompare(b.name);
      const ai = cats.indexOf(a.category ?? "");
      const bi = cats.indexOf(b.category ?? "");
      const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name);
    });
  // const filtered = state.products
  //   .filter((p) => p.isActive && (cat === "All Items" || p.category === cat))
  //   .sort((a, b) => a.name.localeCompare(b.name));
  const orderStockThreshold = state.settings.orderStockThreshold ?? 0;

  // Set of "productId-size" keys that are blocked
  const unavailableKeys = new Set(
    orderStockThreshold > 0
      ? Object.entries(stockMap)
          .filter(([, available]) => available <= orderStockThreshold)
          .map(([key]) => key)
      : [],
  );

  function isProductFullyUnavailable(p) {
    if (orderStockThreshold === 0) return false;
    return sortSizes(p.sizes).every((s) => unavailableKeys.has(`${p.id}-${s}`));
  }

  function handleAddToCart() {
    // ── Minimum Order Stock check ──
    if (orderStockThreshold > 0) {
      const available = stockMap[`${selectedProduct.id}-${addSize}`];
      // 1. Minimum stock threshold check — block if at or below threshold
      if (orderStockThreshold > 0 && available <= orderStockThreshold) {
        setModalAlert(
          `${displaySize(addSize)} is currently unavailable for ordering.`,
        );
        return;
      }

      // 2. Quantity check — block if requested qty exceeds available
      // Check how many are already in the cart for this product+size
      const existingCartItem = cart.find(
        (c) => c.productId === selectedProduct.id && c.size === addSize,
      );
      const alreadyInCart = existingCartItem ? existingCartItem.quantity : 0;
      const totalRequested = alreadyInCart + addQty;

      // Block if total requested (cart + new) exceeds available stock
      if (available !== undefined && totalRequested > available) {
        const remaining = Math.max(0, available - alreadyInCart);
        setModalAlert(
          available === 0
            ? `${displaySize(addSize)} is out of stock.`
            : alreadyInCart >= available
              ? `You already have all ${available} available for ${displaySize(addSize)} in your cart.`
              : alreadyInCart === 0
                ? `Only ${remaining} available for ${displaySize(addSize)}.`
                : `Only ${remaining} more available for ${displaySize(addSize)} — you already have ${alreadyInCart} in your cart.`,
        );
        return;
      }
    }
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
      {/* ── Announcement banner ──────────────────────── */}
      {state.settings.noticeText && (
        <div
          style={{
            background: "#111",
            color: "#fff",
            textAlign: "center",
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: ".04em",
            marginBottom: 0,
          }}
        >
          {state.settings.noticeText}
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                padding: "7px 16px",
                borderRadius: 40,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: `1.5px solid ${cat === c ? "#111" : "#e5e7eb"}`,
                background: cat === c ? "#111" : "#fff",
                color: cat === c ? "#fff" : "#555",
                transition: "all .15s",
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: "#888" }}>
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Product grid ─────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
          gap: isDesktop ? 28 : 14,
        }}
      >
        {filtered.map((p) => {
          const fullyUnavailable = isProductFullyUnavailable(p);
          return (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProduct(p);
                setAddSize("");
                setAddQty(1);
              }}
              style={{
                cursor: fullyUnavailable ? "not-allowed" : "pointer",
                background: "#fff",
                opacity: fullyUnavailable ? 0.45 : 1,
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!fullyUnavailable)
                  e.currentTarget.querySelector(
                    ".pp-img-wrap",
                  ).style.transform = "scale(1.03)";
              }}
              onMouseLeave={(e) => {
                if (!fullyUnavailable)
                  e.currentTarget.querySelector(
                    ".pp-img-wrap",
                  ).style.transform = "scale(1)";
              }}
            >
              {fullyUnavailable && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    zIndex: 2,
                    background: "#111",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    padding: "4px 10px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                  }}
                >
                  Unavailable
                </div>
              )}
              {/* Image */}
              <div
                style={{
                  aspectRatio: "4/5",
                  overflow: "hidden",
                  borderRadius: 10,
                  background: "#f3f4f6",
                  marginBottom: 12,
                }}
              >
                <div
                  className="pp-img-wrap"
                  style={{
                    width: "100%",
                    height: "100%",
                    transition: "transform .4s ease",
                  }}
                >
                  <ProductImageGallery
                    images={p.images}
                    imageEmoji={p.imageEmoji}
                    imageBg={p.imageBg}
                    height="100%"
                    showThumbs={false}
                  />
                </div>
              </div>

              {/* Info */}
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111",
                    marginBottom: 3,
                    lineHeight: 1.3,
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#111",
                    marginBottom: 8,
                  }}
                >
                  ${p.sellingPrice.toFixed(2)}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {sortSizes(p.sizes).map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "3px 7px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#888",
                        background: "#fafafa",
                      }}
                    >
                      {displaySize(s)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {/* {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => {
              setSelectedProduct(p);
              setAddSize("");
              setAddQty(1);
            }}
            style={{ cursor: "pointer", background: "#fff" }}
            onMouseEnter={(e) =>
              (e.currentTarget.querySelector(".pp-img-wrap").style.transform =
                "scale(1.03)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.querySelector(".pp-img-wrap").style.transform =
                "scale(1)")
            }
          >
            <div
              style={{
                aspectRatio: "3/4",
                overflow: "hidden",
                borderRadius: 10,
                background: "#f3f4f6",
                marginBottom: 12,
              }}
            >
              <div
                className="pp-img-wrap"
                style={{
                  width: "100%",
                  height: "100%",
                  transition: "transform .4s ease",
                }}
              >
                <ProductImageGallery
                  images={p.images}
                  imageEmoji={p.imageEmoji}
                  imageBg={p.imageBg}
                  height="100%"
                  showThumbs={false}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111",
                  marginBottom: 3,
                  lineHeight: 1.3,
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#111",
                  marginBottom: 8,
                }}
              >
                ${p.sellingPrice.toFixed(2)}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {sortSizes(p.sizes).map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "3px 7px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#888",
                      background: "#fafafa",
                    }}
                  >
                    {displaySize(s)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))} */}
      </div>

      {filtered.length === 0 && (
        <div
          style={{ textAlign: "center", padding: "60px 20px", color: "#999" }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>👕</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            No products in this category
          </div>
        </div>
      )}

      {/* ── Premium product detail modal ──────────── */}
      {selectedProduct &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,.5)",
              zIndex: 9999,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "40px 16px",
              overflowY: "auto",
            }}
            onClick={() => {
              setSelectedProduct(null);
              setModalAlert("");
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-pop"
              style={{
                background: "#fff",
                borderRadius: 16,
                width: "100%",
                maxWidth: 860,
                maxHeight: "90vh",
                overflowY: "auto",
                display: "flex",
                flexDirection: isDesktop ? "row" : "column",
                boxShadow: "0 24px 80px rgba(0,0,0,.2)",
              }}
            >
              {/* Left — image */}
              <div
                style={{
                  flex: isDesktop ? "0 0 44%" : "none",
                  aspectRatio: isDesktop ? "unset" : "4/3",
                  background: "#f3f4f6",
                  borderRadius: isDesktop ? "16px 0 0 16px" : "16px 16px 0 0",
                  overflow: "hidden",
                  minHeight: isDesktop ? 420 : 240,
                }}
              >
                <ProductImageGallery
                  images={selectedProduct.images}
                  imageEmoji={selectedProduct.imageEmoji}
                  imageBg={selectedProduct.imageBg}
                  height="100%"
                  showThumbs={true}
                />
              </div>

              {/* Right — info */}
              <div
                style={{
                  flex: 1,
                  padding: isDesktop ? "36px 36px 32px" : "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Close */}
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setModalAlert("");
                  }}
                  style={{
                    alignSelf: "flex-end",
                    background: "none",
                    border: "none",
                    fontSize: 20,
                    color: "#aaa",
                    cursor: "pointer",
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ✕
                </button>

                {/* Name + price */}
                <div>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#111",
                      letterSpacing: "-.02em",
                      marginBottom: 6,
                    }}
                  >
                    {selectedProduct.name}
                  </h2>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#111" }}>
                    ${selectedProduct.sellingPrice.toFixed(2)}
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <p
                    style={{
                      fontSize: 14,
                      color: "#555",
                      lineHeight: 1.6,
                      whiteSpace: "pre-line", // ← add
                    }}
                  >
                    {selectedProduct.description}
                  </p>
                )}

                {/* Size selector */}
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#888",
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    Size{" "}
                    {addSize && (
                      <span
                        style={{
                          fontWeight: 400,
                          color: "#111",
                          textTransform: "none",
                          letterSpacing: 0,
                        }}
                      >
                        — {displaySize(displaySize(addSize))}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {sortSizes(selectedProduct?.sizes).map((s) => {
                      const sizeUnavailable =
                        orderStockThreshold > 0 &&
                        unavailableKeys.has(`${selectedProduct.id}-${s}`);
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            if (!sizeUnavailable) setAddSize(s);
                          }}
                          disabled={sizeUnavailable}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: sizeUnavailable ? "not-allowed" : "pointer",
                            border: `2px solid ${addSize === s ? "#111" : "#e5e7eb"}`,
                            background: sizeUnavailable
                              ? "#f3f4f6"
                              : addSize === s
                                ? "#111"
                                : "#fff",
                            color: sizeUnavailable
                              ? "#bbb"
                              : addSize === s
                                ? "#fff"
                                : "#555",
                            transition: "all .15s",
                            minWidth: 52,
                            textDecoration: sizeUnavailable
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {displaySize(s)}
                        </button>
                      );
                    })}
                    {/* {sortSizes(selectedProduct?.sizes).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setAddSize(s); setModalAlert(""); }}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          border: `2px solid ${addSize === s ? "#111" : "#e5e7eb"}`,
                          background: addSize === s ? "#111" : "#fff",
                          color: addSize === s ? "#fff" : "#555",
                          transition: "all .15s",
                          minWidth: 52,
                        }}
                      >
                        {displaySize(s)}
                      </button>
                    ))} */}
                  </div>
                </div>

                {/* Quantity */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#888",
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Qty
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1.5px solid #e5e7eb",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => {
                        setAddQty(Math.max(1, addQty - 1));
                        setModalAlert("");
                      }}
                      style={{
                        width: 38,
                        height: 38,
                        background: "none",
                        border: "none",
                        fontSize: 18,
                        color: "#555",
                        cursor: "pointer",
                        fontWeight: 300,
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        width: 36,
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {addQty}
                    </span>
                    <button
                      onClick={() => {
                        setAddQty(addQty + 1);
                        setModalAlert("");
                      }}
                      style={{
                        width: 38,
                        height: 38,
                        background: "none",
                        border: "none",
                        fontSize: 18,
                        color: "#555",
                        cursor: "pointer",
                        fontWeight: 300,
                      }}
                    >
                      +
                    </button>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#111",
                    }}
                  >
                    ${(selectedProduct.sellingPrice * addQty).toFixed(2)}
                  </span>
                </div>

                {/* Stock alert */}
                {modalAlert && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1.5px solid #fca5a5",
                      borderRadius: 8,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#dc2626",
                          marginBottom: 2,
                        }}
                      >
                        Unable to add to cart
                      </div>
                      <div style={{ fontSize: 13, color: "#7f1d1d" }}>
                        {modalAlert}
                      </div>
                    </div>
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={handleAddToCart}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#111",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: ".01em",
                    transition: "background .15s",
                    marginTop: 4,
                  }}
                  onMouseEnter={(e) => (e.target.style.background = "#333")}
                  onMouseLeave={(e) => (e.target.style.background = "#111")}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ParentCart({ cartForm, setCartForm }) {
  const { state, dispatch } = useApp();
  const { cart, locations, settings, formFields } = state;
  const form = cartForm;
  const setForm = setCartForm;

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isFirstOrder, setIsFirstOrder] = useState(true);
  const [stockMap, setStockMap] = useState({}); // { "productId-size": availableQty }
  const [stockWarnings, setStockWarnings] = useState({}); // { "productId-size": message }
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const threshold = settings.discountThreshold;
  const childNameFilled = form.childName?.trim().length > 0;
  const discountRate = state.settings.discountRate || 0;
  const discountEnabled = discountRate > 0;
  const appliedRate =
    discountEnabled && subtotal >= threshold && isFirstOrder && childNameFilled
      ? discountRate
      : 0;
  const discountAmount = subtotal * appliedRate;
  const total = subtotal - discountAmount;
  const discountPct = Math.round(discountRate * 100); // e.g. 0.15 → 15

  const visibleFields = formFields.filter((f) => f.isVisible);
  const hasStockWarning = Object.keys(stockWarnings).length > 0;
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;

  useEffect(() => {
    api("/api/admin/inventory/available")
      .then((data) => setStockMap(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const name = form.childName?.trim();
    if (!name) {
      setIsFirstOrder(true);
      return;
    }
    const child = state.children.find(
      (c) => `${c.firstName} ${c.lastName}` === name,
    );
    const params = child
      ? `childId=${child.id}`
      : `childName=${encodeURIComponent(name)}`;
    api(`/api/orders/check-first-order?${params}`)
      .then((data) => setIsFirstOrder(data.isFirstOrder))
      .catch(() => setIsFirstOrder(true));
  }, [form.childName]);

  useEffect(() => {
    if (state.children.length === 1) {
      setForm((f) => ({
        ...f,
        childName: `${state.children[0].firstName} ${state.children[0].lastName}`,
        childClass: state.children[0].class || f.childClass,
      }));
    }
  }, [state.children]);

  async function handleSubmit() {
    if (submitting) return;
    const required = visibleFields.filter(
      (f) => f.isRequired && f.fieldKey !== "parentName",
    );
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
    for (const item of cart) {
      const key = `${item.productId}-${item.size}`;
      const available = stockMap[key];
      if (available !== undefined && item.quantity > available) {
        dispatch({
          type: "SET_TOAST",
          message:
            available === 0
              ? `${item.productName} (${displaySize(item.size)}) is out of stock.`
              : `Only ${available} available for ${item.productName} (${displaySize(item.size)}), but you have ${item.quantity} in your cart.`,
        });
        return;
      }
    }
    setSubmitting(true);
    const child = state.children.find(
      (c) => `${c.firstName} ${c.lastName}` === form.childName,
    );
    try {
      const newOrder = await api("/api/orders", {
        method: "POST",
        body: {
          ...form,
          childId: child?.id || null,
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
      setCartForm({
        childName: "",
        childClass: "",
        parentName: "",
        parentPhone: "",
        locationId: "",
        notes: "",
      });
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
        style={{
          textAlign: "center",
          padding: "80px 24px",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#f0fdf4",
            border: "2px solid #16a34a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            margin: "0 auto 20px",
          }}
        >
          ✓
        </div>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#111",
            letterSpacing: "-.02em",
            marginBottom: 10,
          }}
        >
          Order Confirmed
        </h2>
        <p
          style={{
            color: "#666",
            fontSize: 15,
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          Your order has been received. We&apos;ll send you an email when
          it&apos;s ready for pick-up.
        </p>
        {POLICY_NOTICE}
        <div style={{ marginTop: 20 }}>
          <Btn
            onClick={() => {
              setSubmitted(false);
              dispatch({ type: "SET_PARENT_PAGE", page: "orders" });
            }}
          >
            View My Orders
          </Btn>
        </div>
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

  const DiscountMsg = () => {
    if (!discountEnabled) return null;
    if (subtotal >= threshold) {
      if (childNameFilled && isFirstOrder)
        return (
          <span style={{ color: "var(--sky-dark)", fontWeight: 700 }}>
            🎉 {discountPct}% first-order discount applied!
          </span>
        );
      else if (state.children.length > 1 && !childNameFilled)
        return (
          <span style={{ color: "var(--lemon-dark)", fontWeight: 600 }}>
            💡 Select a child in the Delivery Details section below to check if
            you qualify for the ${discountPct}% first-order discount
          </span>
        );
    } else if (state.children.length > 1 && !childNameFilled)
      return (
        <span>
          💡 Select a child and add $${(threshold - subtotal).toFixed(2)} more
          to unlock a potential ${discountPct}% first-order discount
        </span>
      );
    else if (childNameFilled && isFirstOrder)
      return (
        <span>
          💡 Add $${(threshold - subtotal).toFixed(2)} more to unlock a
          potential ${discountPct}% first-order discount
        </span>
      );
  };

  return (
    <div
      className="animate-fade"
      style={{
        display: "grid",
        gridTemplateColumns: isDesktop ? "1fr" : "1fr 380px",
        gap: 32,
        alignItems: "start",
      }}
    >
      {/* Left — Cart Items + Delivery */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#111",
            letterSpacing: "-.02em",
            marginBottom: 4,
          }}
        >
          Your Cart
        </h2>
        <p style={{ fontSize: 14, color: "#888" }}>
          {cart.length} item{cart.length !== 1 ? "s" : ""}
        </p>
      </div>
      {/* Cart Items */}
      <div
        style={{
          border: "1.5px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f3f4f6",
            background: "#fafafa",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#555",
              letterSpacing: ".04em",
              textTransform: "uppercase",
            }}
          >
            Items ({cart.length})
          </span>
        </div>
        <div style={{ padding: "0 4px" }}>
          {cart.map((item, i) => (
            <>
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
                  <div style={{ marginTop: 3 }}>
                    <select
                      value={item.size}
                      onChange={(e) => {
                        const newSize = e.target.value;
                        if (newSize === item.size) return;
                        const oldKey = `${item.productId}-${item.size}`;
                        const newKey = `${item.productId}-${newSize}`;
                        const available = stockMap[newKey];
                        setStockWarnings((w) => {
                          const n = { ...w };
                          delete n[oldKey];
                          if (
                            available !== undefined &&
                            item.quantity > available
                          ) {
                            n[newKey] =
                              available === 0
                                ? `${item.productName} (${displaySize(newSize)}) is out of stock.`
                                : `Only ${available} available for ${item.productName} (${displaySize(newSize)})`;
                          } else {
                            delete n[newKey];
                          }
                          return n;
                        });
                        dispatch({
                          type: "UPDATE_CART_SIZE",
                          index: i,
                          size: newSize,
                        });
                      }}
                      style={{
                        fontSize: 11,
                        color: "var(--text3)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        padding: "2px 4px",
                        background: "var(--bg)",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      {sortSizes(
                        state.products.find((p) => p.id === item.productId)
                          ?.sizes || [item.size],
                      ).map((s) => (
                        <option key={s} value={s}>
                          Size {displaySize(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => {
                      const key = `${item.productId}-${item.size}`;
                      const newQty = item.quantity - 1;

                      if (newQty < 1) {
                        // Remove from cart and clear warning
                        setStockWarnings((w) => {
                          const n = { ...w };
                          delete n[key];
                          return n;
                        });
                        dispatch({ type: "REMOVE_FROM_CART", index: i });
                        return;
                      }

                      // Decrement and clear warning if now within available stock
                      const available = stockMap[key];
                      if (available === undefined || newQty <= available) {
                        setStockWarnings((w) => {
                          const n = { ...w };
                          delete n[key];
                          return n;
                        });
                      }

                      dispatch({
                        type: "UPDATE_CART_QTY",
                        index: i,
                        qty: newQty,
                      });
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
                    onClick={() => {
                      const key = `${item.productId}-${item.size}`;
                      const available = stockMap[key];
                      const newQty = item.quantity + 1;

                      if (available !== undefined && newQty > available) {
                        // Show warning under this item, don't increment
                        setStockWarnings((w) => ({
                          ...w,
                          [key]: `Only ${available} available for ${item.productName} (${displaySize(item.size)})`,
                        }));
                        return;
                      }

                      // Clear any existing warning and increment
                      setStockWarnings((w) => {
                        const n = { ...w };
                        delete n[key];
                        return n;
                      });
                      dispatch({
                        type: "UPDATE_CART_QTY",
                        index: i,
                        qty: newQty,
                      });
                    }}
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
                  onClick={() =>
                    dispatch({ type: "REMOVE_FROM_CART", index: i })
                  }
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
              {stockWarnings[`${item.productId}-${item.size}`] && (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: "var(--peach-dark)",
                    fontWeight: 600,
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ⚠ {stockWarnings[`${item.productId}-${item.size}`]}
                </div>
              )}
            </>
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
                      {discountPct}% — First Order ≥ ${threshold}
                    </span>
                  </span>
                  <span style={{ color: "var(--peach-dark)", fontWeight: 700 }}>
                    −$
                    {isNaN(discountAmount) ? "0.00" : discountAmount.toFixed(2)}
                  </span>
                </div>
              </>
            )}
            {subtotal > 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--lemon-dark)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {DiscountMsg()}
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
        </div>

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
                [
                  "childName",
                  "childClass",
                  "parentName",
                  "parentPhone",
                ].includes(f.fieldKey),
              )
              .map((f) => {
                // Special handling for childName field
                if (f.fieldKey === "childName") {
                  if (state.children.length === 1) {
                    // Single child — show read-only display
                    return (
                      <div key={f.fieldKey}>
                        <label className="txt-label">{f.label}</label>
                        <div
                          style={{
                            padding: "9px 12px",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg2)",
                            fontSize: 13,
                            color: "var(--text2)",
                            marginBottom: 8,
                          }}
                        >
                          {state.children[0].firstName}{" "}
                          {state.children[0].lastName}
                        </div>
                      </div>
                    );
                  }
                  if (state.children.length > 1) {
                    // Multiple children — show dropdown
                    return (
                      <div key={f.fieldKey}>
                        <label className="txt-label">
                          {f.label}
                          {f.isRequired && (
                            <span style={{ color: "var(--peach-dark)" }}>
                              {" "}
                              *
                            </span>
                          )}
                        </label>
                        <select
                          value={form.childName}
                          onChange={(e) => {
                            const child = state.children.find(
                              (c) =>
                                `${c.firstName} ${c.lastName}` ===
                                e.target.value,
                            );
                            setForm({
                              ...form,
                              childName: e.target.value,
                              childClass: child?.class || form.childClass,
                            });
                          }}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: 13,
                            background: "var(--bg)",
                            color: "var(--text)",
                            outline: "none",
                            marginBottom: 8,
                          }}
                        >
                          <option value="">— Select child —</option>
                          {state.children.map((c) => (
                            <option
                              key={c.id}
                              value={`${c.firstName} ${c.lastName}`}
                            >
                              {c.firstName} {c.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                }

                if (f.fieldKey === "parentName") {
                  return (
                    <div key={f.fieldKey}>
                      <label className="txt-label">{f.label}</label>
                      <div
                        style={{
                          padding: "9px 12px",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg2)",
                          fontSize: 13,
                          color: "var(--text2)",
                          marginBottom: 8,
                        }}
                      >
                        {form.parentName}
                      </div>
                    </div>
                  );
                }
                // Skip childClass if children list is used (class auto-populated from child selection)
                if (f.fieldKey === "childClass") {
                  // If a registered child is selected, show class as read-only
                  const selectedChild = state.children.find(
                    (c) =>
                      `${c.firstName} ${c.lastName}` === form.childName?.trim(),
                  );
                  if (selectedChild) {
                    return (
                      <div key={f.fieldKey}>
                        <label className="txt-label">{f.label}</label>
                        <div
                          style={{
                            padding: "9px 12px",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg2)",
                            fontSize: 13,
                            color: "var(--text2)",
                            marginBottom: 8,
                          }}
                        >
                          {selectedChild.class || "—"}
                        </div>
                      </div>
                    );
                  }
                  // No registered child selected — show editable input
                  return (
                    <Input
                      key={f.fieldKey}
                      label={f.label}
                      value={form.childClass || ""}
                      onChange={(v) => setForm({ ...form, childClass: v })}
                      required={f.isRequired}
                      placeholder={`Enter ${f.label.toLowerCase()}`}
                    />
                  );
                }
                if (f.fieldKey === "parentPhone") {
                  return (
                    <Input
                      key={f.fieldKey}
                      label={f.label}
                      value={form.parentPhone || ""}
                      onChange={(v) => setForm({ ...form, parentPhone: v })}
                      required={f.isRequired}
                      placeholder="Enter phone number"
                      type="tel"
                    />
                  );
                }
                // Default — render normal input
                return (
                  <Input
                    key={f.fieldKey}
                    label={f.label}
                    value={form[f.fieldKey] || ""}
                    onChange={(v) => setForm({ ...form, [f.fieldKey]: v })}
                    required={f.isRequired}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                  />
                );
              })}
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
          {POLICY_NOTICE}
          <Btn
            onClick={handleSubmit}
            fullWidth
            size="lg"
            disabled={submitting || hasStockWarning}
            style={{ marginTop: 6 }}
          >
            {submitting
              ? "Submitting…"
              : hasStockWarning
                ? "Fix stock issues above"
                : "Submit Order 🎉"}
          </Btn>
        </Card>
      </div>
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
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewRequest, setViewRequest] = useState(null);

  function loadOrders() {
    return api("/api/orders/mine")
      .then((orders) => {
        setMyOrders(orders);
        dispatch({ type: "SET_ORDERS", orders });
      })
      .catch(() =>
        setMyOrders(
          state.orders.filter((o) => o.parentId === state.currentUser?.id),
        ),
      );
  }

  useEffect(() => {
    loadOrders().finally(() => setLoading(false));
  }, []);

  const [pendingSizes, setPendingSizes] = useState({});

  function closeEditPane() {
    setEditingOrder(null);
    setPendingSizes({});
  }

  function handleSizeChange(itemIndex, newSize) {
    setPendingSizes((prev) => ({ ...prev, [itemIndex]: newSize }));
  }

  async function submitChangeRequest() {
    const changes = editingOrder.items
      .map((item, i) => ({ ...item, index: i }))
      .filter(
        (item) =>
          pendingSizes[item.index] && pendingSizes[item.index] !== item.size,
      )
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        fromSize: item.size,
        toSize: pendingSizes[item.index],
      }));

    try {
      await api(`/api/orders/${editingOrder.id}/change-request`, {
        method: "POST",
        body: { changes },
      });
      await loadOrders();
      dispatch({
        type: "SET_TOAST",
        message:
          "Size change request submitted — you'll be notified once it's reviewed.",
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to submit change request",
      });
    } finally {
      closeEditPane();
    }
  }

  const hasChanges = editingOrder
    ? editingOrder.items.some(
        (item, i) => pendingSizes[i] && pendingSizes[i] !== item.size,
      )
    : false;

  const detailModal = () => {
    if (detail) {
      return (
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
            <div>
              <Badge status={detail.status} />
            </div>
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
                  {item.productName} ({displaySize(item.size)}) ×{item.quantity}
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
      );
    }
  };

  const changeRequestModal = () => {
    if (!viewRequest) return null;

    const style = CHANGE_REQUEST_STYLES[viewRequest.status];
    const order = myOrders.find((ord) => ord.id === viewRequest.orderId);
    const cellStyle = {
      padding: "6px",
      borderBottom: "0.5px solid var(--border)",
    };

    return (
      <Modal
        title={`Size Change Request — ${viewRequest.orderNumber}`}
        onClose={() => setViewRequest(null)}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span
            className="txt-badge"
            style={{
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: 30,
              background: style.bg,
              color: style.color,
            }}
          >
            {style.label}
          </span>
          <span style={{ fontSize: 11, color: "var(--text3)" }}>
            Requested {new Date(viewRequest.requestedAt).toLocaleString()}
          </span>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {["Item", "Change"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "4px 6px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: "var(--text3)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {viewRequest.changes.map((c, i) => {
              const fallbackQty = order?.items.find(
                (it) => it.productId === c.productId,
              )?.quantity;
              const originalQty = c.quantity ?? fallbackQty;
              const removed = c.toQuantity === 0;
              const toQty = c.toQuantity != null ? c.toQuantity : originalQty;
              const left = `${displaySize(c.fromSize)} × ${originalQty ?? "—"}`;
              const right = removed
                ? "Removed"
                : `${displaySize(c.toSize)} × ${toQty}`;

              return (
                <tr key={i}>
                  <td style={cellStyle}>{c.productName}</td>
                  <td
                    style={{
                      ...cellStyle,
                      fontWeight: 800,
                      color: removed ? "var(--peach-dark)" : "var(--mint-dark)",
                    }}
                  >
                    {left} → {right}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {viewRequest.status !== "PENDING" && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--text3)",
            }}
          >
            {viewRequest.status === "APPROVED" ? "Approved" : "Rejected"}{" "}
            {viewRequest.reviewedAt
              ? new Date(viewRequest.reviewedAt).toLocaleString()
              : ""}
          </div>
        )}

        {viewRequest.status === "REJECTED" && viewRequest.rejectionNote && (
          <div
            style={{
              marginTop: 8,
              background: "var(--peach)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 10px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--peach-dark)",
                marginBottom: 2,
              }}
            >
              Note from the school
            </div>
            <div style={{ fontSize: 12, color: "var(--peach-dark)" }}>
              {viewRequest.rejectionNote}
            </div>
          </div>
        )}
      </Modal>
    );
  };
  const editOrderModal = () => {
    if (editingOrder)
      return (
        <Modal onClose={closeEditPane}>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--bg2)",
              padding: "18px 20px",
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  Editing sizes — {editingOrder.orderNumber}
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>
                  {editingOrder.childName} · {editingOrder.childClass}
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditPane}
                style={{
                  fontWeight: 700,
                  color: "var(--text2)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "5px 10px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "4px 14px",
                marginBottom: 14,
              }}
            >
              {editingOrder.items.map((item, i) => {
                const product = state.products.find(
                  (p) => p.id === item.productId,
                );
                const sizeOptions = sortSizes(
                  product?.sizes?.length ? product.sizes : [item.size],
                );
                const newSize = pendingSizes[i];
                const isChanged = newSize && newSize !== item.size;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom:
                        i < editingOrder.items.length - 1
                          ? "1px solid var(--bg3)"
                          : "none",
                      background: isChanged ? "var(--lemon)" : "transparent",
                      margin: isChanged ? "0 -14px" : 0,
                      paddingLeft: isChanged ? 14 : 0,
                      paddingRight: isChanged ? 14 : 0,
                      borderRadius: isChanged ? 8 : 0,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {item.productName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>
                        Qty ×{item.quantity} · $
                        {Number(item.unitPrice).toFixed(2)} ea
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {isChanged && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "var(--lemon-dark)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {displaySize(item.size)} → {displaySize(newSize)}
                        </span>
                      )}
                      <select
                        value={newSize || item.size}
                        onChange={(e) => handleSizeChange(i, e.target.value)}
                        style={{
                          padding: "6px 10px",
                          border: "1.5px solid var(--border)",
                          borderRadius: 8,
                          fontWeight: 700,
                          background: "#fff",
                          color: "var(--text)",
                          outline: "none",
                        }}
                      >
                        {sizeOptions.map((s) => (
                          <option key={s} value={s}>
                            {displaySize(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasChanges ? (
              <button
                type="button"
                onClick={submitChangeRequest}
                style={{
                  width: "100%",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  background: "var(--sky-dark)",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Submit Order Update Request
              </button>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text3)",
                  textAlign: "center",
                }}
              >
                Change a size above to submit an update request.
              </div>
            )}
          </div>
        </Modal>
      );
  };

  const sizeEditButton = (o) => {
    const latestChangeRequest = o.changeRequests?.[0];
    const canEditSizes =
      ["SUBMITTED", "REVIEW"].includes(o.status) &&
      latestChangeRequest?.status !== "PENDING";

    if (!canEditSizes) return null;

    const isEditingThis = editingOrder?.id === o.id;
    return (
      <button
        type="button"
        disabled={isEditingThis}
        onClick={() => {
          setEditingOrder(o);
          setPendingSizes({});
        }}
        style={{
          fontWeight: 700,
          color: "var(--sky-dark)",
          background: "var(--sky)",
          border: "none",
          borderRadius: 8,
          padding: "5px 10px",
          cursor: isEditingThis ? "not-allowed" : "pointer",
          opacity: isEditingThis ? 0.5 : 1,
        }}
      >
        {isEditingThis ? "Editing…" : "✏️ Edit Sizes"}
      </button>
    );
  };

  const getChangeRequests = (o) => {
    const changeRequests = o.changeRequests;
    if (changeRequests && changeRequests.length > 0)
      return changeRequests.map((r) => {
        const crStyle = r ? CHANGE_REQUEST_STYLES[r.status] : null;
        return (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--bg3)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              className="txt-badge"
              style={{
                fontWeight: 800,
                whiteSpace: "nowrap",
                padding: "3px 10px",
                borderRadius: 30,
                background: crStyle.bg,
                color: crStyle.color,
              }}
            >
              {crStyle.label}
            </span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              Requested at {new Date(r.requestedAt).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => setViewRequest(r)}
              style={{
                background: "none",
                border: "none",
                color: "var(--sky-dark)",
                fontSize: 11,
                fontWeight: 700,
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
              }}
            >
              View Request Details
            </button>
          </div>
        );
      });
  };

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
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#111",
            letterSpacing: "-.02em",
            marginBottom: 4,
          }}
        >
          My Orders
        </h2>
        <p style={{ fontSize: 14, color: "#888" }}>
          {myOrders.length} order{myOrders.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "#fff",
          border: "1.5px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        {myOrders.map((o) => {
          return (
            <div
              key={o.id}
              style={{
                padding: "18px 20px",
              }}
              className="txt-sm"
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setDetail(o)}
                  style={{
                    fontWeight: 700,
                    color: "#111",
                    background: "transparent",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  View Details
                </button>
                {sizeEditButton(o)}
              </div>
              <div>
                <span
                  style={{
                    fontWeight: 700,
                    color: "var(--text2)",
                  }}
                >
                  {o.orderNumber} ·{" "}
                  {o.createdAt
                    ? new Date(o.createdAt).toLocaleDateString()
                    : ""}
                </span>
                <span style={{ marginLeft: 5 }}>
                  <Badge status={o.status} />
                </span>
              </div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {o.childName} · {o.childClass}
              </div>
              <div
                className="txt-base"
                style={{ color: "var(--text)", marginBottom: 6 }}
              >
                {o.items
                  .map(
                    (i) =>
                      `${i.productName} ${displaySize(i.size)} ×${i.quantity}`,
                  )
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
                      color: "var(--peach-dark)",
                      fontWeight: 700,
                    }}
                  >
                    {Math.round(o.discountRate * 100)}% discount applied
                  </span>
                )}
              </div>
              {getChangeRequests(o)}
            </div>
          );
        })}
        {detailModal()}
        {changeRequestModal()}
        {editOrderModal()}
      </div>
    </div>
  );
}

function ChangePasswordPage() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (form.newPassword.length < 6) {
      dispatch({
        type: "SET_TOAST",
        message: "Password must be at least 6 characters",
      });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      dispatch({ type: "SET_TOAST", message: "Passwords do not match" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/auth/parent/change-password", {
        method: "PUT",
        body: { newPassword: form.newPassword },
      });
      dispatch({
        type: "SET_TOAST",
        message: "Password updated! Please log in again.",
      });
      dispatch({ type: "LOGOUT" });
      navigate("/parent");
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update password",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg2)",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-lg)",
          padding: 32,
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              color: "var(--sky-dark)",
            }}
          >
            Set New Password
          </h2>
          <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 6 }}>
            A temporary password was set for your account. Please create a new
            password to continue.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label="New Password"
            type="password"
            value={form.newPassword}
            onChange={(v) => setForm({ ...form, newPassword: v })}
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
            required
          />
          <Btn
            variant="admin"
            onClick={handleSubmit}
            disabled={saving}
            fullWidth
            style={{ marginTop: 4 }}
          >
            {saving ? "Saving…" : "Set New Password"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── PARENT SHELL ─────────────────────────────────────────────
function ParentMyChildren() {
  const { state, dispatch } = useApp();
  const [children, setChildren] = useState(state.children || []);
  const [newChild, setNewChild] = useState({
    firstName: "",
    lastName: "",
    class: "",
  });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingChild, setEditingChild] = useState(null); // { id, name, class }
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    class: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  async function handleAdd() {
    if (!newChild.firstName?.trim() || !newChild.lastName?.trim()) {
      dispatch({
        type: "SET_TOAST",
        message: "First and last name are required",
      });
      return;
    }
    if (!newChild.class.trim()) {
      dispatch({ type: "SET_TOAST", message: "Class is required" });
      return;
    }
    setSaving(true);
    try {
      const child = await api("/api/parents/children", {
        method: "POST",
        body: {
          firstName: newChild.firstName.trim(),
          lastName: newChild.lastName.trim(),
          class: newChild.class.trim(),
        },
      });
      const updated = [...children, child];
      setChildren(updated);
      dispatch({ type: "SET_CHILDREN", children: updated });
      setNewChild({ firstName: "", lastName: "", class: "" });
      setAdding(false);
      dispatch({ type: "SET_TOAST", message: "Child added!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to add child",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editForm.firstName?.trim() || !editForm.lastName?.trim()) {
      dispatch({
        type: "SET_TOAST",
        message: "First and last name are required",
      });
      return;
    }
    if (!editForm.class?.trim()) {
      dispatch({ type: "SET_TOAST", message: "Class is required" });
      return;
    }
    setEditSaving(true);
    try {
      const updated = await api(`/api/parents/children/${editingChild.id}`, {
        method: "PUT",
        body: {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          class: editForm.class.trim(),
        },
      });
      const updatedList = children.map((c) =>
        c.id === updated.id ? updated : c,
      );
      setChildren(updatedList);
      dispatch({ type: "SET_CHILDREN", children: updatedList });
      setEditingChild(null);
      dispatch({ type: "SET_TOAST", message: "Child updated!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update child",
      });
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#111",
            letterSpacing: "-.02em",
            marginBottom: 4,
          }}
        >
          My Profile
        </h2>
        <p style={{ fontSize: 14, color: "#888" }}>
          Manage your children&apos;s details
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {children.map((c) => (
          <div key={c.id}>
            {editingChild?.id === c.id ? (
              // Inline edit form
              <div
                style={{
                  background: "var(--bg2)",
                  borderRadius: "var(--radius-sm)",
                  padding: 14,
                  border: "1px solid var(--border)",
                }}
              >
                <Input
                  label="Child First Name"
                  value={editForm.firstName}
                  onChange={(v) => setEditForm({ ...editForm, firstName: v })}
                  required
                />
                <Input
                  label="Child Last Name"
                  value={editForm.lastName}
                  onChange={(v) => setEditForm({ ...editForm, lastName: v })}
                  required
                />
                <Input
                  label="Class"
                  value={editForm.class}
                  onChange={(v) => setEditForm({ ...editForm, class: v })}
                  required
                  style={{ marginTop: 8 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Btn
                    variant="admin"
                    onClick={handleUpdate}
                    disabled={editSaving}
                    style={{ flex: 1 }}
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setEditingChild(null)}>
                    Cancel
                  </Btn>
                </div>
              </div>
            ) : (
              // Normal display
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  background: "var(--bg)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--sky)",
                    color: "var(--sky-dark)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {c.firstName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {c.firstName} {c.lastName}
                  </div>
                  {c.class && (
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>
                      {c.class}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditingChild(c);
                    setEditForm({
                      firstName: c.firstName,
                      lastName: c.lastName,
                      class: c.class || "",
                    });
                  }}
                  style={{
                    padding: "4px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: "var(--bg2)",
                    color: "var(--text2)",
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
        {children.length === 0 && (
          <p style={{ color: "var(--text3)", fontSize: 13 }}>
            No children added yet.
          </p>
        )}
      </div>
      {adding ? (
        <div
          style={{
            background: "var(--bg2)",
            borderRadius: "var(--radius-sm)",
            padding: 14,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              label="First Name"
              value={newChild.firstName || ""}
              onChange={(v) => setNewChild({ ...newChild, firstName: v })}
              required
              style={{ flex: 1 }}
            />
            <Input
              label="Last Name"
              value={newChild.lastName || ""}
              onChange={(v) => setNewChild({ ...newChild, lastName: v })}
              required
              style={{ flex: 1 }}
            />
          </div>
          <Input
            label="Class"
            value={newChild.class}
            onChange={(v) => setNewChild({ ...newChild, class: v })}
            required
            style={{ marginTop: 8 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn
              variant="admin"
              onClick={handleAdd}
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : "Add Child"}
            </Btn>
            <Btn variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      ) : (
        <Btn variant="admin" onClick={() => setAdding(true)} fullWidth>
          + Add Child
        </Btn>
      )}
    </div>
  );
}
function ParentShell() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { parentPage, cart } = state;
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024; // laptop/desktop breakpoint
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const tabs = [
    { id: "home", label: "Shop", icon: "🏪" },
    {
      id: "cart",
      label: `Cart${cartCount > 0 ? ` (${cartCount})` : ""}`,
      icon: "🛒",
    },
    { id: "orders", label: "My Orders", icon: "📋" },
    { id: "children", label: "My Children", icon: "👧" },
  ];
  const [cartForm, setCartForm] = useState({
    childName: "",
    childClass: "",
    parentName: state.currentUser
      ? `${state.currentUser.firstName} ${state.currentUser.lastName}`
      : "",
    parentPhone: state.currentUser?.phone || "",
    locationId: "",
    notes: "",
  });

  useEffect(() => {
    if (state.currentUser) {
      setCartForm((f) => ({
        ...f,
        parentName:
          f.parentName ||
          `${state.currentUser.firstName} ${state.currentUser.lastName}`,
        parentPhone: f.parentPhone || state.currentUser.phone || "",
      }));
    }
  }, [state.currentUser]);

  if (parentPage === "login") return <ParentLogin />;

  const NAV_ITEMS = [
    { id: "home", label: "Shop", icon: "🏪" },
    { id: "orders", label: "My Orders", icon: "📋" },
    { id: "children", label: "My Profile", icon: "👤" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#fff",
      }}
    >
      {/* ── Premium sticky header ─────────────────────── */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky",
          top: 0,
          zIndex: 200,
        }}
      >
        <div
          style={{
            maxWidth: 1920,
            margin: "0 auto",
            padding: isDesktop ? "0 48px" : "0 16px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
              cursor: "pointer",
            }}
            onClick={() => dispatch({ type: "SET_PARENT_PAGE", page: "home" })}
          >
            {state.settings.logoUrl ? (
              <img
                src={state.settings.logoUrl}
                alt="Logo"
                style={{
                  width: 34,
                  height: 34,
                  objectFit: "contain",
                  borderRadius: 8,
                }}
              />
            ) : (
              <span style={{ fontSize: 22 }}>{state.settings.logoEmoji}</span>
            )}
            <span
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: "#111",
                letterSpacing: "-.02em",
                whiteSpace: "nowrap",
              }}
            >
              {state.settings.systemName}
            </span>
          </div>

          {/* Desktop centre nav */}
          {isDesktop && (
            <nav style={{ display: "flex", gap: 2 }}>
              {NAV_ITEMS.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    dispatch({ type: "SET_PARENT_PAGE", page: t.id })
                  }
                  style={{
                    padding: "7px 14px",
                    background: "none",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: parentPage === t.id ? 700 : 500,
                    fontSize: 14,
                    color: parentPage === t.id ? "#111" : "#666",
                    transition: "all .15s",
                    borderBottom:
                      parentPage === t.id
                        ? "2px solid #111"
                        : "2px solid transparent",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Cart button — premium pill */}
            <button
              onClick={() =>
                dispatch({ type: "SET_PARENT_PAGE", page: "cart" })
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                background: parentPage === "cart" ? "#111" : "#f3f4f6",
                color: parentPage === "cart" ? "#fff" : "#111",
                border: "none",
                borderRadius: 40,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                transition: "all .15s",
                position: "relative",
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Cart
              {cartCount > 0 && (
                <span
                  style={{
                    background: parentPage === "cart" ? "#fff" : "#111",
                    color: parentPage === "cart" ? "#111" : "#fff",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    fontSize: 10,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Account avatar */}
            <button
              onClick={() =>
                dispatch({ type: "SET_PARENT_PAGE", page: "children" })
              }
              title={state.currentUser?.firstName}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: parentPage === "children" ? "#111" : "#f3f4f6",
                color: parentPage === "children" ? "#fff" : "#111",
                border: "none",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {(state.currentUser?.firstName || "U").charAt(0).toUpperCase()}
            </button>

            <button
              onClick={() => {
                dispatch({ type: "LOGOUT" });
                navigate("/parent");
              }}
              style={{
                padding: "8px 14px",
                background: "none",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                color: "#666",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile bottom nav bar */}
        {!isDesktop && (
          <div
            style={{
              borderTop: "1px solid #f3f4f6",
              display: "flex",
              padding: "0",
            }}
          >
            {NAV_ITEMS.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  dispatch({ type: "SET_PARENT_PAGE", page: t.id })
                }
                style={{
                  flex: 1,
                  padding: "8px 0",
                  background: "none",
                  border: "none",
                  fontSize: 9,
                  fontWeight: 700,
                  color: parentPage === t.id ? "#111" : "#aaa",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  borderTop: `2px solid ${parentPage === t.id ? "#111" : "transparent"}`,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Page content ──────────────────────────────── */}
      <main
        style={{
          flex: 1,
          maxWidth: 1920,
          margin: "0 auto",
          width: "100%",
          padding: isDesktop ? "40px 48px" : "20px 16px 32px",
        }}
      >
        {parentPage === "home" && <ParentHome />}
        {parentPage === "cart" && (
          <ParentCart cartForm={cartForm} setCartForm={setCartForm} />
        )}
        {parentPage === "orders" && <ParentOrders />}
        {parentPage === "children" && <ParentMyChildren />}
        {parentPage === "changePassword" && <ChangePasswordPage />}
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ADMIN SCREENS
// ══════════════════════════════════════════════════════════════

function AdminDashboard() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { orders, products } = state;
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Load real stats from the backend
    api("/api/admin/stats")
      .then(setStats)
      .catch(() => {});
    // Also refresh the admin product list (includes costPrice) and the FULL
    // order history — the "Products by Order Volume" fallback below needs
    // every order, not just a recent page, or its totals undercount.
    Promise.all([api("/api/admin/products"), api("/api/admin/orders")])
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
        .sort((a, b) => b.totalQty - a.totalQty);
  // .slice(0, 6);

  const maxQty = Math.max(...productQtys.map((p) => p.totalQty), 1);

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
        <StatCard
          label="Change Requests"
          value={
            stats?.pendingChangeRequests ??
            orders.filter((o) =>
              o.changeRequests?.some((cr) => cr.status === "PENDING"),
            ).length
          }
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
                {["", "Order", "Child", "Location", "Total", "Status"].map(
                  (h) => (
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
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => {
                const amount = parseFloat(o.totalAmount);
                // Recent Orders row flag
                const hasPendingChange = o.changeRequests?.some(
                  (cr) => cr.status === "PENDING",
                );
                return (
                  <tr
                    key={o.id}
                    style={
                      hasPendingChange ? { background: "#fffaf0" } : undefined
                    }
                  >
                    {[
                      hasPendingChange ? (
                        <span
                          title="Size change request pending"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "var(--peach-dark)",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          !
                        </span>
                      ) : null,
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
                      background: colors[i % colors.length],
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
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm, confirmLabel, confirmVariant }

  const isSuperAdmin = state.currentUser?.role === "SUPER_ADMIN";

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
    sizes: ["T1", "T2", "T3", "T4", "T5", "T6"],
    isActive: true,
  });
  const sizes = ["T1", "T2", "T3", "T4", "T5", "T6"];
  const categories = ["Tops", "Bottoms", "Event Essentials", "Outdoor Wear"];

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
    // Validate FIRST before setting saving state
    if (!form.name || !form.sellingPrice || !form.costPrice) {
      dispatch({
        type: "SET_TOAST",
        message: "Name, selling price and cost price are required",
      });
      return;
    }

    setSaving(true); // ← only set after validation passes
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
            // fontSize: "var(--font-size-table)",
            minWidth: 560,
          }}
        >
          <thead>
            <tr>
              {[
                "Product",
                "Selling",
                ...(isSuperAdmin ? ["Cost 🔒", "Profit"] : []),
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
          <tbody className="txt-base">
            {[...state.products]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
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
                  {isSuperAdmin && (
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
                  )}
                  {isSuperAdmin && (
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
                  )}

                  <td
                    style={{
                      padding: "10px 10px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {sortSizes(p.sizes).map((s) => (
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
                          {displaySize(s)}
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
                        onClick={() =>
                          setConfirmAction({
                            message: `Delete "${p.name}"? This cannot be undone.`,
                            confirmLabel: "Delete",
                            confirmVariant: "peach",
                            onConfirm: async () => {
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
                                  message:
                                    err.message || "Failed to delete product",
                                });
                              }
                            },
                          })
                        }
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
              {sortSizes(sizes).map((s) => (
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
                    {displaySize(s)}
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
      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          confirmVariant={confirmAction.confirmVariant}
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function AdminInventory() {
  const { state, dispatch } = useApp();
  const [filter, setFilter] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [apiRows, setApiRows] = useState(null);
  const [saving, setSaving] = useState({});
  const [editingRow, setEditingRow] = useState(null); // { invId, field: "total"|"sold", value
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;

  useEffect(() => {
    api("/api/admin/inventory")
      .then((data) => setApiRows(data))
      .catch(() => {});
  }, []);

  // Flatten all rows with product info
  const allRows = apiRows
    ? apiRows
        .filter((i) => i.product?.isActive !== false)
        .map((i) => ({
          invId: i.id,
          productId: i.productId,
          productName: i.product?.name || "",
          productImage:
            i.product?.imageUrls?.[0] || i.product?.imageUrl || null,
          productEmoji: i.product?.imageEmoji || "👕",
          size: i.size,
          total: i.totalQty,
          reserved: i.reservedQty,
          available: i.totalQty - i.reservedQty,
          sold: i.soldQty ?? 0,
        }))
    : [];

  // Unique categories from products, for the filter buttons
  const categories = useMemo(
    () => [
      "All",
      ...new Set(state.products.map((p) => p.category).filter(Boolean)),
    ],
    [state.products],
  );

  // Filter by search text and category
  const filtered = allRows
    .filter((r) =>
      filter
        ? r.productName.toLowerCase().includes(filter.toLowerCase())
        : true,
    )
    .filter((r) => {
      if (filterCategory === "All") return true;
      const cat = state.products.find((p) => p.id === r.productId)?.category;
      return cat === filterCategory;
    });

  // Collect all unique sizes (sorted) for column headers
  const allSizes = useMemo(
    () => sortSizes([...new Set(state.products.flatMap((p) => p.sizes || []))]),
    [state.products],
  );

  // Group by product name
  const grouped = filtered.reduce((acc, r) => {
    if (!acc[r.productName]) {
      acc[r.productName] = {
        productId: r.productId,
        productImage: r.productImage,
        productEmoji: r.productEmoji,
        rows: {},
      };
    }
    acc[r.productName].rows[r.size] = r;
    return acc;
  }, {});

  function startEdit(r) {
    // Re-read from apiRows to get the freshest value
    const fresh = apiRows?.find((row) => row.id === r.invId);
    const total = fresh ? fresh.totalQty : r.total;
    setEditingRow({ invId: r.invId, field: "total", value: String(total) });
  }

  function startEditSold(r) {
    const fresh = apiRows?.find((row) => row.id === r.invId);
    const sold = fresh ? (fresh.soldQty ?? 0) : r.sold;
    setEditingRow({ invId: r.invId, field: "sold", value: String(sold) });
  }

  async function saveEdit(row) {
    if (!editingRow) return;
    const key = row.invId;
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      if (editingRow.field === "total") {
        const newTotal = parseInt(editingRow.value) || 0;
        await api(`/api/admin/inventory/${row.invId}`, {
          method: "PUT",
          body: { totalQty: newTotal },
        });
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
          type: "SET_TOAST",
          message: `Total updated: ${row.productName} ${row.size} → ${newTotal}`,
        });
      } else {
        const newSold = Math.max(0, parseInt(editingRow.value) || 0);
        const result = await api(`/api/admin/inventory/${row.invId}/sold`, {
          method: "PUT",
          body: { soldQty: newSold },
        });
        // Update both soldQty and totalQty from server response
        setApiRows((prev) =>
          prev
            ? prev.map((r) =>
                r.id === row.invId
                  ? {
                      ...r,
                      soldQty: result.soldQty,
                      totalQty: result.totalQty,
                      availableQty: result.totalQty - result.reservedQty,
                    }
                  : r,
              )
            : prev,
        );
        dispatch({
          type: "SET_TOAST",
          message: `Sold updated: ${row.productName} ${row.size} → ${newSold} (Total adjusted to ${result.totalQty})`,
        });
      }
    } catch (err) {
      // Keep the editor open (with whatever the admin typed) so a
      // validation error — e.g. "can't set total below reserved" — doesn't
      // silently wipe their input and force them to retype it.
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update",
      });
      setSaving((s) => {
        const n = { ...s };
        delete n[key];
        return n;
      });
      return;
    }
    setSaving((s) => {
      const n = { ...s };
      delete n[key];
      return n;
    });
    setEditingRow(null);
  }

  function exportCSV() {
    const token = localStorage.getItem("ww_token");
    window.open(
      `${API_BASE_URL}/api/admin/inventory/export?token=${token}`,
      "_blank",
    );
  }
  // Shared styles
  const metricLabel = {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: "#888",
    marginBottom: 1,
  };
  const metricValue = { fontSize: 12, fontWeight: 700, color: "var(--text)" };

  return (
    <div className="animate-fade">
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: isDesktop ? 160 : 120,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              color: "var(--text3)",
            }}
          >
            🔍
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search products…"
            style={{
              width: "100%",
              padding: "8px 12px 8px 30px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              background: "var(--bg)",
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>
        <Btn variant="admin" size="sm" onClick={exportCSV}>
          ⬆ Export
        </Btn>
      </div>

      {/* Category filter buttons */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        {categories.map((c) => (
          <Btn
            key={c}
            variant={filterCategory === c ? "admin" : "ghost"}
            size="sm"
            onClick={() => setFilterCategory(c)}
          >
            {c}
          </Btn>
        ))}
      </div>

      {/* Info strip */}
      <div
        style={{
          background: "var(--lemon)",
          border: "1px solid var(--lemon-mid)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 14px",
          fontSize: 11,
          color: "var(--lemon-dark)",
          fontWeight: 600,
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        📋 <strong>Submitted / Review</strong> → reserves stock &nbsp;|&nbsp;
        <strong>Ready for Pick Up</strong> → deducts from total &nbsp;|&nbsp;
        <strong>Cancelled</strong> → restores stock
      </div>

      {/* Matrix table */}
      {allRows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--text3)",
            fontSize: 13,
          }}
        >
          {apiRows === null ? "Loading inventory…" : "No inventory found."}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: isDesktop ? "row" : "column",
            gap: isDesktop ? 20 : 14,
            alignItems: isDesktop ? "flex-start" : "stretch",
          }}
        >
          {/* Main table */}
          <div
            style={{
              overflowX: "auto",
              overflowY: "auto",
              maxHeight: "70vh",
              flex: 1,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                fontSize: 12,
                background: "var(--bg)",
                width: "100%",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <thead>
                <tr style={{ background: "var(--bg2)" }}>
                  {/* Product Name header — sticky */}
                  <th
                    className="txt-th"
                    style={{
                      padding: isDesktop ? "12px 16px" : "10px 12px",
                      textAlign: "left",
                      color: "var(--text)",
                      minWidth: isDesktop ? 180 : 140,
                      position: "sticky",
                      left: 0,
                      top: 0,
                      background: "var(--bg2)",
                      zIndex: 2,
                      borderBottom: "2px solid var(--border)",
                      borderRight: "2px solid var(--border)",
                    }}
                  >
                    Product Name
                  </th>
                  {/* Size headers */}
                  {allSizes.map((size) => (
                    <th
                      className="txt-th"
                      key={size}
                      style={{
                        padding: isDesktop ? "12px 16px" : "10px 12px",
                        textAlign: "center",
                        color: "var(--sky-dark)",
                        minWidth: isDesktop ? 150 : 128,
                        borderBottom: "2px solid var(--border)",
                        borderRight: "1px solid var(--border)",
                        position: "sticky",
                        top: 0,
                        background: "var(--bg2)",
                        zIndex: 2,
                      }}
                    >
                      {displaySize(size)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(
                  (
                    [
                      productName,
                      { productId, productImage, productEmoji, rows: sizeMap },
                    ],
                    pIdx,
                  ) => (
                    <tr
                      key={productName}
                      style={{
                        background: pIdx % 2 === 0 ? "var(--bg)" : "var(--bg2)",
                        verticalAlign: "top",
                      }}
                    >
                      {/* Product name cell — sticky */}
                      <td
                        className="txt-base"
                        style={{
                          padding: isDesktop ? "16px" : "10px 12px",
                          borderBottom: "1px solid var(--border)",
                          borderRight: "2px solid var(--border)",
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background:
                            pIdx % 2 === 0 ? "var(--bg)" : "var(--bg2)",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {productImage ? (
                            <img
                              src={productImage}
                              alt=""
                              style={{
                                width: 40,
                                height: 40,
                                objectFit: "cover",
                                borderRadius: 8,
                                flexShrink: 0,
                                border: "1px solid var(--border)",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                background: "var(--sky)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 20,
                                flexShrink: 0,
                              }}
                            >
                              {productEmoji}
                            </div>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 700 }}>
                            {productName}
                          </span>
                        </div>
                      </td>
                      {/* Size cells */}
                      {allSizes.map((size) => {
                        const r = sizeMap[size];
                        if (!r) {
                          return (
                            <td
                              key={size}
                              style={{
                                padding: isDesktop ? "16px" : "10px 12px",
                                textAlign: "center",
                                borderBottom: "1px solid var(--border)",
                                borderRight: "1px solid var(--border)",
                                color: "var(--text3)",
                                fontSize: 18,
                              }}
                            >
                              —
                            </td>
                          );
                        }
                        const isEditing = editingRow?.invId === r.invId;
                        return (
                          <td
                            key={size}
                            style={{
                              padding: isDesktop ? "12px 16px" : "8px 10px",
                              borderBottom: "1px solid var(--border)",
                              borderRight: "1px solid var(--border)",
                              verticalAlign: "top",
                            }}
                          >
                            {/* Current Stock */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                marginBottom: 6,
                              }}
                            >
                              <div className="txt-sm">
                                <div style={metricLabel}>Current Stock</div>
                                {editingRow?.invId === r.invId &&
                                editingRow?.field === "total" ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 4,
                                      alignItems: "center",
                                      marginTop: 2,
                                    }}
                                  >
                                    <input
                                      type="number"
                                      value={editingRow.value}
                                      min={0}
                                      autoFocus
                                      onChange={(e) =>
                                        setEditingRow({
                                          ...editingRow,
                                          value: e.target.value,
                                        })
                                      }
                                      style={{
                                        width: 54,
                                        padding: "3px 6px",
                                        border: "1px solid var(--sky-dark)",
                                        borderRadius: 4,
                                        // fontSize: 12,
                                        outline: "none",
                                        background: "var(--bg)",
                                        color: "var(--text)",
                                      }}
                                    />
                                    <button
                                      onClick={() => saveEdit(r)}
                                      disabled={saving[r.invId]}
                                      style={{
                                        padding: "3px 7px",
                                        border: "none",
                                        borderRadius: 4,
                                        // fontSize: 10,
                                        fontWeight: 700,
                                        background: "var(--sky-dark)",
                                        color: "#fff",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {saving[r.invId] ? "…" : "✓"}
                                    </button>
                                    <button
                                      onClick={() => setEditingRow(null)}
                                      style={{
                                        padding: "3px 6px",
                                        border: "1px solid var(--border)",
                                        borderRadius: 4,
                                        // fontSize: 10,
                                        background: "var(--bg)",
                                        color: "var(--text3)",
                                        cursor: "pointer",
                                        fontWeight: 700,
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div style={metricValue}>{r.total}</div>
                                )}
                              </div>
                              {!(
                                editingRow?.invId === r.invId &&
                                editingRow?.field === "total"
                              ) && (
                                <button
                                  onClick={() => startEdit(r)}
                                  title="Edit current stock"
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    // fontSize: 11,
                                    color: "var(--text3)",
                                    padding: "2px",
                                    lineHeight: 1,
                                    borderRadius: 3,
                                  }}
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                            {/* Reserved */}
                            <div style={{ marginBottom: 5 }}>
                              <div style={metricLabel}>Reserved</div>
                              <div
                                style={{
                                  ...metricValue,
                                  color:
                                    r.reserved > 0
                                      ? "var(--lemon-dark)"
                                      : "var(--text3)",
                                }}
                              >
                                {r.reserved}
                              </div>
                            </div>
                            {/* Available */}
                            <div style={{ marginBottom: 5 }}>
                              <div style={metricLabel}>Available</div>
                              <div
                                style={{
                                  ...metricValue,
                                  color:
                                    r.available < 0
                                      ? "var(--peach-dark)"
                                      : "var(--sky-dark)",
                                }}
                              >
                                {r.available}
                              </div>
                            </div>
                            {/* Sold */}
                            <div>
                              {/* Sold */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                }}
                              >
                                <div>
                                  <div style={metricLabel}>Sold</div>
                                  {editingRow?.invId === r.invId &&
                                  editingRow?.field === "sold" ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 4,
                                        alignItems: "center",
                                        marginTop: 2,
                                      }}
                                    >
                                      <input
                                        type="number"
                                        value={editingRow.value}
                                        min={0}
                                        autoFocus
                                        onChange={(e) =>
                                          setEditingRow({
                                            ...editingRow,
                                            value: e.target.value,
                                          })
                                        }
                                        style={{
                                          width: 54,
                                          padding: "3px 6px",
                                          border: "1px solid var(--sky-dark)",
                                          borderRadius: 4,
                                          fontSize: 12,
                                          outline: "none",
                                          background: "var(--bg)",
                                          color: "var(--text)",
                                        }}
                                      />
                                      <button
                                        onClick={() => saveEdit(r)}
                                        disabled={saving[r.invId]}
                                        style={{
                                          padding: "3px 7px",
                                          border: "none",
                                          borderRadius: 4,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          background: "var(--sky-dark)",
                                          color: "#fff",
                                          cursor: "pointer",
                                        }}
                                      >
                                        {saving[r.invId] ? "…" : "✓"}
                                      </button>
                                      <button
                                        onClick={() => setEditingRow(null)}
                                        style={{
                                          padding: "3px 6px",
                                          border: "1px solid var(--border)",
                                          borderRadius: 4,
                                          fontSize: 10,
                                          background: "var(--bg)",
                                          color: "var(--text3)",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        ...metricValue,
                                        color: "var(--text2)",
                                      }}
                                    >
                                      {r.sold}
                                    </div>
                                  )}
                                </div>
                                {!(
                                  editingRow?.invId === r.invId &&
                                  editingRow?.field === "sold"
                                ) && (
                                  <button
                                    onClick={() => startEditSold(r)}
                                    title="Edit sold quantity"
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: 11,
                                      color: "var(--text3)",
                                      padding: "2px",
                                      lineHeight: 1,
                                      borderRadius: 3,
                                    }}
                                  >
                                    ✏️
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          {/* Matrix Guide sidebar — matches screenshot */}
          <div
            style={{
              width: isDesktop ? 180 : "100%",
              flexShrink: 0,
              display: "flex",
              flexDirection: isDesktop ? "column" : "row",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "var(--sky)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "14px 16px",
                flex: isDesktop ? "none" : "1 1 240px",
                minWidth: isDesktop ? "auto" : 240,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 16, color: "var(--sky-dark)" }}>
                  ℹ️
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    color: "var(--sky-dark)",
                  }}
                >
                  Matrix Guide
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 11,
                    color: "var(--text2)",
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                    ☰
                  </span>
                  <span>Rows = Product Names</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 11,
                    color: "var(--text2)",
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                    ⊞
                  </span>
                  <span>Columns = Sizes</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 11,
                    color: "var(--text2)",
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                    ✏️
                  </span>
                  <span>
                    Each cell tracks Current Stock / Reserved / Available / Sold
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                background: "var(--lemon)",
                border: "1px solid var(--lemon-mid)",
                borderRadius: "var(--radius-sm)",
                padding: "14px 16px",
                flex: isDesktop ? "none" : "1 1 240px",
                minWidth: isDesktop ? "auto" : 240,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>💡</span>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    color: "var(--lemon-dark)",
                  }}
                >
                  Note
                </span>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Click the pencil icon or value to update any field.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminInventoryAudit() {
  const { dispatch } = useApp();
  const [data, setData] = useState(null); // { issues, orphans, unknownStatusOrders }
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;

  async function loadAudit() {
    setLoading(true);
    try {
      const result = await api("/api/admin/inventory/audit");
      setData(result);
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to load inventory audit",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudit();
  }, []);

  async function runFix() {
    setFixing(true);
    try {
      const result = await api("/api/admin/inventory/audit/fix", {
        method: "POST",
      });
      const { fixedCount, ...rest } = result;
      setData(rest);
      dispatch({
        type: "SET_TOAST",
        message: fixedCount
          ? `Fixed ${fixedCount} inventory row${fixedCount === 1 ? "" : "s"}.`
          : "Nothing needed fixing.",
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to apply fixes",
      });
    } finally {
      setFixing(false);
    }
  }

  const issues = data?.issues || [];
  const orphans = data?.orphans || [];
  const unknownStatusOrders = data?.unknownStatusOrders || [];
  const totalProblems =
    issues.length + orphans.length + unknownStatusOrders.length;
  const isClean = !loading && data && totalProblems === 0;

  const cardStyle = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: isDesktop ? 16 : 12,
    marginBottom: 10,
  };

  return (
    <div className="animate-fade">
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            Stock Audit
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
            Recomputes reserved/sold quantities from live order data and
            compares them against the Inventory table.
          </div>
        </div>
        <Btn
          variant="ghost"
          size="sm"
          onClick={loadAudit}
          disabled={loading || fixing}
        >
          {loading ? "Loading…" : "🔄 Refresh"}
        </Btn>
        <Btn
          variant="admin"
          size="sm"
          onClick={() =>
            setConfirmAction({
              message: `This will overwrite the "Reserved" and "Sold" numbers on ${issues.length} inventory row(s) to match what your orders actually say. Physical stock totals are never changed. Continue?`,
              confirmLabel: "Fix reserved/sold",
              confirmVariant: "sky",
              onConfirm: runFix,
            })
          }
          disabled={loading || fixing || issues.length === 0}
        >
          {fixing ? "Fixing…" : "🔧 Fix reserved/sold"}
        </Btn>
      </div>

      {/* Info strip */}
      <div
        style={{
          background: "var(--lemon)",
          border: "1px solid var(--lemon-mid)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 14px",
          fontSize: 11,
          color: "var(--lemon-dark)",
          fontWeight: 600,
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        🩺 Reserved/Sold mismatches can be auto-fixed here &nbsp;|&nbsp;
        Negative "Available" and missing inventory rows need a manual stock
        check
      </div>

      {loading && !data ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--text3)",
            fontSize: 13,
          }}
        >
          Loading audit…
        </div>
      ) : isClean ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--sky-dark)",
            fontSize: 13,
            fontWeight: 700,
            background: "var(--sky)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--sky-mid)",
          }}
        >
          ✅ No mismatches found. Inventory matches order state.
        </div>
      ) : (
        <div>
          {issues.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--text2)",
                  marginBottom: 8,
                }}
              >
                Inventory rows out of sync ({issues.length})
              </div>
              {issues.map((row) => (
                <div
                  key={row.inventoryId}
                  style={{
                    ...cardStyle,
                    borderLeft: "3px solid var(--peach-dark)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {row.product} — {row.size}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>
                      total={row.totalQty} reserved={row.reservedQty} sold=
                      {row.soldQty} available=
                      <span
                        style={{
                          color:
                            row.availableQty < 0
                              ? "var(--peach-dark)"
                              : "inherit",
                          fontWeight: 700,
                        }}
                      >
                        {row.availableQty}
                      </span>
                    </div>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {row.problems.map((p, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 12,
                          color: "var(--text2)",
                          lineHeight: 1.6,
                        }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {orphans.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--text2)",
                  marginBottom: 8,
                }}
              >
                Missing inventory rows ({orphans.length})
              </div>
              {orphans.map((o, i) => (
                <div
                  key={i}
                  style={{
                    ...cardStyle,
                    borderLeft: "3px solid var(--lemon-dark)",
                    fontSize: 12,
                    color: "var(--text2)",
                  }}
                >
                  <strong>
                    {o.product} — {o.size}
                  </strong>{" "}
                  has active order items (reserved should be{" "}
                  {o.expectedReserved}, sold should be {o.expectedSold}) but no
                  matching Inventory row exists. Add this size to the product to
                  track its stock.
                </div>
              ))}
            </div>
          )}

          {unknownStatusOrders.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--text2)",
                  marginBottom: 8,
                }}
              >
                Orders with an unrecognized status ({unknownStatusOrders.length}
                )
              </div>
              {unknownStatusOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    ...cardStyle,
                    borderLeft: "3px solid var(--text3)",
                    fontSize: 12,
                    color: "var(--text2)",
                  }}
                >
                  Order <strong>{o.orderNumber}</strong> has status "{o.status}"
                  — its items aren't counted as reserved or sold anywhere.
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          confirmVariant={confirmAction.confirmVariant}
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
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
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [filterSize, setFilterSize] = useState(""); // ← add
  const [filterCategory, setFilterCategory] = useState(""); // ← add
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [editingItems, setEditingItems] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [finalApproverId, setFinalApproverId] = useState("");
  const [signoffNote, setSignoffNote] = useState("");
  const [showRequstChangeDetail, toggleShowRequstChangeDetail] =
    useState(false);

  const allSizes = useMemo(
    () => sortSizes([...new Set(state.products.flatMap((p) => p.sizes || []))]),
    [state.products],
  );
  const allCategories = useMemo(
    () => [...new Set(state.products.map((p) => p.category).filter(Boolean))],
    [state.products],
  );
  const isSuperAdmin = state.currentUser?.role === "SUPER_ADMIN";

  useEffect(() => {
    api("/api/admin/accounts")
      .then(setAdmins)
      .catch(() => {});
  }, []);

  const eligibleApprovers = admins.filter(
    (a) =>
      a.isActive &&
      ["MANAGER", "SUPER_ADMIN"].includes(a.role) &&
      a.id !== state.currentUser?.id,
  );

  function roleLabel(role) {
    return (
      { SUPER_ADMIN: "Super Admin", MANAGER: "Manager", STAFF: "Staff" }[
        role
      ] || role
    );
  }
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

  useEffect(() => {
    setEditingItems(false);
    setReviewMode(false);
    setDraftItems([]);
    setFinalApproverId("");
    setSignoffNote("");
  }, [detail?.id]);

  // Client-side filter as a fast fallback while API data loads
  const filtered = allOrders
    .filter((o) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        o.childName?.toLowerCase().includes(q) ||
        o.parentName?.toLowerCase().includes(q) ||
        o.childClass?.toLowerCase().includes(q) ||
        o.orderNumber?.toLowerCase().includes(q);
      const matchStatus = !filterStatus || o.status === filterStatus;
      const matchLoc = !filterLoc || o.locationId === filterLoc;
      const matchSizeAndCategory =
        (!filterSize && !filterCategory) ||
        o.items.some((it) => {
          const cat = state.products.find(
            (p) => p.id === it.productId,
          )?.category;
          return (
            (!filterSize || it.size === filterSize) &&
            (!filterCategory || cat === filterCategory)
          );
        });
      return matchSearch && matchStatus && matchLoc && matchSizeAndCategory;
    })
    .sort((a, b) => b.orderNumber.localeCompare(a.orderNumber));
  function exportCSV() {
    const token = localStorage.getItem("ww_token");
    window.open(
      `${API_BASE_URL}/api/admin/orders/export?token=${token}`,
      "_blank",
    );
  }

  async function approveChangeRequest(changeRequestId) {
    try {
      const updatedOrder = await api(
        `/api/admin/change-requests/${changeRequestId}/approve`,
        {
          method: "PUT",
        },
      );
      setAllOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
      );
      setDetail(updatedOrder);
      dispatch({
        type: "SET_TOAST",
        message: "Change request approved — order updated.",
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to approve request",
      });
    }
  }

  async function rejectChangeRequest(changeRequestId) {
    if (!rejectNote.trim()) return;
    try {
      const updatedOrder = await api(
        `/api/admin/change-requests/${changeRequestId}/reject`,
        {
          method: "PUT",
          body: { note: rejectNote },
        },
      );
      setAllOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
      );
      setDetail(updatedOrder);
      setRejectingId(null);
      setRejectNote("");
      dispatch({ type: "SET_TOAST", message: "Change request rejected." });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to reject request",
      });
    }
  }

  function startEditItems(o) {
    setDraftItems(
      o.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        size: it.size,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    );
    setEditingItems(true);
    setReviewMode(false);
    setFinalApproverId("");
    setSignoffNote("");
  }

  function updateDraftItem(index, field, value) {
    setDraftItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? { ...it, [field]: field === "quantity" ? Number(value) : value }
          : it,
      ),
    );
  }

  function cancelEditItems() {
    setEditingItems(false);
    setDraftItems([]);
  }

  function handleContinueToReview() {
    const changed = draftItems.some((it, i) => {
      const orig = detail.items[i];
      return it.size !== orig.size || it.quantity !== orig.quantity;
    });
    if (!changed) {
      dispatch({
        type: "SET_TOAST",
        message: "Change at least one size or quantity before continuing.",
      });
      return;
    }
    setEditingItems(false);
    setReviewMode(true);
  }

  async function submitFinalApproval() {
    if (!finalApproverId) return;
    const changes = draftItems
      .map((it, i) => ({ it, orig: detail.items[i] }))
      .filter(
        ({ it, orig }) =>
          it.size !== orig.size || it.quantity !== orig.quantity,
      )
      .map(({ it, orig }) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: orig.quantity,
        fromSize: orig.size,
        toSize: it.size,
        ...(it.quantity !== orig.quantity && { toQuantity: it.quantity }),
      }));

    try {
      const updatedOrder = await api(
        `/api/admin/change-requests/${detail.id}/approve`,
        {
          method: "PUT",
          body: {
            orderId: detail.id,
            changes,
            finalApproverId,
            note: signoffNote,
          },
        },
      );
      setAllOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
      );
      setDetail(updatedOrder);
      setReviewMode(false);
      setDraftItems([]);
      setFinalApproverId("");
      setSignoffNote("");
      dispatch({
        type: "SET_TOAST",
        message: "Size exchange approved and applied.",
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to finalize size exchange",
      });
    }
  }

  function formatItemsText(items) {
    return items
      .map(
        (it) => `${it.productName} (${displaySize(it.size)}) x${it.quantity}`,
      )
      .join(", ");
  }

  function getLocationInitials(name) {
    if (!name) return "—";
    return name
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .join("");
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

  const getItemText = (o) => {
    const text = formatItemsText(o.items);
    const isLong = text.length > 150;
    const expanded = expandedItems.has(o.id);
    const shown =
      isLong && !expanded
        ? text.slice(0, 150).replace(/,\s*[^,]*$/, "") + "…"
        : text;

    return (
      <>
        {shown}
        {isLong && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpandedItems((prev) => {
                const next = new Set(prev);
                next.has(o.id) ? next.delete(o.id) : next.add(o.id);
                return next;
              });
            }}
            style={{
              marginLeft: 4,
              color: "var(--sky-dark)",
              whiteSpace: "nowrap",
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </a>
        )}
      </>
    );
  };
  const getStatusSelect = (o) => {
    const hasPendingChangeRequest =
      ["SUBMITTED", "REVIEW"].includes(o.status) &&
      o.changeRequests?.some((cr) => cr.status === "PENDING");

    if (
      o.status === "CANCELLED" ||
      o.status === "PICKED_UP" ||
      hasPendingChangeRequest
    ) {
      const [bg, col] = (STATUS_COLORS[o.status] || "#eef0f4:#5a6072").split(
        ":",
      );
      return (
        <span style={{ fontSize: 12, fontWeight: 700 }}>
          Status:{" "}
          <span
            className="txt-badge"
            style={{
              background: bg,
              color: col,
              padding: "3px 10px",
              borderRadius: 30,
            }}
          >
            {STATUS_LABELS[o.status]}
          </span>
          {hasPendingChangeRequest && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: "var(--peach-dark)",
                fontWeight: 700,
              }}
            >
              🔒 Resolve the size change request first
            </span>
          )}
        </span>
      );
    } else
      return (
        <>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Update status:</span>
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
        </>
      );
  };

  const getChangeRequestApproval = (detail) => {
    const getHistoricalRequest = () => {
      const resolved = (detail.changeRequests || []).filter(
        (r) => r.status !== "PENDING",
      );

      if (resolved.length === 0) return null;
      return (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text3)",
              marginBottom: 8,
            }}
          >
            Past Change Requests
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resolved.map((cr) => {
              const [bg, col] =
                cr.status === "APPROVED"
                  ? ["var(--mint)", "var(--mint-dark)"]
                  : ["var(--peach)", "var(--peach-dark)"];
              return (
                <div
                  key={cr.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      className="txt-badge"
                      style={{
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: 30,
                        background: bg,
                        color: col,
                      }}
                    >
                      {cr.status === "APPROVED" ? "✓ Approved" : "✕ Rejected"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>
                      {cr.reviewedAt
                        ? new Date(cr.reviewedAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    {cr.changes.map((c, i) => {
                      const removed = c.toQuantity === 0;
                      const toQty =
                        c.toQuantity != null ? c.toQuantity : c.quantity;
                      const left = `${displaySize(c.fromSize)} × ${c.quantity}`;
                      const right = removed
                        ? "Removed"
                        : `${displaySize(c.toSize)} × ${toQty}`;
                      return (
                        <div key={i}>
                          {c.productName}: {left} → {right}
                        </div>
                      );
                    })}
                  </div>
                  {cr.reviewedBy && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--text3)",
                      }}
                    >
                      {cr.status === "APPROVED" ? "Approved" : "Reviewed"} by{" "}
                      <strong>{cr.reviewedBy.name}</strong>
                      {cr.reviewedBy.role
                        ? ` (${roleLabel(cr.reviewedBy.role)})`
                        : ""}
                    </div>
                  )}
                  {cr.reviewNote && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--text3)",
                      }}
                    >
                      Note: {cr.reviewNote}
                    </div>
                  )}
                  {cr.status === "REJECTED" && cr.rejectionNote && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--peach-dark)",
                      }}
                    >
                      Note: {cr.rejectionNote}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };
    if (detail && detail.changeRequests?.length > 0) {
      const cr = detail.changeRequests?.find((r) => r.status === "PENDING");
      if (!cr) return getHistoricalRequest();
      return (
        <div
          style={{
            marginTop: 16,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: "var(--bg2)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              {detail.childName} · {detail.childClass}
            </span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              Requested {new Date(cr.requestedAt).toLocaleDateString()}
            </span>
          </div>
          <div style={{ padding: "10px 14px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  {["Item", "Change"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: ".04em",
                        textTransform: "uppercase",
                        color: "var(--text3)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, i) => {
                  const change = cr.changes.find(
                    (c) =>
                      c.productId === item.productId &&
                      c.fromSize === item.size,
                  );
                  const cellStyle = {
                    padding: "6px",
                    borderBottom: "0.5px solid var(--border)",
                  };

                  if (!change) {
                    return (
                      <tr key={i}>
                        <td style={cellStyle}>{item.productName}</td>
                        <td style={cellStyle}>
                          {displaySize(item.size)} × {item.quantity}
                        </td>
                      </tr>
                    );
                  }

                  const removed = change.toQuantity === 0;
                  const toQty =
                    change.toQuantity != null
                      ? change.toQuantity
                      : change.quantity;
                  const left = `${displaySize(change.fromSize)} × ${change.quantity}`;
                  const right = removed
                    ? "Removed"
                    : `${displaySize(change.toSize)} × ${toQty}`;

                  return (
                    <tr key={i}>
                      <td style={cellStyle}>{item.productName}</td>
                      <td
                        style={{
                          ...cellStyle,
                          fontWeight: 800,
                          color: removed
                            ? "var(--peach-dark)"
                            : "var(--mint-dark)",
                        }}
                      >
                        {left} → {right}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rejectingId === cr.id ? (
              <div style={{ marginTop: 12 }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Reason for rejection{" "}
                  <span style={{ color: "var(--peach-dark)" }}>*</span>
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Requested size is currently out of stock."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1.5px solid var(--peach-mid)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    fontFamily: "var(--font-body)",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <Btn
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                      setRejectingId(null);
                      setRejectNote("");
                    }}
                  >
                    Cancel
                  </Btn>
                  <Btn
                    variant="danger"
                    fullWidth
                    disabled={!rejectNote.trim()}
                    onClick={() => rejectChangeRequest(cr.id)}
                  >
                    Confirm Rejection
                  </Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Btn
                  variant="admin"
                  fullWidth
                  onClick={() => approveChangeRequest(cr.id)}
                >
                  ✅ Approve
                </Btn>
                <Btn
                  variant="softRed"
                  fullWidth
                  onClick={() => setRejectingId(cr.id)}
                >
                  ❌ Reject
                </Btn>
              </div>
            )}
          </div>
          {getHistoricalRequest()}
        </div>
      );
    }
  };

  const getChangeRequestDetail = (request) => {
    return (
      <>
        <div>Note: {cr.reviewNote}</div>
        <div>Final Approved by: {cr.reviewedById}</div>
      </>
    );
  };
  const getSizeExchangeReview = () => {
    const changedRows = draftItems
      .map((item, i) => ({ item, orig: detail.items[i] }))
      .filter(
        ({ item, orig }) =>
          item.size !== orig.size || item.quantity !== orig.quantity,
      );

    return (
      <div
        style={{
          marginTop: 16,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
        className="txt-sm"
      >
        <div style={{ padding: "10px 14px" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              background: "var(--peach)",
              color: "var(--peach-dark)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              marginBottom: 14,
            }}
          >
            <span>⚠️</span>
            <span>
              Because this order has already been picked up or paid, it requires
              another Super Admin/Manager to sign off
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Item", "Qty", "Current Size", "", "Requested Size"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        fontWeight: 800,
                        letterSpacing: ".04em",
                        textTransform: "uppercase",
                        color: "var(--text3)",
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
              {changedRows.map(({ item, orig }, i) => (
                <tr key={item.id || i}>
                  <td
                    style={{
                      padding: "6px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    {item.productName}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    {item.quantity !== orig.quantity ? (
                      <>
                        <span
                          style={{
                            color: "var(--text3)",
                            textDecoration: "line-through",
                          }}
                        >
                          ×{orig.quantity}
                        </span>{" "}
                        <span
                          style={{ fontWeight: 800, color: "var(--mint-dark)" }}
                        >
                          ×{item.quantity}
                        </span>
                      </>
                    ) : (
                      `×${item.quantity}`
                    )}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      borderBottom: "0.5px solid var(--border)",
                      color: "var(--text3)",
                      textDecoration:
                        item.size !== orig.size ? "line-through" : "none",
                    }}
                  >
                    {displaySize(orig.size)}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    {item.size !== orig.size ? "→" : ""}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      borderBottom: "0.5px solid var(--border)",
                      fontWeight: item.size !== orig.size ? 800 : 400,
                      color:
                        item.size !== orig.size
                          ? "var(--mint-dark)"
                          : "var(--text)",
                    }}
                  >
                    {displaySize(item.size)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              marginTop: 14,
              border: "1px dashed var(--peach-dark)",
              borderRadius: "var(--radius-sm)",
              padding: 12,
              background: "var(--bg2)",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: "var(--peach-dark)",
                marginBottom: 4,
              }}
            ></div>
            <select
              value={finalApproverId}
              onChange={(e) => setFinalApproverId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg)",
                outline: "none",
                marginBottom: 10,
              }}
            >
              <option value="">— Select final approver —</option>
              {eligibleApprovers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({roleLabel(a.role)})
                </option>
              ))}
            </select>
            <textarea
              value={signoffNote}
              onChange={(e) => setSignoffNote(e.target.value)}
              rows={2}
              placeholder="Optional note from the final approver…"
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-body)",
                resize: "vertical",
                outline: "none",
                marginBottom: 10,
              }}
            />
            <Btn
              variant="admin"
              fullWidth
              disabled={!finalApproverId}
              onClick={submitFinalApproval}
            >
              🔒 Final Approval
            </Btn>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Btn
              variant="ghost"
              fullWidth
              onClick={() => {
                setReviewMode(false);
                setDraftItems([]);
              }}
            >
              Back
            </Btn>
          </div>
        </div>
      </div>
    );
  };

  const getStatusUpdate = (o) => {
    const hasPendingChangeRequest =
      ["SUBMITTED", "REVIEW"].includes(o.status) &&
      o.changeRequests?.length > 0;
    if (o.status === "CANCELLED" || o.status === "PICKED_UP")
      return (
        <span
          style={{
            fontSize: 11,
            color: "var(--text3)",
            fontStyle: "italic",
            padding: "4px 8px",
            background: "var(--bg3)",
            borderRadius: "var(--radius-xs)",
            display: "inline-block",
          }}
        >
          Locked
        </span>
      );
    else
      return (
        <select
          value={o.status}
          onChange={(e) => handleStatusChange(o.id, e.target.value)}
          style={{
            padding: "4px 8px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xs)",
            // fontSize: 11,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          // Replace with:
          {Object.entries(STATUS_LABELS)
            .filter(([value]) => {
              if (o.status === "PICKED_UP" && value === "CANCELLED")
                return false;
              return true;
            })
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      );
  };

  const getItems = () => {
    const draftSubtotal = editingItems
      ? draftItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)
      : 0;
    const subtotalDisplay = editingItems
      ? draftSubtotal.toFixed(2)
      : parseFloat(detail.subtotal).toFixed(2);
    const discountAmountDisplay = editingItems
      ? (draftSubtotal * (detail.discountRate || 0)).toFixed(2)
      : isNaN(detail.discountAmount)
        ? "0.00"
        : detail.discountAmount;
    const totalDisplay = editingItems
      ? (draftSubtotal - draftSubtotal * (detail.discountRate || 0)).toFixed(2)
      : parseFloat(detail.totalAmount).toFixed(2);

    return (
      <>
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
            marginBottom: 10,
          }}
          className="txt-sm"
        >
          {(editingItems ? draftItems : detail.items).map((it, i) =>
            editingItems ? (
              <div
                key={it.id || i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom:
                    i < draftItems.length - 1
                      ? "0.5px solid var(--border)"
                      : "none",
                }}
              >
                <span style={{ flex: 1 }}>{it.productName}</span>
                <select
                  value={it.size}
                  onChange={(e) => updateDraftItem(i, "size", e.target.value)}
                  style={{
                    padding: "5px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs)",
                    background: "var(--bg)",
                    outline: "none",
                  }}
                >
                  {sortSizes(
                    state.products.find((p) => p.id === it.productId)?.sizes ||
                      [],
                  ).map((s) => (
                    <option key={s} value={s}>
                      {displaySize(s)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={it.quantity}
                  onChange={(e) =>
                    updateDraftItem(i, "quantity", e.target.value)
                  }
                  style={{
                    width: 52,
                    padding: "5px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs)",
                    background: "var(--bg)",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    fontWeight: 700,
                    width: 60,
                    textAlign: "right",
                  }}
                >
                  ${(it.unitPrice * it.quantity).toFixed(2)}
                </span>
              </div>
            ) : (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span>
                  {it.productName} ({displaySize(it.size)}) ×{it.quantity}
                </span>
                <span style={{ fontWeight: 700 }}>
                  ${(it.unitPrice * it.quantity).toFixed(2)}
                </span>
              </div>
            ),
          )}
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
              marginBottom: 2,
            }}
            className="txt-sm"
          >
            <span style={{ color: "var(--text3)" }}>Subtotal</span>
            <span>${subtotalDisplay}</span>
          </div>
          {detail.discountRate > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 2,
                color: "var(--peach-dark)",
              }}
            >
              <span>Discount ({(detail.discountRate * 100).toFixed(0)}%)</span>
              <span>−${discountAmountDisplay}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 900,
              color: "var(--sky-dark)",
              paddingTop: 6,
              borderTop: "1px solid var(--border)",
              marginTop: 4,
              fontSize: "14px",
            }}
          >
            <span>Total</span>
            <span>${totalDisplay}</span>
          </div>
        </div>
        {editingItems && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <Btn variant="admin" fullWidth onClick={handleContinueToReview}>
              Continue
            </Btn>
            <Btn variant="ghost" fullWidth onClick={cancelEditItems}>
              Cancel
            </Btn>
          </div>
        )}
      </>
    );
  };

  const getOrderDetail = () => {
    if (detail)
      return (
        <Modal
          title={`Order ${detail.orderNumber}`}
          onClose={() => setDetail(null)}
          width={920}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {getStatusSelect(detail)}
            </div>
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
            }}
          >
            <div>
              <div
                style={{ color: "var(--text3)", marginBottom: 1 }}
                className="txt-sm"
              >
                Child
              </div>
              <div style={{ fontWeight: 700 }} className="txt-sm">
                {detail.childName}
              </div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", marginBottom: 1 }}
                className="txt-sm"
              >
                Class
              </div>
              <div style={{ fontWeight: 700 }} className="txt-sm">
                {detail.childClass}
              </div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", marginBottom: 1 }}
                className="txt-sm"
              >
                Parent
              </div>
              <div style={{ fontWeight: 700 }} className="txt-sm">
                {detail.parentName}
              </div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", marginBottom: 1 }}
                className="txt-sm"
              >
                Phone
              </div>
              <div style={{ fontWeight: 700 }} className="txt-sm">
                {detail.parentPhone}
              </div>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <div
                style={{ color: "var(--text3)", marginBottom: 1 }}
                className="txt-sm"
              >
                Location
              </div>
              <div style={{ fontWeight: 700 }} className="txt-sm">
                {state.locations.find((l) => l.id === detail.locationId)
                  ?.name || detail.locationName}
              </div>
            </div>
          </div>
          {isSuperAdmin &&
            detail.status === "PICKED_UP" &&
            !reviewMode &&
            !detail.changeRequests?.some((cr) => cr.status === "PENDING") && (
              <>
                <div style={{ marginTop: 16 }} className="txt-sm">
                  {editingItems ? (
                    <Btn
                      variant="admin"
                      size="sm"
                      style={{ marginBottom: "5px" }}
                    >
                      ✏️ Editing
                    </Btn>
                  ) : (
                    <Btn
                      variant="admin"
                      size="sm"
                      onClick={() => startEditItems(detail)}
                      style={{ marginBottom: "5px" }}
                    >
                      ✏️ Edit Items
                    </Btn>
                  )}
                </div>
              </>
            )}
          {getItems()}
          {reviewMode && getSizeExchangeReview()}
          {getChangeRequestApproval(detail)}
        </Modal>
      );
  };
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
        <select // ← add
          value={filterSize}
          onChange={(e) => setFilterSize(e.target.value)}
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
          <option value="">All Sizes</option>
          {allSizes.map((s) => (
            <option key={s} value={s}>
              {displaySize(s)}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
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
          <option value="">All Categories</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
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
                  "Items",
                  "Total",
                  "Status",
                  "Submitted",
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
            <tbody className="txt-base">
              {filtered.map((o) => {
                const amount = parseFloat(o.totalAmount);
                return (
                  <tr
                    key={o.id}
                    style={{
                      cursor: "pointer",
                      transition: "background .15s",
                      background: o.changeRequests?.some(
                        (cr) => cr.status === "PENDING",
                      )
                        ? "#fffaf0"
                        : undefined,
                    }}
                    onClick={() => {
                      setDetail(o);
                    }}
                  >
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                        fontWeight: 700,
                        color: "var(--sky-dark)",
                        whiteSpace: "nowrap",
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
                      <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {o.childName}
                      </div>
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
                      }}
                    >
                      {getLocationInitials(
                        state.locations.find((l) => l.id === o.locationId)
                          ?.name || o.locationName,
                      )}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                      }}
                    >
                      {getItemText(o)}
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
                      {o.changeRequests?.some(
                        (cr) => cr.status === "PENDING",
                      ) && (
                        <span
                          className="txt-badge"
                          style={{
                            background: "var(--peach)",
                            color: "var(--peach-dark)",
                            padding: "3px 10px",
                            borderRadius: 30,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⚠ Change Requested
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                        color: "var(--text3)",
                        // fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "0.5px solid var(--border)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getStatusUpdate(o)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {getOrderDetail()}
    </div>
  );
}

function AdminMasterControl() {
  const { state, dispatch } = useApp();
  const [settings, setSettings] = useState({ ...state.settings });
  const [locations, setLocations] = useState(
    [...state.locations].sort((a, b) => a.name.localeCompare(b.name)),
  );
  const [fields, setFields] = useState([...state.formFields]);
  const [newLocName, setNewLocName] = useState("");
  const [tab, setTab] = useState("locations");
  const [pendingLogo, setPendingLogo] = useState(null); // { file, previewUrl }
  const [confirmAction, setConfirmAction] = useState(null);

  // Re-sync local state if the global state loads fresh data from the API
  useEffect(() => {
    setSettings({ ...state.settings });
  }, [state.settings]);
  useEffect(() => {
    setLocations(
      [...state.locations].sort((a, b) => a.name.localeCompare(b.name)),
    );
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
    // Validate Discount Rate format — must be a number between 0 and 1
    const rateStr = String(settings.discountRate).trim();
    const isValidRate =
      rateStr !== "" && /^(0(\.\d+)?|1(\.0+)?)$/.test(rateStr);

    if (!isValidRate) {
      dispatch({
        type: "SET_TOAST",
        message:
          "Discount Rate must be a number between 0 and 1 (e.g. 0, 0.15, 1).",
      });
      return;
    }

    try {
      // Upload pending logo first if one was selected
      if (pendingLogo) {
        const fd = new FormData();
        fd.append("logo", pendingLogo.file);
        const result = await apiUpload("/api/admin/settings/logo", fd);
        settings.logoUrl = result.logoUrl;
        URL.revokeObjectURL(pendingLogo.previewUrl);
        setPendingLogo(null);
      }
      const saved = await api("/api/admin/settings", {
        method: "PUT",
        body: { ...settings, discountRate: parseFloat(rateStr) },
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
  async function toggleLocationActive(id, currentlyActive) {
    try {
      const updatedLoc = await api(`/api/admin/locations/${id}`, {
        method: "PUT",
        body: { isActive: !currentlyActive },
      });
      const updated = locations.map((l) => (l.id === id ? updatedLoc : l));
      setLocations(updated);
      dispatch({ type: "UPDATE_LOCATION", location: updatedLoc });
      dispatch({
        type: "SET_TOAST",
        message: currentlyActive
          ? "Location deactivated"
          : "Location activated",
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update location",
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
                <span
                  style={{
                    flex: 1,
                    fontWeight: 700,
                    color: l.isActive ? "var(--text)" : "var(--text3)",
                  }}
                >
                  {l.name}
                  {!l.isActive && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--text3)",
                        marginLeft: 6,
                      }}
                    >
                      (Inactive)
                    </span>
                  )}
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
                  onClick={() =>
                    setConfirmAction({
                      message: l.isActive
                        ? `Deactivate location "${l.name}"? It will no longer be available for parents to select when placing orders.`
                        : `Activate location "${l.name}"? It will become available for parents to select when placing orders.`,
                      confirmLabel: l.isActive ? "Deactivate" : "Activate",
                      confirmVariant: l.isActive ? "peach" : "sky",
                      onConfirm: () => toggleLocationActive(l.id, l.isActive),
                    })
                  }
                  style={{
                    padding: "3px 9px",
                    border: "none",
                    borderRadius: 5,
                    background: l.isActive ? "var(--peach)" : "var(--sky)",
                    color: l.isActive ? "var(--peach-dark)" : "var(--sky-dark)",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {l.isActive ? "Deactivate" : "Activate"}
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
              {(pendingLogo || settings.logoUrl) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <img
                    src={
                      pendingLogo ? pendingLogo.previewUrl : settings.logoUrl
                    }
                    alt="Logo preview"
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
                  {pendingLogo && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--peach-dark)",
                        background: "var(--peach)",
                        padding: "2px 7px",
                        borderRadius: 30,
                      }}
                    >
                      UNSAVED
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setPendingLogo(null);
                      setSettings({ ...settings, logoUrl: "" });
                    }}
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
                  setPendingLogo({
                    file,
                    previewUrl: URL.createObjectURL(file),
                  });
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
                    setPendingLogo({
                      file,
                      previewUrl: URL.createObjectURL(file),
                    });
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
                    discountRate: v,
                  })
                }
              />
              <Input
                label="Minimum Stock Threshold (Orders will be blocked if available stock is at or below this number. Set to 0 to disable.)"
                value={String(settings.orderStockThreshold ?? 0)}
                onChange={(v) => {
                  const num = parseInt(v) || 0;
                  setSettings({
                    ...settings,
                    orderStockThreshold: Math.max(0, num),
                  });
                }}
                type="number"
                placeholder="0"
                min={0}
              />
            </div>
            <Input
              label="Admin Notification Emails (semicolon-separated)"
              value={settings.adminEmails || ""}
              onChange={(v) => setSettings({ ...settings, adminEmails: v })}
              placeholder="admin1@school.com; admin2@school.com"
            />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: -6 }}>
              These addresses receive new order and status change emails as a
              fallback. Use Admin Accounts to set per-user preferences instead.
            </p>
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
      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          confirmVariant={confirmAction.confirmVariant}
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
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
    if (!editForm.class?.trim()) {
      dispatch({ type: "SET_TOAST", message: "Class is required" });
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
        <tbody className="txt-base">
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

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  confirmVariant = "peach",
}) {
  const colors = {
    peach: { bg: "var(--peach)", color: "var(--peach-dark)" },
    sky: { bg: "var(--sky)", color: "var(--sky-dark)" },
  };
  const c = colors[confirmVariant] || colors.peach;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius)",
          padding: 28,
          maxWidth: 380,
          width: "100%",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: "var(--text)",
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              color: "var(--text2)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: c.bg,
              color: c.color,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN SHELL ──────────────────────────────────────────────
function AdminShell() {
  const { state, dispatch } = useApp();
  const { adminPage } = state;
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;
  // Desktop: sidebar starts open and is a permanent rail (collapsible to icons).
  // Mobile: sidebar starts closed and behaves as an overlay drawer.
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);

  // Keep sidebar state sensible when crossing the desktop/mobile breakpoint
  useEffect(() => {
    setSidebarOpen(isDesktop);
  }, [isDesktop]);

  // The role stored on the logged-in admin user
  const adminRole = state.currentUser?.role || "STAFF";
  const isSuperAdmin = adminRole === "SUPER_ADMIN";
  const isManager = adminRole === "MANAGER";
  const canManage = isSuperAdmin || isManager;
  const navigate = useNavigate();

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
      id: "audit",
      label: "Stock Audit",
      icon: "🩺",
      section: "Products",
      roles: ["SUPER_ADMIN", "MANAGER"],
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
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg2)",
        position: "relative",
      }}
    >
      {/* Mobile backdrop — closes the drawer on tap outside */}
      {!isDesktop && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 199,
          }}
        />
      )}

      {/* Sidebar — permanent rail on desktop, slide-over drawer on mobile */}
      <div
        style={{
          width: isDesktop ? (sidebarOpen ? 160 : 52) : 220,
          background: "var(--sky-dark-bg)",
          flexShrink: 0,
          transition: isDesktop ? "width .2s" : "transform .2s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...(isDesktop
            ? { position: "relative" }
            : {
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: 200,
                transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,.25)" : "none",
              }),
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
          {(sidebarOpen || !isDesktop) && (
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
        <div
          style={{ flex: 1, padding: "8px 0", overflowY: "auto", minHeight: 0 }}
        >
          {navItems.map((item, idx) => {
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;
            return (
              <div key={item.id}>
                {showSection && (sidebarOpen || !isDesktop) && (
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
                  onClick={() => {
                    dispatch({ type: "SET_ADMIN_PAGE", page: item.id });
                    if (!isDesktop) setSidebarOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: sidebarOpen || !isDesktop ? "8px 14px" : "8px",
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
                  {(sidebarOpen || !isDesktop) && (
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
            onClick={() => {
              dispatch({ type: "LOGOUT" });
              navigate("/admin");
            }}
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
              justifyContent:
                sidebarOpen || !isDesktop ? "flex-start" : "center",
            }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            {(sidebarOpen || !isDesktop) && "Sign out"}
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
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Admin Top Bar */}
        <div
          style={{
            background: "var(--bg)",
            borderBottom: "1px solid var(--border)",
            padding: isDesktop ? "10px 20px" : "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            {/* Hamburger — mobile only */}
            {!isDesktop && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 18,
                  color: "var(--text2)",
                  cursor: "pointer",
                  padding: 4,
                  flexShrink: 0,
                }}
              >
                ☰
              </button>
            )}
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: isDesktop ? 15 : 14,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {navItems.find((n) => n.id === adminPage)?.label || "Admin"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
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
                flexShrink: 0,
              }}
            >
              {(state.currentUser?.name || "A").charAt(0)}
            </div>
            {isDesktop && (
              <span
                style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}
              >
                {state.currentUser?.name || "Admin"}
              </span>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div
          style={{
            flex: 1,
            padding: isDesktop ? 20 : 12,
            overflowY: "auto",
            minHeight: 0,
            position: "relative",
          }}
        >
          {adminPage === "dashboard" && <AdminDashboard />}
          {adminPage === "parents" && <AdminParents />}
          {adminPage === "products" && <AdminProducts />}
          {adminPage === "inventory" && <AdminInventory />}
          {adminPage === "audit" &&
            (canManage ? <AdminInventoryAudit /> : <AccessDenied />)}
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
  const { state, dispatch } = useApp();
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editParent, setEditParent] = useState(null); // parent being edited
  const [editForm, setEditForm] = useState({}); // { firstName, lastName, phone }
  const [editSaving, setEditSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [childrenModal, setChildrenModal] = useState(null);

  const isSuperAdmin = state.currentUser?.role === "SUPER_ADMIN";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    api(`/api/admin/parents?${params}`)
      .then((data) =>
        setParents(
          (data.parents || []).sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(
              `${b.firstName} ${b.lastName}`,
            ),
          ),
        ),
      )
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

  async function handleDeleteParent(p) {
    try {
      await api(`/api/admin/parents/${p.id}`, { method: "DELETE" });
      setParents(parents.filter((x) => x.id !== p.id));
      dispatch({
        type: "SET_TOAST",
        message: `${p.firstName} ${p.lastName} deleted`,
      });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to delete parent",
      });
    }
  }

  function openEditParent(p) {
    setEditParent(p);
    setEditForm({
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone || "",
      email: p.email || "",
    });
  }

  function openChildrenModal(p) {
    // Use already-loaded children data — no API call needed
    const children = (p.children || []).map((c) => ({
      childName: `${c.firstName} ${c.lastName}`,
      childClass: c.class,
      orderCount: p._count?.orders || 0, // approximate — per-child count needs separate query
      totalSpent: 0,
      lastOrderDate: c.createdAt,
    }));
    setChildrenModal({ parent: p, children, loading: false });
  }

  async function handleSaveParent() {
    if (!editParent) return;
    setEditSaving(true);
    try {
      const updated = await api(`/api/admin/parents/${editParent.id}`, {
        method: "PUT",
        body: editForm,
      });
      setParents(
        parents.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
      );
      dispatch({ type: "SET_TOAST", message: "Parent updated!" });
      setEditParent(null);
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update parent",
      });
    } finally {
      setEditSaving(false);
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
              {[
                "Name",
                "Email",
                "Phone",
                "Children",
                "Orders",
                "Joined",
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
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="txt-base">
            {parents.map((p) => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>
                  {p.firstName} {p.lastName}
                </td>
                <td style={{ ...tdStyle, color: "var(--text2)" }}>{p.email}</td>
                <td style={tdStyle}>{p.phone || "—"}</td>
                <td style={tdStyle}>
                  <button
                    onClick={() => openChildrenModal(p)}
                    style={{
                      padding: "3px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: "var(--bg2)",
                      color: "var(--sky-dark)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    👧 {p.children?.length || 0}
                  </button>
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      // background: "var(--sky)",
                      // color: "var(--sky-dark)",
                      fontWeight: 800,
                      // fontSize: 11,
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
                      // fontSize: 11,
                    }}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => openEditParent(p)}
                      style={{
                        padding: "4px 10px",
                        border: "none",
                        borderRadius: 5,
                        // fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        background: "var(--sky)",
                        color: "var(--sky-dark)",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(p)}
                      style={{
                        padding: "4px 10px",
                        border: "none",
                        borderRadius: 5,
                        // fontSize: 11,
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
                    {isSuperAdmin && (
                      <button
                        onClick={() =>
                          setConfirmAction({
                            message: `Permanently delete ${p.firstName} ${p.lastName}? This will also delete all their associated orders and cannot be undone.`,
                            confirmLabel: "Delete",
                            confirmVariant: "peach",
                            onConfirm: () => handleDeleteParent(p),
                          })
                        }
                        style={{
                          padding: "4px 10px",
                          border: "none",
                          borderRadius: 5,
                          fontWeight: 700,
                          cursor: "pointer",
                          background: "var(--peach)",
                          color: "var(--peach-dark)",
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editParent && (
        <Modal
          title={`Edit — ${editParent.firstName} ${editParent.lastName}`}
          onClose={() => setEditParent(null)}
          width={400}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="First Name"
              value={editForm.firstName}
              onChange={(v) => setEditForm({ ...editForm, firstName: v })}
              required
            />
            <Input
              label="Last Name"
              value={editForm.lastName}
              onChange={(v) => setEditForm({ ...editForm, lastName: v })}
            />
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(v) => setEditForm({ ...editForm, phone: v })}
              type="tel"
            />
            <Input
              label="Set Temporary Password (leave blank to keep current)"
              type="password"
              value={editForm.password || ""}
              onChange={(v) => setEditForm({ ...editForm, password: v })}
            />
            {editForm.password && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--lemon-dark)",
                  background: "var(--lemon)",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-xs)",
                  marginTop: -4,
                }}
              >
                ⚠ Parent will be prompted to change their password on next
                login.
              </p>
            )}
            {/* <Input
              label="Email"
              value={editForm.email}
              onChange={(v) => setEditForm({ ...editForm, email: v })}
              type="email"
              required
            /> */}
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: -4 }}>
              Email cannot be changed.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Btn
                variant="admin"
                onClick={handleSaveParent}
                disabled={editSaving}
                style={{ flex: 1 }}
              >
                {editSaving ? "Saving…" : "Save Changes"}
              </Btn>
              <Btn variant="ghost" onClick={() => setEditParent(null)}>
                Cancel
              </Btn>
            </div>
          </div>
        </Modal>
      )}
      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          confirmVariant={confirmAction.confirmVariant}
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {childrenModal && (
        <Modal
          title={`Children — ${childrenModal.parent.firstName} ${childrenModal.parent.lastName}`}
          onClose={() => setChildrenModal(null)}
          width={440}
        >
          {childrenModal.children.length === 0 ? (
            <EmptyState
              emoji="👧"
              message="No children registered for this parent"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {childrenModal.children.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--bg2)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--sky)",
                      color: "var(--sky-dark)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {c.childName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {c.childName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text3)",
                        marginTop: 2,
                      }}
                    >
                      {c.childClass || "No class specified"}
                    </div>
                  </div>
                </div>
              ))}
              <div
                style={{
                  padding: "8px 14px",
                  background: "var(--bg3)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                  color: "var(--text2)",
                  textAlign: "center",
                }}
              >
                {childrenModal.children.length} child
                {childrenModal.children.length !== 1 ? "ren" : ""}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function AdminLoginPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
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
      navigate("/admin", { replace: true });
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(160deg,#d6ede5 0%,#f5f3ef 60%,#fdf8ec 100%)",
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-lg)",
          padding: 32,
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 60,
              height: 60,
              // borderRadius: "50%",
              // background: "var(--sky-dark-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 12px",
              overflow: "hidden",
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
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
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
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
            disabled={adminLoginLoading}
            style={{
              padding: "11px",
              background: "var(--sky-dark-bg)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontWeight: 800,
              cursor: adminLoginLoading ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body)",
              opacity: adminLoginLoading ? 0.7 : 1,
            }}
          >
            {adminLoginLoading ? "Logging in…" : "Log In to Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const navigate = useNavigate();
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

  useEffect(() => {
    // Warm up the Render server on app load
    fetch(`${API_BASE_URL}/health`).catch(() => {});
  }, []);
  // Restore session from localStorage so a page refresh doesn't log the user out
  useEffect(() => {
    const token = localStorage.getItem("ww_token");
    const role = localStorage.getItem("ww_role");
    if (!token || !role) return;
    const endpoint =
      role === "admin" ? "/api/admin/settings" : "/api/orders/mine";
    api(endpoint)
      .then(() => {
        const storedUser = (() => {
          try {
            return JSON.parse(localStorage.getItem("ww_user") || "null");
          } catch {
            return null;
          }
        })();
        if (storedUser) {
          dispatch({ type: "LOGIN", user: storedUser, role });
          navigate(`/${role}`, { replace: true });
          // Load children for parent accounts
          if (role === "parent") {
            api("/api/parents/children")
              .then((children) => dispatch({ type: "SET_CHILDREN", children }))
              .catch(() => {});
          }
        }
      })
      .catch(() => {
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
      navigate("/admin");
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
  function RootRedirect() {
    const { state } = useApp();
    const navigate = useNavigate();

    useEffect(() => {
      if (state.userRole === "admin") navigate("/admin", { replace: true });
      else if (state.userRole === "parent")
        navigate("/parent", { replace: true });
      else navigate("/parent", { replace: true }); // default to parent login
    }, [state.userRole]);

    return null;
  }

  return (
    <AppCtx.Provider value={{ state, dispatch }}>
      <style>{GLOBAL_CSS}</style>
      {/* Toast Notification */}
      {state.toast && (
        <Toast
          message={state.toast}
          onClose={() => dispatch({ type: "CLEAR_TOAST" })}
        />
      )}
      <Routes>
        <Route
          path="/parent/*"
          element={
            state.userRole === "parent" ? <ParentShell /> : <ParentLogin />
          }
        />
        <Route
          path="/admin/*"
          element={
            state.userRole === "admin" ? <AdminShell /> : <AdminLoginPage />
          }
        />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AppCtx.Provider>
  );
}
