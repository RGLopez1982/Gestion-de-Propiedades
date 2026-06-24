import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || process.env.SERVER_PORT) || 5000;
const distPath = path.join(process.cwd(), 'dist');
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

type TransactionRow = {
  id: number;
  date: string;
  concept: string;
  property_id?: number;
  booking_id?: number;
  amount: number;
  status: string;
  type: 'income' | 'expense';
  paidBy?: string;
  paymentMethod?: string;
  property?: string;
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const parseCookies = (cookieHeader?: string) => {
  return (cookieHeader || '').split(';').reduce<Record<string, string>>((cookies, item) => {
    const [rawKey, ...rawValue] = item.trim().split('=');
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join('=') || '');
    return cookies;
  }, {});
};

const signSession = (payload: string) => crypto
  .createHmac('sha256', SESSION_SECRET)
  .update(payload)
  .digest('hex');

const createSessionToken = (username: string) => {
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const payload = `${username}:${expiresAt}`;
  return `${payload}.${signSession(payload)}`;
};

const verifySessionToken = (token?: string) => {
  if (!token) return false;

  const separatorIndex = token.lastIndexOf('.');
  if (separatorIndex === -1) return false;

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = signSession(payload);
  if (signature.length !== expectedSignature.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false;

  const [, expiresAt] = payload.split(':');
  return Number(expiresAt) > Date.now();
};

const setSessionCookie = (res: express.Response, token: string) => {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `gp_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}${secure ? '; Secure' : ''}`
  );
};

const clearSessionCookie = (res: express.Response) => {
  res.setHeader('Set-Cookie', 'gp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const key = req.ip || 'local';
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.resetAt > Date.now() && attempt.count >= 5) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y volve a probar.' });
  }

  if (username !== AUTH_USER || password !== AUTH_PASSWORD) {
    const current = attempt && attempt.resetAt > Date.now()
      ? attempt
      : { count: 0, resetAt: Date.now() + 10 * 60 * 1000 };
    loginAttempts.set(key, { count: current.count + 1, resetAt: current.resetAt });
    return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
  }

  loginAttempts.delete(key);
  const token = createSessionToken(username);
  setSessionCookie(res, token);
  res.json({ authenticated: true, username, token });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ authenticated: false });
});

app.get('/api/auth/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  res.json({ authenticated: verifySessionToken(cookies.gp_session) || verifySessionToken(bearerToken) });
});

app.use('/api', (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!verifySessionToken(cookies.gp_session) && !verifySessionToken(bearerToken)) {
    return res.status(401).json({ error: 'Sesion no autorizada' });
  }
  next();
});

// Database
const dbPath = path.join(process.cwd(), process.env.DB_PATH || 'data.db');
const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT DEFAULT 'Disponible',
    monthlyRate REAL,
    occupancy INTEGER,
    image TEXT,
    department TEXT,
    nightlyRate REAL,
    capacity INTEGER DEFAULT 1,
    images TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    property_id INTEGER,
    status TEXT DEFAULT 'VIGENTE',
    since TEXT,
    avatar TEXT,
    source TEXT,
    tags TEXT,
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    concept TEXT NOT NULL,
    property_id INTEGER,
    booking_id INTEGER,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'Completado',
    type TEXT DEFAULT 'income',
    paidBy TEXT,
    paymentMethod TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    property_id INTEGER,
    guests INTEGER,
    checkIn TEXT NOT NULL,
    checkOut TEXT NOT NULL,
    status TEXT DEFAULT 'Confirmado',
    amountTotal REAL DEFAULT 0,
    amountPaid REAL DEFAULT 0,
    refundIssued INTEGER DEFAULT 0,
    refundAmount REAL DEFAULT 0,
    receivedBy TEXT,
    bookingSource TEXT,
    paymentMethod TEXT,
    receiptData TEXT,
    receiptName TEXT,
    receiptFiles TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    property_id INTEGER,
    date TEXT NOT NULL,
    type TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS finance_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    closedAt TEXT NOT NULL,
    periodLabel TEXT NOT NULL,
    income REAL NOT NULL DEFAULT 0,
    expense REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    ownerSettlements TEXT NOT NULL DEFAULT '[]',
    paymentTotals TEXT NOT NULL DEFAULT '[]',
    expenseRows TEXT NOT NULL DEFAULT '[]',
    transactionCount INTEGER NOT NULL DEFAULT 0,
    withdrawalTransactionId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS finance_cycle_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id INTEGER NOT NULL,
    transaction_id INTEGER NOT NULL,
    FOREIGN KEY(cycle_id) REFERENCES finance_cycles(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
  );
