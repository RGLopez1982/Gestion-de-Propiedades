import express from 'express';
import crypto from 'crypto';
import pg from 'pg';

const app = express();
app.use(express.json({ limit: '25mb' }));

const { Pool } = pg;
let pool: pg.Pool | null = null;

const getPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurada');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
};

const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;

const parseCookies = (cookieHeader?: string) => {
  return (cookieHeader || '').split(';').reduce<Record<string, string>>((cookies, item) => {
    const [rawKey, ...rawValue] = item.trim().split('=');
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join('=') || '');
    return cookies;
  }, {});
};

const signSession = (payload: string) => crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');

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

const q = async <T = any>(text: string, params: unknown[] = []) => {
  const result = await getPool().query<T>(text, params);
  return result.rows;
};

const one = async <T = any>(text: string, params: unknown[] = []) => {
  const rows = await q<T>(text, params);
  return rows[0];
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
  monthlyRate: Number(property.monthlyRate ?? property.monthlyrate ?? property.monthly_rate ?? property.nightlyRate ?? property.nightlyrate ?? property.nightly_rate ?? 0),
  nightlyRate: Number(property.nightlyRate ?? property.nightlyrate ?? property.nightly_rate ?? property.monthlyRate ?? property.monthlyrate ?? property.monthly_rate ?? 0),
  createdAt: property.createdAt ?? property.createdat ?? property.created_at,
  department: property.department || property.location,
  capacity: Math.min(Math.max(Number(property.capacity) || 1, 1), 4),
  images: parseImages(property.images, property.image),
});

const normalizeBookingRow = (booking: any) => ({
  ...booking,
  property_id: booking.property_id ?? booking.propertyId,
  checkIn: booking.checkIn ?? booking.checkin ?? booking.check_in,
  checkOut: booking.checkOut ?? booking.checkout ?? booking.check_out,
  amountTotal: Number(booking.amountTotal ?? booking.amounttotal ?? booking.amount_total ?? 0),
  amountPaid: Number(booking.amountPaid ?? booking.amountpaid ?? booking.amount_paid ?? 0),
  refundIssued: booking.refundIssued ?? booking.refundissued ?? booking.refund_issued,
  receivedBy: booking.receivedBy ?? booking.receivedby ?? booking.received_by,
  bookingSource: booking.bookingSource ?? booking.bookingsource ?? booking.booking_source,
  paymentMethod: booking.paymentMethod ?? booking.paymentmethod ?? booking.payment_method,
  receiptData: booking.receiptData ?? booking.receiptdata ?? booking.receipt_data,
  receiptName: booking.receiptName ?? booking.receiptname ?? booking.receipt_name,
  receiptFiles: booking.receiptFiles ?? booking.receiptfiles ?? booking.receipt_files,
  createdAt: booking.createdAt ?? booking.createdat ?? booking.created_at,
});

const normalizeTenantRow = (tenant: any) => ({
  ...tenant,
  property_id: tenant.property_id ?? tenant.propertyId,
  staysCount: Number(tenant.staysCount ?? tenant.stayscount ?? 0),
  firstStay: tenant.firstStay ?? tenant.firststay,
  lastStay: tenant.lastStay ?? tenant.laststay,
  totalPaid: Number(tenant.totalPaid ?? tenant.totalpaid ?? 0),
  createdAt: tenant.createdAt ?? tenant.createdat ?? tenant.created_at,
});

const normalizeTransactionRow = (transaction: any) => ({
  ...transaction,
  property_id: transaction.property_id ?? transaction.propertyId,
  booking_id: transaction.booking_id ?? transaction.bookingId,
  amount: Number(transaction.amount || 0),
  createdAt: transaction.createdAt ?? transaction.createdat ?? transaction.created_at,
});

const normalizeEventRow = (event: any) => ({
  ...event,
  property_id: event.property_id ?? event.propertyId,
  createdAt: event.createdAt ?? event.createdat ?? event.created_at,
});

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

const formatDateDisplay = (value?: string) => {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
};

const validateBookingDates = (checkIn: string, checkOut: string, allowPastCheckIn = false) => {
  const today = new Date().toISOString().split('T')[0];
  if (!checkIn || !checkOut) return 'La reserva debe tener fecha de ingreso y salida';
  if (!allowPastCheckIn && checkIn < today) return 'La fecha de inicio no puede ser anterior a hoy';
  if (checkOut <= checkIn) return 'La fecha de salida debe ser posterior a la fecha de ingreso';
  return null;
};

const getBookingById = async (id: number | string) => {
  const booking = await one(`
    SELECT bookings.*, COALESCE(properties.department, properties.name) as property
    FROM bookings
    LEFT JOIN properties ON bookings.property_id = properties.id
    WHERE bookings.id = $1
  `, [id]);
  return normalizeBookingRow(booking);
};

