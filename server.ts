import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';

dotenv.config();

const app = express();
const PORT = Number(process.env.SERVER_PORT) || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));

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

ensureColumn('properties', 'department', 'TEXT');
ensureColumn('properties', 'nightlyRate', 'REAL');
ensureColumn('properties', 'capacity', 'INTEGER DEFAULT 1');
ensureColumn('properties', 'images', 'TEXT');
ensureColumn('transactions', 'booking_id', 'INTEGER');
ensureColumn('bookings', 'amountTotal', 'REAL DEFAULT 0');
ensureColumn('bookings', 'amountPaid', 'REAL DEFAULT 0');
ensureColumn('bookings', 'refundIssued', 'INTEGER DEFAULT 0');
ensureColumn('tenants', 'source', 'TEXT');
ensureColumn('tenants', 'tags', 'TEXT');
ensureColumn('tenants', 'notes', 'TEXT');

const normalizeBookingMoney = (status: string, amountTotal: unknown, amountPaid: unknown, refundIssued: unknown) => {
  const total = Math.max(Number(amountTotal) || 0, 0);
  const paid = Math.max(Number(amountPaid) || 0, 0);
  const normalizedPaid = status === 'Confirmado' ? total : Math.min(paid, total || paid);

  return {
    total,
    paid: normalizedPaid,
    refunded: status === 'Cancelado' && Boolean(refundIssued),
  };
};