`);

const ensureColumn = (table: string, column: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
};

const parseImages = (images: unknown, image?: string) => {
  if (Array.isArray(images)) return images;
  if (typeof images === 'string' && images.trim()) {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [images];
    } catch {
      return [images];
    }
  }
  return image ? [image] : [];
};

const normalizePropertyRow = (property: any) => ({
  ...property,
  department: property.department || property.location,
  nightlyRate: Number(property.nightlyRate ?? property.monthlyRate ?? 0),
  monthlyRate: Number(property.monthlyRate ?? property.nightlyRate ?? 0),
  capacity: Math.min(Math.max(Number(property.capacity) || 1, 1), 4),
  images: parseImages(property.images, property.image),
});

const roundMoney = (value: unknown) => {
  const numeric = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

const upperText = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.trim().toLocaleUpperCase('es-AR');
};

const getApproxPayloadSize = (value: unknown) => JSON.stringify(value || '').length;
const allowedPropertyStatuses = ['Disponible', 'Ocupado', 'Mantenimiento'];
const allowedBookingStatuses = ['Confirmado', 'Pendiente', 'Cancelado'];

const validatePropertyInput = (data: {
  name?: string;
  department?: string;
  location?: string;
  status?: string;
  nightlyRate?: unknown;
  monthlyRate?: unknown;
  images?: unknown;
}) => {
  if (!String(data.name || '').trim()) return 'La propiedad debe tener nombre';
  if (!String(data.department || data.location || '').trim()) return 'La propiedad debe tener departamento';
  if (!allowedPropertyStatuses.includes(String(data.status || 'Disponible'))) return 'Estado de propiedad invalido';
  if (roundMoney(data.nightlyRate ?? data.monthlyRate) <= 0) return 'El precio por noche debe ser mayor a cero';
  if (Array.isArray(data.images) && data.images.length > 12) return 'Podes cargar hasta 12 imagenes por propiedad';
  if (getApproxPayloadSize(data.images) > 8 * 1024 * 1024) return 'Las imagenes de la propiedad superan el limite local de 8 MB';
  return null;
};

const validateBookingInput = (data: {
  tenant?: string;
  property_id?: unknown;
  guests?: unknown;
  status?: string;
  amountTotal?: unknown;
  amountPaid?: unknown;
  refundAmount?: unknown;
  receiptFiles?: unknown;
}) => {
  if (!String(data.tenant || '').trim()) return 'La reserva debe tener huesped';
  if (!allowedBookingStatuses.includes(String(data.status))) return 'Estado de reserva invalido';
  if (!data.property_id && data.status !== 'Cancelado') return 'La reserva debe tener departamento';
  if (Math.min(Math.max(Number(data.guests) || 1, 1), 4) !== Number(data.guests || 1)) return 'La cantidad de huespedes debe estar entre 1 y 4';
  const total = roundMoney(data.amountTotal);
  const paid = roundMoney(data.amountPaid);
  if (total < 0 || paid < 0) return 'Los importes no pueden ser negativos';
  if (paid > total && total > 0) return 'El pago recibido no puede superar el total';
  if (roundMoney(data.refundAmount) > paid) return 'La devolucion no puede superar el pago recibido';
  if (getApproxPayloadSize(data.receiptFiles) > 8 * 1024 * 1024) return 'Los comprobantes superan el limite local de 8 MB';
  return null;
};

db.prepare('UPDATE properties SET monthlyRate = ROUND(monthlyRate), nightlyRate = ROUND(nightlyRate)').run();
db.prepare('UPDATE bookings SET amountTotal = ROUND(amountTotal), amountPaid = ROUND(amountPaid)').run();
db.prepare('UPDATE transactions SET amount = ROUND(amount)').run();

ensureColumn('properties', 'department', 'TEXT');
ensureColumn('properties', 'nightlyRate', 'REAL');
ensureColumn('properties', 'capacity', 'INTEGER DEFAULT 1');
ensureColumn('properties', 'images', 'TEXT');
ensureColumn('transactions', 'booking_id', 'INTEGER');
ensureColumn('transactions', 'paidBy', 'TEXT');
ensureColumn('transactions', 'paymentMethod', 'TEXT');
ensureColumn('bookings', 'amountTotal', 'REAL DEFAULT 0');
ensureColumn('bookings', 'amountPaid', 'REAL DEFAULT 0');
ensureColumn('bookings', 'refundIssued', 'INTEGER DEFAULT 0');
ensureColumn('bookings', 'refundAmount', 'REAL DEFAULT 0');
ensureColumn('bookings', 'receivedBy', 'TEXT');
ensureColumn('bookings', 'bookingSource', 'TEXT');
ensureColumn('bookings', 'paymentMethod', 'TEXT');
ensureColumn('bookings', 'receiptData', 'TEXT');
ensureColumn('bookings', 'receiptName', 'TEXT');
ensureColumn('bookings', 'receiptFiles', 'TEXT');
ensureColumn('tenants', 'source', 'TEXT');
ensureColumn('tenants', 'tags', 'TEXT');
ensureColumn('tenants', 'notes', 'TEXT');

const normalizeBookingMoney = (status: string, amountTotal: unknown, amountPaid: unknown, refundIssued: unknown, refundAmount: unknown = 0) => {
  const total = Math.max(roundMoney(amountTotal), 0);
  const paid = Math.max(roundMoney(amountPaid), 0);
  const normalizedPaid = status === 'Confirmado' ? total : Math.min(paid, total || paid);
  const refund = Math.min(Math.max(roundMoney(refundAmount), 0), normalizedPaid);

  return {
    total,
    paid: normalizedPaid,
    refunded: status === 'Cancelado' && Boolean(refundIssued) && refund > 0,
    refundAmount: status === 'Cancelado' && Boolean(refundIssued) ? refund : 0,
  };
};

const OWNERS = ['Diego', 'Maru', 'Laura'];
const isWithdrawalConcept = (concept: unknown) => String(concept || '').toLowerCase().startsWith('cobro de fondos');
const isOwnerMatch = (value: unknown, owner: string) => String(value || '').trim().toUpperCase() === owner.toUpperCase();

const validateTransactionInput = (data: {
  date?: string;
  concept?: string;
  amount?: unknown;
  type?: string;
  paidBy?: string;
  paymentMethod?: string;
}) => {
  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return 'La transaccion debe tener una fecha valida';
  if (!String(data.concept || '').trim()) return 'La transaccion debe tener un concepto';
  if (!['income', 'expense'].includes(String(data.type))) return 'Tipo de transaccion invalido';
  if (roundMoney(data.amount) <= 0) return 'El monto debe ser mayor a cero';
  if (data.type === 'expense' && !String(data.paidBy || '').trim() && !isWithdrawalConcept(data.concept)) {
    return 'Los gastos deben indicar quien los pago';
  }
  if (data.type === 'income' && !String(data.paymentMethod || '').trim()) {
    return 'Los ingresos deben indicar el medio de pago';
  }
  return null;
};

const getProtectedTransactionError = (transaction: TransactionRow | undefined) => {
  if (!transaction) return 'Movimiento no encontrado';
  if (transaction.booking_id) return 'No se puede modificar un movimiento generado por una reserva. Edita la reserva para corregirlo.';
  if (isWithdrawalConcept(transaction.concept)) return 'No se puede modificar un cierre de ciclo.';
  const cycleItem = db.prepare('SELECT id FROM finance_cycle_items WHERE transaction_id = ? LIMIT 1').get(transaction.id);
  if (cycleItem) return 'No se puede modificar un movimiento de un ciclo ya cobrado.';
  return null;
};

const getTransactionById = (id: number | string) => db.prepare(`
  SELECT transactions.*, COALESCE(properties.department, properties.name) as property
  FROM transactions
  LEFT JOIN properties ON transactions.property_id = properties.id
  WHERE transactions.id = ?
`).get(id) as TransactionRow | undefined;

const getPendingPaymentBookings = () => db.prepare(`
  SELECT id, tenant, amountTotal, amountPaid, COALESCE(properties.department, properties.name) as property
  FROM bookings
  LEFT JOIN properties ON bookings.property_id = properties.id
  WHERE status != 'Cancelado'
    AND checkIn <= ?
    AND ROUND(COALESCE(amountTotal, 0)) > 0
    AND ROUND(COALESCE(amountPaid, 0)) < ROUND(COALESCE(amountTotal, 0))
  ORDER BY checkIn ASC