const ensureTenantFromBooking = async (name: string) => {
  const normalizedName = name.trim();
  if (!normalizedName) return;

  const existing = await one('SELECT id FROM tenants WHERE lower(name) = lower($1)', [normalizedName]);
  if (!existing) {
    await q(
      'INSERT INTO tenants (name, status, source, since) VALUES ($1, $2, $3, $4)',
      [normalizedName, 'HUESPED', 'Reserva', new Date().toISOString().split('T')[0]]
    );
  }
};

const getReservablePropertyError = async (propertyId: unknown) => {
  if (!propertyId) return 'La reserva debe tener un departamento asignado';
  const property = await one<{ id: number; status: string }>('SELECT id, status FROM properties WHERE id = $1', [propertyId]);
  if (!property) return 'Departamento no encontrado';
  if (property.status !== 'Disponible') return `El departamento esta ${property.status} y no se puede reservar`;
  return null;
};

const findBookingConflict = async (propertyId: number, checkIn: string, checkOut: string, ignoreBookingId?: number) => {
  if (!propertyId || !checkIn || !checkOut) return null;
  return one(`
    SELECT id, tenant, check_in as "checkIn", check_out as "checkOut"
    FROM bookings
    WHERE property_id = $1
      AND status != 'Cancelado'
      AND ($2::int IS NULL OR id != $2)
      AND check_in < $3
      AND check_out > $4
    ORDER BY check_out DESC
    LIMIT 1
  `, [propertyId, ignoreBookingId ?? null, checkOut, checkIn]);
};

const syncBookingTransactions = async (
  bookingId: number | string,
  booking: { tenant: string; property_id?: number; status: string; amountTotal?: number; amountPaid?: number; refundIssued?: boolean }
) => {
  await q('DELETE FROM transactions WHERE booking_id = $1', [bookingId]);
  const { total, paid, refunded } = normalizeBookingMoney(booking.status, booking.amountTotal, booking.amountPaid, booking.refundIssued);
  const date = new Date().toISOString().split('T')[0];
  const propertyId = booking.property_id || null;

  if (booking.status === 'Confirmado' && total > 0) {
    await q(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [date, `Reserva confirmada - ${booking.tenant}`, propertyId, bookingId, total, 'Completado', 'income']
    );
    return;
  }

  if (booking.status === 'Pendiente' && paid > 0) {
    await q(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [date, `Pago parcial reserva - ${booking.tenant}`, propertyId, bookingId, paid, 'Completado', 'income']
    );
    return;
  }

  if (booking.status === 'Cancelado' && paid > 0) {
    await q(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [date, `Pago reserva cancelada - ${booking.tenant}`, propertyId, bookingId, paid, 'Completado', 'income']
    );

    if (refunded) {
      await q(
        'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [date, `Devolucion reserva cancelada - ${booking.tenant}`, propertyId, bookingId, paid, 'Completado', 'expense']
      );
    }
  }
};

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== AUTH_USER || password !== AUTH_PASSWORD) {
    return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
  }
  setSessionCookie(res, createSessionToken(username));
  res.json({ authenticated: true, username });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ authenticated: false });
});

app.get('/api/auth/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  res.json({ authenticated: verifySessionToken(cookies.gp_session) });
});

app.use('/api', (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  if (!verifySessionToken(cookies.gp_session)) return res.status(401).json({ error: 'Sesion no autorizada' });
  next();
});