const syncBookingTransactions = (
  bookingId: number | bigint,
  booking: { tenant: string; property_id?: number; status: string; amountTotal?: number; amountPaid?: number; refundIssued?: boolean }
) => {
  db.prepare('DELETE FROM transactions WHERE booking_id = ?').run(bookingId);

  const { total, paid, refunded } = normalizeBookingMoney(booking.status, booking.amountTotal, booking.amountPaid, booking.refundIssued);
  const date = new Date().toISOString().split('T')[0];
  const propertyId = booking.property_id || null;

  if (booking.status === 'Confirmado' && total > 0) {
    db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(date, `Reserva confirmada - ${booking.tenant}`, propertyId, bookingId, total, 'Completado', 'income');
    return;
  }

  if (booking.status === 'Pendiente' && paid > 0) {
    db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(date, `Pago parcial reserva - ${booking.tenant}`, propertyId, bookingId, paid, 'Completado', 'income');
    return;
  }

  if (booking.status === 'Cancelado' && paid > 0) {
    db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(date, `Pago reserva cancelada - ${booking.tenant}`, propertyId, bookingId, paid, 'Completado', 'income');

    if (refunded) {
      db.prepare(
        'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(date, `Devolucion reserva cancelada - ${booking.tenant}`, propertyId, bookingId, paid, 'Completado', 'expense');
    }
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

const ensureTenantFromBooking = (name: string) => {
  const normalizedName = name.trim();
  if (!normalizedName) return;

  const existing = db.prepare('SELECT id FROM tenants WHERE lower(name) = lower(?)').get(normalizedName);
  if (!existing) {
    db.prepare(
      'INSERT INTO tenants (name, status, source, since) VALUES (?, ?, ?, ?)'
    ).run(normalizedName, 'HUESPED', 'Reserva', new Date().toISOString().split('T')[0]);
  }
};

const syncExistingBookingTenants = () => {
  const bookingTenants = db.prepare('SELECT DISTINCT tenant FROM bookings WHERE tenant IS NOT NULL AND trim(tenant) != ?').all('') as Array<{ tenant: string }>;
  bookingTenants.forEach((item) => ensureTenantFromBooking(item.tenant));
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

// ===== PROPERTIES =====
app.get('/api/properties', (req, res) => {
  try {
    const properties = db.prepare('SELECT * FROM properties ORDER BY id DESC').all();
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
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedDepartment = department || location;
    const normalizedNightlyRate = Number(nightlyRate ?? monthlyRate) || 0;
    const result = db.prepare(
      'INSERT INTO properties (name, location, status, monthlyRate, image, department, nightlyRate, capacity, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name,
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
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedDepartment = department || location;
    const normalizedNightlyRate = Number(nightlyRate ?? monthlyRate) || 0;
    db.prepare(
      'UPDATE properties SET name=?, location=?, status=?, monthlyRate=?, image=?, department=?, nightlyRate=?, capacity=?, images=? WHERE id=?'
    ).run(
      name,
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
    const result = db.prepare(
      'INSERT INTO tenants (name, email, phone, status, since, avatar, source, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, email, phone, status, since, avatar, source, tags, notes);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/tenants/:id', (req, res) => {
  try {
    const { name, email, phone, status, since, source, tags, notes } = req.body;
    const existing = db.prepare('SELECT name FROM tenants WHERE id = ?').get(req.params.id) as { name: string } | undefined;
    db.prepare(
      'UPDATE tenants SET name=?, email=?, phone=?, status=?, since=?, source=?, tags=?, notes=? WHERE id=?'
    ).run(name, email, phone, status, since, source, tags, notes, req.params.id);
    if (existing?.name && existing.name !== name) {
      db.prepare('UPDATE bookings SET tenant=? WHERE lower(tenant)=lower(?)').run(name, existing.name);
    }
    res.json({ id: parseInt(req.params.id), ...req.body });
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
    const { date, concept, property_id, booking_id, amount, status, type } = req.body;
    const result = db.prepare(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(date, concept, property_id, booking_id, amount, status, type);
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
    const { tenant, property_id, guests, checkIn, checkOut, status, amountTotal, amountPaid, refundIssued } = req.body;
    const dateError = validateBookingDates(checkIn, checkOut);
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    const conflict = findBookingConflict(Number(property_id), checkIn, checkOut);
    if (conflict) {
      return res.status(409).json({
        error: `Departamento ocupado hasta ${conflict.checkOut}`,
        conflict,
      });
    }

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued);
    ensureTenantFromBooking(tenant);
    const result = db.prepare(
      'INSERT INTO bookings (tenant, property_id, guests, checkIn, checkOut, status, amountTotal, amountPaid, refundIssued) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(tenant, property_id, guests, checkIn, checkOut, status, money.total, money.paid, money.refunded ? 1 : 0);
    syncBookingTransactions(result.lastInsertRowid, {
      tenant,
      property_id,
      status,
      amountTotal: money.total,
      amountPaid: money.paid,
      refundIssued: money.refunded,
    });
    res.json(getBookingById(result.lastInsertRowid));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/bookings/:id', (req, res) => {
  try {
    const { tenant, property_id, guests, checkIn, checkOut, status, amountTotal, amountPaid, refundIssued } = req.body;
    const dateError = validateBookingDates(checkIn, checkOut, true);
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    const conflict = findBookingConflict(Number(property_id), checkIn, checkOut, Number(req.params.id));
    if (conflict) {
      return res.status(409).json({
        error: `Departamento ocupado hasta ${conflict.checkOut}`,
        conflict,
      });
    }

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued);
    ensureTenantFromBooking(tenant);
    db.prepare(
      'UPDATE bookings SET tenant=?, property_id=?, guests=?, checkIn=?, checkOut=?, status=?, amountTotal=?, amountPaid=?, refundIssued=? WHERE id=?'
    ).run(tenant, property_id, guests, checkIn, checkOut, status, money.total, money.paid, money.refunded ? 1 : 0, req.params.id);
    syncBookingTransactions(Number(req.params.id), {
      tenant,
      property_id,
      status,
      amountTotal: money.total,
      amountPaid: money.paid,
      refundIssued: money.refunded,
    });
    res.json(getBookingById(Number(req.params.id)));
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
    const result = db.prepare(
      'INSERT INTO events (title, description, property_id, date, type) VALUES (?, ?, ?, ?, ?)'
    ).run(title, description, property_id, date, type);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/events/:id', (req, res) => {
  try {
    const { title, description, date, type } = req.body;
    db.prepare(
      'UPDATE events SET title=?, description=?, property_id=NULL, date=?, type=? WHERE id=?'
    ).run(title, description, date, type, req.params.id);
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