`).all(new Date().toISOString().split('T')[0]) as Array<{ id: number; tenant: string; property?: string; amountTotal: number; amountPaid: number }>;

const buildCycleSnapshot = () => {
  const lastCycle = db.prepare('SELECT withdrawalTransactionId FROM finance_cycles ORDER BY id DESC LIMIT 1').get() as
    | { withdrawalTransactionId?: number }
    | undefined;
  const sinceTransactionId = Number(lastCycle?.withdrawalTransactionId || 0);
  const cycleTransactions = db.prepare(`
    SELECT transactions.*, COALESCE(properties.department, properties.name) as property
    FROM transactions
    LEFT JOIN properties ON transactions.property_id = properties.id
    WHERE transactions.id > ?
      AND lower(transactions.concept) NOT LIKE 'cobro de fondos%'
    ORDER BY transactions.id ASC
  `).all(sinceTransactionId) as TransactionRow[];
  const income = cycleTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const expense = cycleTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const balance = income - expense;
  const baseShare = OWNERS.length > 0 ? balance / OWNERS.length : 0;
  const ownerSettlements = OWNERS.map((owner) => {
    const expensesPaid = cycleTransactions
      .filter((transaction) => transaction.type === 'expense' && isOwnerMatch(transaction.paidBy, owner))
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
    return {
      owner,
      expensesPaid: roundMoney(expensesPaid),
      profitShare: roundMoney(baseShare),
      payout: roundMoney(baseShare + expensesPaid),
    };
  });
  const paymentMap = cycleTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce<Record<string, number>>((acc, transaction) => {
      const method = transaction.paymentMethod || 'Sin especificar';
      acc[method] = (acc[method] || 0) + Number(transaction.amount || 0);
      return acc;
    }, {});
  const paymentTotals = Object.entries(paymentMap).map(([method, amount]) => ({ method, amount: roundMoney(amount) }));
  const expenseRows = cycleTransactions
    .filter((transaction) => transaction.type === 'expense')
    .map((transaction) => ({
      concept: transaction.concept,
      amount: roundMoney(Math.abs(Number(transaction.amount || 0))),
      paidBy: transaction.paidBy || 'Sin asignar',
    }));
  const firstDate = cycleTransactions[0]?.date || new Date().toISOString().split('T')[0];
  const closedAt = new Date().toISOString().split('T')[0];

  return {
    sinceTransactionId,
    cycleTransactions,
    closedAt,
    periodLabel: `${formatDateDisplay(firstDate)} a ${formatDateDisplay(closedAt)}`,
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(balance),
    ownerSettlements,
    paymentTotals,
    expenseRows,
  };
};

const createFinanceCycleFromTransactions = (withdrawal: TransactionRow, cycleTransactions: TransactionRow[]) => {
  if (cycleTransactions.length === 0) return null;

  const income = cycleTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const expense = cycleTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const balance = income - expense;
  const baseShare = OWNERS.length > 0 ? balance / OWNERS.length : 0;
  const ownerSettlements = OWNERS.map((owner) => {
    const expensesPaid = cycleTransactions
      .filter((transaction) => transaction.type === 'expense' && isOwnerMatch(transaction.paidBy, owner))
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
    return {
      owner,
      expensesPaid: roundMoney(expensesPaid),
      profitShare: roundMoney(baseShare),
      payout: roundMoney(baseShare + expensesPaid),
    };
  });
  const paymentMap = cycleTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce<Record<string, number>>((acc, transaction) => {
      const method = transaction.paymentMethod || 'Sin especificar';
      acc[method] = (acc[method] || 0) + Number(transaction.amount || 0);
      return acc;
    }, {});
  const paymentTotals = Object.entries(paymentMap).map(([method, amount]) => ({ method, amount: roundMoney(amount) }));
  const expenseRows = cycleTransactions
    .filter((transaction) => transaction.type === 'expense')
    .map((transaction) => ({
      concept: transaction.concept,
      amount: roundMoney(Math.abs(Number(transaction.amount || 0))),
      paidBy: transaction.paidBy || 'Sin asignar',
    }));

  const cycle = db.prepare(`
    INSERT INTO finance_cycles (
      closedAt, periodLabel, income, expense, balance, ownerSettlements, paymentTotals, expenseRows, transactionCount, withdrawalTransactionId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    withdrawal.date,
    `${formatDateDisplay(cycleTransactions[0].date)} a ${formatDateDisplay(withdrawal.date)}`,
    roundMoney(income),
    roundMoney(expense),
    roundMoney(balance),
    JSON.stringify(ownerSettlements),
    JSON.stringify(paymentTotals),
    JSON.stringify(expenseRows),
    cycleTransactions.length,
    withdrawal.id
  );

  const insertItem = db.prepare('INSERT INTO finance_cycle_items (cycle_id, transaction_id) VALUES (?, ?)');
  cycleTransactions.forEach((transaction) => insertItem.run(cycle.lastInsertRowid, transaction.id));
  return cycle.lastInsertRowid;
};