app.get('/api/properties', async (_req, res) => {
  try {
    const properties = await q('SELECT * FROM properties ORDER BY id DESC');
    res.json(properties.map(normalizePropertyRow));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const property = await one('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(normalizePropertyRow(property));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/properties', async (req, res) => {
  try {
    const { name, department, location, status, nightlyRate, monthlyRate, capacity, images, image } = req.body;
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedDepartment = department || location;
    const normalizedNightlyRate = Number(nightlyRate ?? monthlyRate) || 0;
    const property = await one(`
      INSERT INTO properties (name, location, status, monthly_rate, image, department, nightly_rate, capacity, images)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      name,
      normalizedDepartment,
      status || 'Disponible',
      normalizedNightlyRate,
      normalizedImages[0],
      normalizedDepartment,
      normalizedNightlyRate,
      Math.min(Math.max(Number(capacity) || 1, 1), 4),
      JSON.stringify(normalizedImages),
    ]);
    res.json(normalizePropertyRow(property));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  try {
    const { name, department, location, status, nightlyRate, monthlyRate, capacity, images, image } = req.body;
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedDepartment = department || location;
    const normalizedNightlyRate = Number(nightlyRate ?? monthlyRate) || 0;
    const property = await one(`
      UPDATE properties
      SET name=$1, location=$2, status=$3, monthly_rate=$4, image=$5, department=$6, nightly_rate=$7, capacity=$8, images=$9
      WHERE id=$10
      RETURNING *
    `, [
      name,
      normalizedDepartment,
      status,
      normalizedNightlyRate,
      normalizedImages[0],
      normalizedDepartment,
      normalizedNightlyRate,
      Math.min(Math.max(Number(capacity) || 1, 1), 4),
      JSON.stringify(normalizedImages),
      req.params.id,
    ]);
    res.json(normalizePropertyRow(property));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    await q('DELETE FROM properties WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/tenants', async (_req, res) => {
  try {
    const tenants = await q(`
      SELECT
        tenants.*,
        (
          SELECT COALESCE(properties.department, properties.name)
          FROM bookings
          LEFT JOIN properties ON bookings.property_id = properties.id
          WHERE lower(bookings.tenant) = lower(tenants.name)
          ORDER BY bookings.check_in DESC, bookings.id DESC
          LIMIT 1
        ) as property,
        COUNT(bookings.id) as "staysCount",
        MAX(bookings.check_out) as "lastStay",
        MIN(bookings.check_in) as "firstStay",
        COALESCE(SUM(bookings.amount_paid), 0) as "totalPaid"
      FROM tenants
      LEFT JOIN bookings ON lower(bookings.tenant) = lower(tenants.name)
      GROUP BY tenants.id
      ORDER BY tenants.id DESC
    `);
    res.json(tenants.map(normalizeTenantRow));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await one(`
      SELECT
        tenants.*,
        (
          SELECT COALESCE(properties.department, properties.name)
          FROM bookings
          LEFT JOIN properties ON bookings.property_id = properties.id
          WHERE lower(bookings.tenant) = lower(tenants.name)
          ORDER BY bookings.check_in DESC, bookings.id DESC
          LIMIT 1
        ) as property,
        COUNT(bookings.id) as "staysCount",
        MAX(bookings.check_out) as "lastStay",
        MIN(bookings.check_in) as "firstStay",
        COALESCE(SUM(bookings.amount_paid), 0) as "totalPaid"
      FROM tenants
      LEFT JOIN bookings ON lower(bookings.tenant) = lower(tenants.name)
      WHERE tenants.id = $1
      GROUP BY tenants.id
    `, [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const stays = await q(`
      SELECT bookings.*, COALESCE(properties.department, properties.name) as property
      FROM bookings
      LEFT JOIN properties ON bookings.property_id = properties.id
      WHERE lower(bookings.tenant) = lower($1)
      ORDER BY bookings.check_in DESC, bookings.id DESC
    `, [tenant.name]);
    const transactions = await q(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      WHERE transactions.booking_id IN (
        SELECT id FROM bookings WHERE lower(tenant) = lower($1)
      )
      ORDER BY transactions.date DESC, transactions.id DESC
    `, [tenant.name]);
    res.json({
      ...normalizeTenantRow(tenant),
      stays: stays.map(normalizeBookingRow),
      transactions: transactions.map(normalizeTransactionRow),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    const { name, email, phone, status, since, avatar, source, tags, notes } = req.body;
    const tenant = await one(`
      INSERT INTO tenants (name, email, phone, status, since, avatar, source, tags, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, email, phone, status, since, avatar, source, tags, notes]);
    res.json(normalizeTenantRow(tenant));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/tenants/:id', async (req, res) => {
  try {
    const { name, email, phone, status, since, source, tags, notes } = req.body;
    const existing = await one<{ name: string }>('SELECT name FROM tenants WHERE id = $1', [req.params.id]);
    const tenant = await one(`
      UPDATE tenants SET name=$1, email=$2, phone=$3, status=$4, since=$5, source=$6, tags=$7, notes=$8
      WHERE id=$9
      RETURNING *
    `, [name, email, phone, status, since, source, tags, notes, req.params.id]);
    if (existing?.name && existing.name !== name) {
      await q('UPDATE bookings SET tenant=$1 WHERE lower(tenant)=lower($2)', [name, existing.name]);
    }
    res.json(normalizeTenantRow(tenant));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/tenants/:id', async (req, res) => {
  try {
    await q('DELETE FROM tenants WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/transactions', async (_req, res) => {
  try {
    const transactions = await q(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      ORDER BY transactions.date DESC, transactions.id DESC
    `);
    res.json(transactions.map(normalizeTransactionRow));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { date, concept, property_id, booking_id, amount, status, type } = req.body;
    const transaction = await one(`
      INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [date, concept, property_id, booking_id, amount, status, type]);
    res.json(normalizeTransactionRow(transaction));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/bookings', async (_req, res) => {
  try {
    const bookings = await q(`
      SELECT bookings.*, COALESCE(properties.department, properties.name) as property
      FROM bookings
      LEFT JOIN properties ON bookings.property_id = properties.id
      ORDER BY bookings.check_in ASC, bookings.id DESC
    `);
    res.json(bookings.map(normalizeBookingRow));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/bookings', async (req, res) => {
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
      receivedBy,
      bookingSource,
      paymentMethod,
      receiptData,
      receiptName,
      receiptFiles,
    } = req.body;
    const dateError = validateBookingDates(checkIn, checkOut);
    if (dateError) return res.status(400).json({ error: dateError });

    if (status !== 'Cancelado') {
      const propertyError = await getReservablePropertyError(property_id);
      if (propertyError) return res.status(400).json({ error: propertyError });
    }

    const conflict = await findBookingConflict(Number(property_id), checkIn, checkOut);
    if (conflict) return res.status(409).json({ error: `Departamento ocupado hasta ${formatDateDisplay(conflict.checkOut)}`, conflict });

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued);
    await ensureTenantFromBooking(tenant);
    const booking = await one(`
      INSERT INTO bookings (
        tenant, property_id, guests, check_in, check_out, status, amount_total, amount_paid, refund_issued,
        received_by, booking_source, payment_method, receipt_data, receipt_name, receipt_files
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      tenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      money.total,
      money.paid,
      money.refunded,
      receivedBy || null,
      bookingSource || null,
      paymentMethod || null,
      receiptData || null,
      receiptName || null,
      Array.isArray(receiptFiles) ? JSON.stringify(receiptFiles) : receiptFiles || null,
    ]);
    await syncBookingTransactions(booking.id, { tenant, property_id, status, amountTotal: money.total, amountPaid: money.paid, refundIssued: money.refunded });
    res.json(await getBookingById(booking.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/bookings/:id', async (req, res) => {
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
      receivedBy,
      bookingSource,
      paymentMethod,
      receiptData,
      receiptName,
      receiptFiles,
    } = req.body;
    const dateError = validateBookingDates(checkIn, checkOut, true);
    if (dateError) return res.status(400).json({ error: dateError });

    if (status !== 'Cancelado') {
      const propertyError = await getReservablePropertyError(property_id);
      if (propertyError) return res.status(400).json({ error: propertyError });
    }

    const conflict = await findBookingConflict(Number(property_id), checkIn, checkOut, Number(req.params.id));
    if (conflict) return res.status(409).json({ error: `Departamento ocupado hasta ${formatDateDisplay(conflict.checkOut)}`, conflict });

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued);
    await ensureTenantFromBooking(tenant);
    await one(`
      UPDATE bookings
      SET tenant=$1, property_id=$2, guests=$3, check_in=$4, check_out=$5, status=$6, amount_total=$7, amount_paid=$8,
          refund_issued=$9, received_by=$10, booking_source=$11, payment_method=$12, receipt_data=$13, receipt_name=$14, receipt_files=$15
      WHERE id=$16
      RETURNING *
    `, [
      tenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      money.total,
      money.paid,
      money.refunded,
      receivedBy || null,
      bookingSource || null,
      paymentMethod || null,
      receiptData || null,
      receiptName || null,
      Array.isArray(receiptFiles) ? JSON.stringify(receiptFiles) : receiptFiles || null,
      req.params.id,
    ]);
    await syncBookingTransactions(req.params.id, { tenant, property_id, status, amountTotal: money.total, amountPaid: money.paid, refundIssued: money.refunded });
    res.json(await getBookingById(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/events', async (_req, res) => {
  try {
    const events = await q(`
      SELECT events.*, COALESCE(properties.department, properties.name) as property
      FROM events
      LEFT JOIN properties ON events.property_id = properties.id
      ORDER BY events.date DESC, events.id DESC
    `);
    res.json(events.map(normalizeEventRow));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, description, property_id, date, type } = req.body;
    const event = await one(`
      INSERT INTO events (title, description, property_id, date, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [title, description, property_id, date, type]);
    res.json(normalizeEventRow(event));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { title, description, date, type } = req.body;
    const event = await one(`
      UPDATE events SET title=$1, description=$2, property_id=NULL, date=$3, type=$4
      WHERE id=$5
      RETURNING *
    `, [title, description, date, type, req.params.id]);
    res.json(normalizeEventRow(event));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await q('DELETE FROM events WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/settings/monthly-goal', async (_req, res) => {
  try {
    const row = await one<{ value: string }>('SELECT value FROM settings WHERE key = $1', ['monthlyGoal']);
    res.json({ monthlyGoal: row ? Number(row.value) : 0 });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/settings/monthly-goal', async (req, res) => {
  try {
    const monthlyGoal = Number(req.body.monthlyGoal) || 0;
    await q(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('monthlyGoal', $1, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [String(monthlyGoal)]);
    res.json({ monthlyGoal });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

export default app;