const backfillLegacyFinanceCycles = () => {
  const legacyWithdrawals = db.prepare(`
    SELECT transactions.*, COALESCE(properties.department, properties.name) as property
    FROM transactions
    LEFT JOIN properties ON transactions.property_id = properties.id
    WHERE lower(transactions.concept) LIKE 'cobro de fondos%'
      AND transactions.id NOT IN (
        SELECT COALESCE(withdrawalTransactionId, 0) FROM finance_cycles
      )
    ORDER BY transactions.id ASC
  `).all() as TransactionRow[];

  legacyWithdrawals.forEach((withdrawal) => {
    const previousWithdrawal = db.prepare(`
      SELECT id FROM transactions
      WHERE lower(concept) LIKE 'cobro de fondos%'
        AND id < ?
      ORDER BY id DESC
      LIMIT 1
    `).get(withdrawal.id) as { id: number } | undefined;
    const previousWithdrawalId = previousWithdrawal?.id || 0;
    const cycleTransactions = db.prepare(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      WHERE transactions.id > ?
        AND transactions.id < ?
        AND lower(transactions.concept) NOT LIKE 'cobro de fondos%'
      ORDER BY transactions.id ASC
    `).all(previousWithdrawalId, withdrawal.id) as TransactionRow[];

    createFinanceCycleFromTransactions(withdrawal, cycleTransactions);
  });
};

backfillLegacyFinanceCycles();

const syncBookingTransactions = (
  bookingId: number | bigint,
  booking: { tenant: string; property_id?: number; status: string; amountTotal?: number; amountPaid?: number; refundIssued?: boolean; refundAmount?: number; paymentMethod?: string }
) => {
  const { total, paid, refunded, refundAmount } = normalizeBookingMoney(booking.status, booking.amountTotal, booking.amountPaid, booking.refundIssued, booking.refundAmount);
  const date = new Date().toISOString().split('T')[0];
  const propertyId = booking.property_id || null;
  const closed = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
    FROM transactions
    WHERE booking_id = ?
      AND id IN (SELECT transaction_id FROM finance_cycle_items)
  `).get(bookingId) as { income: number; expense: number };

  db.prepare(`
    DELETE FROM transactions
    WHERE booking_id = ?
      AND id NOT IN (SELECT transaction_id FROM finance_cycle_items)
  `).run(bookingId);

  const targetIncome = booking.status === 'Confirmado'
    ? total
    : booking.status === 'Pendiente' || booking.status === 'Cancelado'
      ? paid
      : 0;
  const incomeDelta = roundMoney(targetIncome - Number(closed.income || 0));
  const refundDelta = roundMoney((refunded ? refundAmount : 0) - Number(closed.expense || 0));

  if (incomeDelta > 0) {
    const concept = booking.status === 'Pendiente'
      ? `Pago parcial reserva - ${booking.tenant}`
      : Number(closed.income || 0) > 0
        ? `Saldo reserva - ${booking.tenant}`
        : booking.status === 'Cancelado'
          ? `Pago reserva cancelada - ${booking.tenant}`
          : `Reserva confirmada - ${booking.tenant}`;
    db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(date, concept, propertyId, bookingId, incomeDelta, 'Completado', 'income', booking.paymentMethod || null);
  }

  if (incomeDelta < 0) {
    db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(date, `Ajuste pago reserva - ${booking.tenant}`, propertyId, bookingId, Math.abs(incomeDelta), 'Completado', 'expense');
  }

  if (refundDelta > 0) {
    db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(date, `Devolucion reserva cancelada - ${booking.tenant}`, propertyId, bookingId, refundDelta, 'Completado', 'expense');
  }

  if (refundDelta < 0) {
    db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(date, `Ajuste devolucion reserva - ${booking.tenant}`, propertyId, bookingId, Math.abs(refundDelta), 'Completado', 'income', booking.paymentMethod || null);
  }
};

const findBookingConflict = (propertyId: number, checkIn: string, checkOut: string, ignoreBookingId?: number) => {
  if (!propertyId || !checkIn || !checkOut) return null;

  return db.prepare(`
    SELECT id, tenant, checkIn, checkOut
    FROM bookings
    WHERE property_id = ?
      AND status != 'Cancelado'
      AND (? IS NULL OR id != ?)
      AND checkIn < ?
      AND checkOut > ?
    ORDER BY checkOut DESC
    LIMIT 1
  `).get(propertyId, ignoreBookingId ?? null, ignoreBookingId ?? null, checkOut, checkIn) as
    | { id: number; tenant: string; checkIn: string; checkOut: string }
    | undefined;
};

const getBookingById = (id: number | bigint) => {
  return db.prepare(`
    SELECT bookings.*, COALESCE(properties.department, properties.name) as property
    FROM bookings
    LEFT JOIN properties ON bookings.property_id = properties.id
    WHERE bookings.id = ?
  `).get(id);
};

const formatDateDisplay = (value?: string) => {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
};

const getReservablePropertyError = (propertyId: unknown) => {
  if (!propertyId) return 'La reserva debe tener un departamento asignado';

  const property = db.prepare('SELECT id, status FROM properties WHERE id = ?').get(propertyId) as { id: number; status: string } | undefined;
  if (!property) return 'Departamento no encontrado';
  if (property.status !== 'Disponible') return `El departamento esta ${property.status} y no se puede reservar`;

  return null;
};

const ensureTenantFromBooking = (
  name: string,
  booking: { property_id?: number; checkIn?: string; bookingSource?: string } = {}
) => {
  const normalizedName = upperText(name) as string;
  if (!normalizedName) return;

  const source = (upperText(booking.bookingSource) as string) || 'RESERVA';
  const since = booking.checkIn || new Date().toISOString().split('T')[0];
  const propertyId = booking.property_id || null;
  const existing = db.prepare(
    'SELECT id FROM tenants WHERE lower(trim(name)) = lower(trim(?))'
  ).get(normalizedName) as { id: number } | undefined;

  if (!existing) {
    db.prepare(
      'INSERT INTO tenants (name, property_id, status, source, since) VALUES (?, ?, ?, ?, ?)'
    ).run(normalizedName, propertyId, 'HUESPED', source, since);
    return;
  }

  db.prepare(`
    UPDATE tenants
    SET
      status = CASE
        WHEN status IS NULL OR trim(status) = '' OR status = 'CONTACTO' THEN 'HUESPED'
        ELSE status
      END,
      source = CASE
        WHEN source IS NULL OR trim(source) = '' THEN ?
        ELSE source
      END,
      since = CASE
        WHEN since IS NULL OR trim(since) = '' OR since > ? THEN ?
        ELSE since
      END,
      property_id = COALESCE(property_id, ?)
    WHERE id = ?
  `).run(source, since, since, propertyId, existing.id);
};

const syncExistingBookingTenants = () => {
  const bookingTenants = db.prepare(`
    SELECT tenant, property_id, MIN(checkIn) as checkIn, MAX(bookingSource) as bookingSource
    FROM bookings
    WHERE tenant IS NOT NULL AND trim(tenant) != ?
    GROUP BY lower(trim(tenant))
  `).all('') as Array<{ tenant: string; property_id?: number; checkIn?: string; bookingSource?: string }>;
  bookingTenants.forEach((item) => ensureTenantFromBooking(item.tenant, item));
};

syncExistingBookingTenants();

const validateBookingDates = (checkIn: string, checkOut: string, allowPastCheckIn = false) => {
  const today = new Date().toISOString().split('T')[0];

  if (!checkIn || !checkOut) {
    return 'La reserva debe tener fecha de ingreso y salida';
  }

  if (!allowPastCheckIn && checkIn < today) {
    return 'La fecha de inicio no puede ser anterior a hoy';
  }

  if (checkOut <= checkIn) {
    return 'La fecha de salida debe ser posterior a la fecha de ingreso';
  }

  return null;
};

let cachedBnaRate: { rate: number; timestamp: number } | null = null;

async function getBnaDollarRate(): Promise<number> {
  try {
    const response = await fetch('https://www.bna.com.ar/Personas', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });
    if (response.ok) {
      const html = await response.text();
      const billetesSection = html.split('id="billetes"')[1]?.split('</table>')[0] || '';
      const match = billetesSection.match(/Dolar U\.S\.A[\s\S]*?<td>([\d,.]+)<\/td>[\s\S]*?<td>([\d,.]+)<\/td>/i);
      if (match) {
        const sellStr = match[2].trim().replace(/\./g, '').replace(',', '.');
        const rate = parseFloat(sellStr);
        if (rate > 0 && !isNaN(rate)) {
          return rate;
        }
      }
    }
  } catch (e) {
    console.error('Error scraping BNA directly:', e);
  }

  // Fallback to DolarAPI
  try {
    const response = await fetch('https://dolarapi.com/v1/cotizaciones/bna');
    if (response.ok) {
      const data = await response.json() as { venta: number };
      if (data && data.venta > 0) {
        return data.venta;
      }
    }
  } catch (e) {
    console.error('Error fetching from DolarAPI fallback:', e);
  }

  return 1495.00; // default/fallback rate matching BNA rate
}

async function getCachedBnaRate() {
  const now = Date.now();
  if (cachedBnaRate && (now - cachedBnaRate.timestamp < 1000 * 60 * 60)) { // 1 hour cache
    return cachedBnaRate.rate;
  }
  try {
    const rate = await getBnaDollarRate();
    cachedBnaRate = { rate, timestamp: now };
    return rate;
  } catch (err) {
    return cachedBnaRate ? cachedBnaRate.rate : 1495.00;
  }
}

app.get('/api/bna-rate', async (_req, res) => {
  try {
    const rate = await getCachedBnaRate();
    res.json({ rate });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ===== PROPERTIES =====
app.get('/api/properties', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const properties = db.prepare(`
      SELECT properties.*,
        CASE
          WHEN properties.status != 'Disponible' THEN properties.status
          WHEN EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.property_id = properties.id
              AND bookings.status != 'Cancelado'
              AND bookings.checkIn <= ?
              AND bookings.checkOut > ?
          ) THEN 'Ocupado'
          ELSE 'Disponible'
        END as availabilityStatus
      FROM properties
      ORDER BY id DESC
    `).all(today, today);
    res.json(properties.map(normalizePropertyRow));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/properties/:id', (req, res) => {
  try {
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(normalizePropertyRow(property));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/properties', (req, res) => {
  try {
    const { name, department, location, status, nightlyRate, monthlyRate, capacity, images, image } = req.body;
    const validationError = validatePropertyInput({ name, department, location, status, nightlyRate, monthlyRate, images });
    if (validationError) return res.status(400).json({ error: validationError });
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedName = upperText(name) as string;
    const normalizedDepartment = (upperText(department || location) as string) || '';
    const normalizedNightlyRate = roundMoney(nightlyRate ?? monthlyRate);
    const result = db.prepare(
      'INSERT INTO properties (name, location, status, monthlyRate, image, department, nightlyRate, capacity, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      normalizedName,
      normalizedDepartment,
      status || 'Disponible',
      normalizedNightlyRate,
      normalizedImages[0],
      normalizedDepartment,
      normalizedNightlyRate,
      Math.min(Math.max(Number(capacity) || 1, 1), 4),
      JSON.stringify(normalizedImages)
    );
    res.json({
      id: result.lastInsertRowid,
      ...req.body,
      name: normalizedName,
      location: normalizedDepartment,
      monthlyRate: normalizedNightlyRate,
      department: normalizedDepartment,
      nightlyRate: normalizedNightlyRate,
      capacity: Math.min(Math.max(Number(capacity) || 1, 1), 4),
      image: normalizedImages[0],
      images: normalizedImages,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/properties/:id', (req, res) => {
  try {
    const { name, department, location, status, nightlyRate, monthlyRate, capacity, images, image } = req.body;
    const validationError = validatePropertyInput({ name, department, location, status, nightlyRate, monthlyRate, images });
    if (validationError) return res.status(400).json({ error: validationError });
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedName = upperText(name) as string;
    const normalizedDepartment = (upperText(department || location) as string) || '';
    const normalizedNightlyRate = roundMoney(nightlyRate ?? monthlyRate);
    db.prepare(
      'UPDATE properties SET name=?, location=?, status=?, monthlyRate=?, image=?, department=?, nightlyRate=?, capacity=?, images=? WHERE id=?'
    ).run(
      normalizedName,
      normalizedDepartment,
      status,
      normalizedNightlyRate,
      normalizedImages[0],
      normalizedDepartment,
      normalizedNightlyRate,
      Math.min(Math.max(Number(capacity) || 1, 1), 4),
      JSON.stringify(normalizedImages),
      req.params.id
    );
    res.json({
      id: parseInt(req.params.id),
      ...req.body,
      name: normalizedName,
      location: normalizedDepartment,
      monthlyRate: normalizedNightlyRate,
      department: normalizedDepartment,
      nightlyRate: normalizedNightlyRate,
      capacity: Math.min(Math.max(Number(capacity) || 1, 1), 4),
      image: normalizedImages[0],
      images: normalizedImages,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/properties/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM properties WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ===== TENANTS =====
app.get('/api/tenants', (req, res) => {
  try {
    const tenants = db.prepare(`
      SELECT
        tenants.*,
        (
          SELECT COALESCE(properties.department, properties.name)
          FROM bookings
          LEFT JOIN properties ON bookings.property_id = properties.id
          WHERE lower(bookings.tenant) = lower(tenants.name)
          ORDER BY bookings.checkIn DESC, bookings.id DESC
          LIMIT 1
        ) as property,
        COUNT(bookings.id) as staysCount,
        MAX(bookings.checkOut) as lastStay,
        MIN(bookings.checkIn) as firstStay,
        COALESCE(SUM(bookings.amountPaid), 0) as totalPaid
      FROM tenants
      LEFT JOIN bookings ON lower(bookings.tenant) = lower(tenants.name)
      GROUP BY tenants.id
      ORDER BY tenants.id DESC
    `).all();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/tenants/:id', (req, res) => {
  try {
    const tenant = db.prepare(`
      SELECT
        tenants.*,
        (
          SELECT COALESCE(properties.department, properties.name)
          FROM bookings
          LEFT JOIN properties ON bookings.property_id = properties.id
          WHERE lower(bookings.tenant) = lower(tenants.name)
          ORDER BY bookings.checkIn DESC, bookings.id DESC
          LIMIT 1
        ) as property,
        COUNT(bookings.id) as staysCount,
        MAX(bookings.checkOut) as lastStay,
        MIN(bookings.checkIn) as firstStay,
        COALESCE(SUM(bookings.amountPaid), 0) as totalPaid
      FROM tenants
      LEFT JOIN bookings ON lower(bookings.tenant) = lower(tenants.name)
      WHERE tenants.id = ?
      GROUP BY tenants.id
    `).get(req.params.id) as ({ name: string } & Record<string, unknown>) | undefined;
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const stays = db.prepare(`
      SELECT bookings.*, COALESCE(properties.department, properties.name) as property
      FROM bookings
      LEFT JOIN properties ON bookings.property_id = properties.id
      WHERE lower(bookings.tenant) = lower(?)
      ORDER BY bookings.checkIn DESC, bookings.id DESC
    `).all(tenant.name);
    const transactions = db.prepare(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      WHERE transactions.booking_id IN (
        SELECT id FROM bookings WHERE lower(tenant) = lower(?)
      )
      ORDER BY transactions.date DESC, transactions.id DESC
    `).all(tenant.name);
    res.json({ ...tenant, stays, transactions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/tenants', (req, res) => {
  try {
    const { name, email, phone, status, since, avatar, source, tags, notes } = req.body;
    const normalizedTenant = {
      name: upperText(name),
      email: upperText(email),
      phone: upperText(phone),
      source: upperText(source),
      tags: upperText(tags),
      notes: upperText(notes),
    };
    const result = db.prepare(
      'INSERT INTO tenants (name, email, phone, status, since, avatar, source, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(normalizedTenant.name, normalizedTenant.email, normalizedTenant.phone, status, since, avatar, normalizedTenant.source, normalizedTenant.tags, normalizedTenant.notes);
    res.json({ id: result.lastInsertRowid, ...req.body, ...normalizedTenant });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/tenants/:id', (req, res) => {
  try {
    const { name, email, phone, status, since, source, tags, notes } = req.body;
    const normalizedTenant = {
      name: upperText(name) as string,
      email: upperText(email),
      phone: upperText(phone),
      source: upperText(source),
      tags: upperText(tags),
      notes: upperText(notes),
    };
    const existing = db.prepare('SELECT name FROM tenants WHERE id = ?').get(req.params.id) as { name: string } | undefined;
    db.prepare(
      'UPDATE tenants SET name=?, email=?, phone=?, status=?, since=?, source=?, tags=?, notes=? WHERE id=?'
    ).run(normalizedTenant.name, normalizedTenant.email, normalizedTenant.phone, status, since, normalizedTenant.source, normalizedTenant.tags, normalizedTenant.notes, req.params.id);
    if (existing?.name && existing.name !== normalizedTenant.name) {
      db.prepare('UPDATE bookings SET tenant=? WHERE lower(tenant)=lower(?)').run(normalizedTenant.name, existing.name);
    }
    res.json({ id: parseInt(req.params.id), ...req.body, ...normalizedTenant });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/tenants/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tenants WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ===== TRANSACTIONS =====
app.get('/api/transactions', (req, res) => {
  try {
    const transactions = db.prepare(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      ORDER BY transactions.date DESC, transactions.id DESC
    `).all();
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    const { date, concept, property_id, booking_id, amount, status, type, paidBy, paymentMethod } = req.body;
    if (isWithdrawalConcept(concept)) {
      return res.status(400).json({ error: 'Usa el boton Cobrar para cerrar el ciclo con controles.' });
    }
    const validationError = validateTransactionInput({ date, concept, amount, type, paidBy, paymentMethod });
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedConcept = upperText(concept);
    const normalizedPaidBy = upperText(paidBy);
    const normalizedPaymentMethod = upperText(paymentMethod);
    const result = db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type, paidBy, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(date, normalizedConcept, property_id, booking_id, roundMoney(amount), status, type, normalizedPaidBy || null, normalizedPaymentMethod || null);
    const transaction = db.prepare(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      WHERE transactions.id = ?
    `).get(result.lastInsertRowid);
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/transactions/:id', (req, res) => {
  try {
    const existing = getTransactionById(req.params.id);
    const protectionError = getProtectedTransactionError(existing);
    if (protectionError) {
      return res.status(existing ? 409 : 404).json({ error: protectionError });
    }

    const { date, concept, property_id, amount, status, type, paidBy, paymentMethod } = req.body;
    if (isWithdrawalConcept(concept)) {
      return res.status(400).json({ error: 'Usa el boton Cobrar para cerrar el ciclo con controles.' });
    }
    const validationError = validateTransactionInput({ date, concept, amount, type, paidBy, paymentMethod });
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedConcept = upperText(concept);
    const normalizedPaidBy = upperText(paidBy);
    const normalizedPaymentMethod = upperText(paymentMethod);
    db.prepare(`
      UPDATE transactions
      SET date = ?, concept = ?, property_id = ?, amount = ?, status = ?, type = ?, paidBy = ?, paymentMethod = ?
      WHERE id = ?
    `).run(
      date,
      normalizedConcept,
      property_id || null,
      roundMoney(amount),
      status,
      type,
      type === 'expense' ? normalizedPaidBy || null : null,
      normalizedPaymentMethod || null,
      req.params.id
    );
    res.json(getTransactionById(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const existing = getTransactionById(req.params.id);
    const protectionError = getProtectedTransactionError(existing);
    if (protectionError) {
      return res.status(existing ? 409 : 404).json({ error: protectionError });
    }

    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ===== BOOKINGS =====
app.get('/api/bookings', (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT bookings.*, COALESCE(properties.department, properties.name) as property
      FROM bookings
      LEFT JOIN properties ON bookings.property_id = properties.id
      ORDER BY bookings.checkIn ASC, bookings.id DESC
    `).all();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/bookings', (req, res) => {
  try {
    const {
      tenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      amountTotal,
      amountPaid,
      refundIssued,
      refundAmount,
      receivedBy,
      bookingSource,
      paymentMethod,
      receiptData,
      receiptName,
      receiptFiles,
    } = req.body;
    const normalizedTenant = upperText(tenant) as string;
    const normalizedReceivedBy = upperText(receivedBy);
    const normalizedBookingSource = upperText(bookingSource);
    const normalizedPaymentMethod = upperText(paymentMethod);
    const bookingValidationError = validateBookingInput({ tenant, property_id, guests, status, amountTotal, amountPaid, refundAmount, receiptFiles });
    if (bookingValidationError) return res.status(400).json({ error: bookingValidationError });
    const dateError = validateBookingDates(checkIn, checkOut);
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    if (status !== 'Cancelado') {
      const propertyError = getReservablePropertyError(property_id);
      if (propertyError) {
        return res.status(400).json({ error: propertyError });
      }
    }

    if (status !== 'Cancelado') {
      const conflict = findBookingConflict(Number(property_id), checkIn, checkOut);
      if (conflict) {
        return res.status(409).json({
          error: `Departamento ocupado hasta ${formatDateDisplay(conflict.checkOut)}`,
          conflict,
        });
      }
    }

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued, refundAmount);
    ensureTenantFromBooking(normalizedTenant, { property_id, checkIn, bookingSource: normalizedBookingSource as string });
    const result = db.prepare(
      `INSERT INTO bookings (
        tenant, property_id, guests, checkIn, checkOut, status, amountTotal, amountPaid, refundIssued, refundAmount,
        receivedBy, bookingSource, paymentMethod, receiptData, receiptName, receiptFiles
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      normalizedTenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      money.total,
      money.paid,
      money.refunded ? 1 : 0,
      money.refundAmount,
      normalizedReceivedBy || null,
      normalizedBookingSource || null,
      normalizedPaymentMethod || null,
      receiptData || null,
      receiptName || null,
      Array.isArray(receiptFiles) ? JSON.stringify(receiptFiles) : receiptFiles || null
    );
    syncBookingTransactions(result.lastInsertRowid, {
      tenant: normalizedTenant,
      property_id,
      status,
      amountTotal: money.total,
      amountPaid: money.paid,
      refundIssued: money.refunded,
      refundAmount: money.refundAmount,
      paymentMethod: normalizedPaymentMethod as string,
    });
    res.json(getBookingById(result.lastInsertRowid));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/bookings/:id', (req, res) => {
  try {
    const {
      tenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      amountTotal,
      amountPaid,
      refundIssued,
      refundAmount,
      receivedBy,
      bookingSource,
      paymentMethod,
      receiptData,
      receiptName,
      receiptFiles,
    } = req.body;
    const normalizedTenant = upperText(tenant) as string;
    const normalizedReceivedBy = upperText(receivedBy);
    const normalizedBookingSource = upperText(bookingSource);
    const normalizedPaymentMethod = upperText(paymentMethod);
    const bookingValidationError = validateBookingInput({ tenant, property_id, guests, status, amountTotal, amountPaid, refundAmount, receiptFiles });
    if (bookingValidationError) return res.status(400).json({ error: bookingValidationError });
    const dateError = validateBookingDates(checkIn, checkOut, true);
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    if (status !== 'Cancelado') {
      const propertyError = getReservablePropertyError(property_id);
      if (propertyError) {
        return res.status(400).json({ error: propertyError });
      }
    }

    if (status !== 'Cancelado') {
      const conflict = findBookingConflict(Number(property_id), checkIn, checkOut, Number(req.params.id));
      if (conflict) {
        return res.status(409).json({
          error: `Departamento ocupado hasta ${formatDateDisplay(conflict.checkOut)}`,
          conflict,
        });
      }
    }

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued, refundAmount);
    ensureTenantFromBooking(normalizedTenant, { property_id, checkIn, bookingSource: normalizedBookingSource as string });
    db.prepare(
      `UPDATE bookings
       SET tenant=?, property_id=?, guests=?, checkIn=?, checkOut=?, status=?, amountTotal=?, amountPaid=?, refundIssued=?, refundAmount=?,
           receivedBy=?, bookingSource=?, paymentMethod=?, receiptData=?, receiptName=?, receiptFiles=?
       WHERE id=?`
    ).run(
      normalizedTenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      money.total,
      money.paid,
      money.refunded ? 1 : 0,
      money.refundAmount,
      normalizedReceivedBy || null,
      normalizedBookingSource || null,
      normalizedPaymentMethod || null,
      receiptData || null,
      receiptName || null,
      Array.isArray(receiptFiles) ? JSON.stringify(receiptFiles) : receiptFiles || null,
      req.params.id
    );
    syncBookingTransactions(Number(req.params.id), {
      tenant: normalizedTenant,
      property_id,
      status,
      amountTotal: money.total,
      amountPaid: money.paid,
      refundIssued: money.refunded,
      refundAmount: money.refundAmount,
      paymentMethod: normalizedPaymentMethod as string,
    });
    res.json(getBookingById(Number(req.params.id)));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/finance/cycles', (_req, res) => {
  try {
    const cycles = db.prepare(`
      SELECT *
      FROM finance_cycles
      ORDER BY id DESC
    `).all().map((cycle: any) => ({
      ...cycle,
      income: Number(cycle.income || 0),
      expense: Number(cycle.expense || 0),
      balance: Number(cycle.balance || 0),
      ownerSettlements: JSON.parse(cycle.ownerSettlements || '[]'),
      paymentTotals: JSON.parse(cycle.paymentTotals || '[]'),
      expenseRows: JSON.parse(cycle.expenseRows || '[]'),
    }));
    res.json(cycles);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/finance/close-cycle', (_req, res) => {
  const closeCycle = db.transaction(() => {
    const pendingBookings = getPendingPaymentBookings();
    if (pendingBookings.length > 0) {
      return { error: 'No se puede cobrar: hay reservas con pagos pendientes.', pendingBookings, status: 409 };
    }

    const snapshot = buildCycleSnapshot();
    if (snapshot.balance <= 0 || snapshot.cycleTransactions.length === 0) {
      return { error: 'No hay saldo disponible para cobrar.', status: 400 };
    }

    const withdrawal = db.prepare(`
      INSERT INTO transactions (date, concept, amount, status, type, paymentMethod)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(snapshot.closedAt, 'Cobro de fondos - cierre de ciclo', snapshot.balance, 'Completado', 'expense', 'Cierre de ciclo');

    const cycle = db.prepare(`
      INSERT INTO finance_cycles (
        closedAt, periodLabel, income, expense, balance, ownerSettlements, paymentTotals, expenseRows, transactionCount, withdrawalTransactionId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.closedAt,
      snapshot.periodLabel,
      snapshot.income,
      snapshot.expense,
      snapshot.balance,
      JSON.stringify(snapshot.ownerSettlements),
      JSON.stringify(snapshot.paymentTotals),
      JSON.stringify(snapshot.expenseRows),
      snapshot.cycleTransactions.length,
      withdrawal.lastInsertRowid
    );

    const insertItem = db.prepare('INSERT INTO finance_cycle_items (cycle_id, transaction_id) VALUES (?, ?)');
    snapshot.cycleTransactions.forEach((transaction) => insertItem.run(cycle.lastInsertRowid, transaction.id));

    const savedCycle = db.prepare('SELECT * FROM finance_cycles WHERE id = ?').get(cycle.lastInsertRowid) as any;
    const savedWithdrawal = db.prepare(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      WHERE transactions.id = ?
    `).get(withdrawal.lastInsertRowid);

    return {
      cycle: {
        ...savedCycle,
        income: Number(savedCycle.income || 0),
        expense: Number(savedCycle.expense || 0),
        balance: Number(savedCycle.balance || 0),
        ownerSettlements: JSON.parse(savedCycle.ownerSettlements || '[]'),
        paymentTotals: JSON.parse(savedCycle.paymentTotals || '[]'),
        expenseRows: JSON.parse(savedCycle.expenseRows || '[]'),
      },
      transaction: savedWithdrawal,
    };
  });

  try {
    const result = closeCycle();
    if ('error' in result) return res.status(result.status).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/bookings/:id', (req, res) => {
  try {
    const booking = db.prepare('SELECT id, amountPaid, checkIn, checkOut FROM bookings WHERE id=?').get(req.params.id) as
      | { id: number; amountPaid: number; checkIn: string; checkOut: string }
      | undefined;
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const today = new Date().toISOString().split('T')[0];
    if (Math.round(Number(booking.amountPaid || 0)) > 0) {
      return res.status(409).json({ error: 'No se puede eliminar una reserva con pagos registrados. Usá Cancelar.' });
    }
    if (booking.checkIn <= today && booking.checkOut > today) {
      return res.status(409).json({ error: 'No se puede eliminar una reserva en curso. Usá Cancelar.' });
    }
    if (booking.checkOut <= today) {
      return res.status(409).json({ error: 'No se puede eliminar una reserva finalizada.' });
    }

    db.prepare('DELETE FROM transactions WHERE booking_id=?').run(req.params.id);
    db.prepare('DELETE FROM bookings WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ===== EVENTS =====
app.get('/api/events', (req, res) => {
  try {
    const events = db.prepare(`
      SELECT events.*, COALESCE(properties.department, properties.name) as property
      FROM events
      LEFT JOIN properties ON events.property_id = properties.id
      ORDER BY events.date DESC, events.id DESC
    `).all();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/events', (req, res) => {
  try {
    const { title, description, property_id, date, type } = req.body;
    const normalizedTitle = upperText(title);
    const normalizedDescription = upperText(description);
    const normalizedType = upperText(type);
    const result = db.prepare(
      'INSERT INTO events (title, description, property_id, date, type) VALUES (?, ?, ?, ?, ?)'
    ).run(normalizedTitle, normalizedDescription, property_id, date, normalizedType);
    res.json({ id: result.lastInsertRowid, ...req.body, title: normalizedTitle, description: normalizedDescription, type: normalizedType });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/events/:id', (req, res) => {
  try {
    const { title, description, date, type } = req.body;
    const normalizedTitle = upperText(title);
    const normalizedDescription = upperText(description);
    const normalizedType = upperText(type);
    db.prepare(
      'UPDATE events SET title=?, description=?, property_id=NULL, date=?, type=? WHERE id=?'
    ).run(normalizedTitle, normalizedDescription, date, normalizedType, req.params.id);
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/events/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM events WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ===== SETTINGS =====
app.get('/api/settings/monthly-goal', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('monthlyGoal') as { value: string } | undefined;
    res.json({ monthlyGoal: row ? Number(row.value) : 0 });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/settings/monthly-goal', (req, res) => {
  try {
    const monthlyGoal = Number(req.body.monthlyGoal) || 0;
    db.prepare(`
      INSERT INTO settings (key, value, updatedAt)
      VALUES ('monthlyGoal', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
    `).run(String(monthlyGoal));
    res.json({ monthlyGoal });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Seed database with initial data
const seedDatabase = () => {
  const propertiesCount = db.prepare('SELECT COUNT(*) as count FROM properties').get() as { count: number };
  if (propertiesCount.count === 0) {
    db.prepare(`
      INSERT INTO properties (name, location, status, monthlyRate, image)
      VALUES 
        ('Residencias Alvear 402', 'Recoleta, Buenos Aires', 'Ocupado', 1200, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=600'),
        ('Loft San Telmo Tower', 'San Telmo, Buenos Aires', 'Disponible', 950, 'https://images.unsplash.com/photo-1536376074432-cd24f92613ce?auto=format&fit=crop&q=80&w=600'),
        ('Penthouse Madero Norte', 'Puerto Madero, CABA', 'Mantenimiento', 1500, 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&q=80&w=600'),
        ('Residencia Belgrano R', 'Belgrano, Buenos Aires', 'Ocupado', 1100, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d9568e?auto=format&fit=crop&q=80&w=600')
    `).run();

    db.prepare(`
      INSERT INTO tenants (name, email, phone, property_id, status, since, avatar)
      VALUES 
        ('Carlos Eduardo Ruiz', 'carlos@email.com', '+54911234567', 1, 'VIGENTE', 'Enero 2023', 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100&h=100'),
        ('Marco Antonio', 'marco@email.com', '+54911234568', 2, 'ENTRANTE', 'Octubre 2023', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100'),
        ('Elena Rossi', 'elena@email.com', '+54911234569', 1, 'VIGENTE', 'Mayo 2023', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100&h=100')
    `).run();

    db.prepare(`
      INSERT INTO transactions (date, concept, property_id, amount, status, type)
      VALUES 
        ('14 Sep 2023', 'Alquiler Mensual - Juan Pérez', 1, 1200, 'Completado', 'income'),
        ('12 Sep 2023', 'Limpieza Profunda', 1, 150, 'Completado', 'expense'),
        ('10 Sep 2023', 'Reparación Aire Acondicionado', 2, 450, 'Pendiente', 'expense'),
        ('08 Sep 2023', 'Alquiler Vacacional - 5 noches', 3, 2450, 'Completado', 'income'),
        ('05 Sep 2023', 'Mantenimiento de Jardín', 3, 80, 'Completado', 'expense'),
        ('02 Sep 2023', 'Alquiler Mensual - Elena Mora', 2, 950, 'Completado', 'income')
    `).run();

    db.prepare(`
      INSERT INTO bookings (tenant, property_id, guests, checkIn, checkOut, status)
      VALUES
        ('Alejandro Martinez', 1, 2, '2026-05-08', '2026-05-12', 'Confirmado'),
        ('Elena Rossi', 2, 1, '2026-05-15', '2026-05-18', 'Pendiente')
    `).run();

    db.prepare(`
      INSERT INTO events (title, description, property_id, date, type)
      VALUES
        ('Mantenimiento programado', 'Revision general de instalaciones', 3, '2026-05-10', 'Mantenimiento'),
        ('Evento local', 'Alta demanda esperada por evento cercano', 1, '2026-05-20', 'Precio')
    `).run();
  }
};

if (process.env.SEED_DEMO_DATA === 'true') {
  seedDatabase();
}

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📦 Database: ${dbPath}`);
});
