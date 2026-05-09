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
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

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
  availabilityStatus: property.availabilityStatus ?? property.availabilitystatus ?? property.availability_status ?? property.status,
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

const normalizeBookingRow = (booking: any) => ({
  ...booking,
  property_id: booking.property_id ?? booking.propertyId,
  checkIn: booking.checkIn ?? booking.checkin ?? booking.check_in,
  checkOut: booking.checkOut ?? booking.checkout ?? booking.check_out,
  amountTotal: Number(booking.amountTotal ?? booking.amounttotal ?? booking.amount_total ?? 0),
  amountPaid: Number(booking.amountPaid ?? booking.amountpaid ?? booking.amount_paid ?? 0),
  refundIssued: booking.refundIssued ?? booking.refundissued ?? booking.refund_issued,
  refundAmount: Number(booking.refundAmount ?? booking.refundamount ?? booking.refund_amount ?? 0),
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
  paidBy: transaction.paidBy ?? transaction.paidby ?? transaction.paid_by,
  paymentMethod: transaction.paymentMethod ?? transaction.paymentmethod ?? transaction.payment_method,
  createdAt: transaction.createdAt ?? transaction.createdat ?? transaction.created_at,
});

const normalizeCycleRow = (cycle: any) => ({
  ...cycle,
  closedAt: cycle.closedAt ?? cycle.closedat ?? cycle.closed_at,
  periodLabel: cycle.periodLabel ?? cycle.periodlabel ?? cycle.period_label,
  income: Number(cycle.income || 0),
  expense: Number(cycle.expense || 0),
  balance: Number(cycle.balance || 0),
  ownerSettlements: JSON.parse(cycle.ownerSettlements ?? cycle.ownersettlements ?? cycle.owner_settlements ?? '[]'),
  paymentTotals: JSON.parse(cycle.paymentTotals ?? cycle.paymenttotals ?? cycle.payment_totals ?? '[]'),
  expenseRows: JSON.parse(cycle.expenseRows ?? cycle.expenserows ?? cycle.expense_rows ?? '[]'),
  transactionCount: Number(cycle.transactionCount ?? cycle.transactioncount ?? cycle.transaction_count ?? 0),
  withdrawalTransactionId: cycle.withdrawalTransactionId ?? cycle.withdrawaltransactionid ?? cycle.withdrawal_transaction_id,
  createdAt: cycle.createdAt ?? cycle.createdat ?? cycle.created_at,
});

const normalizeEventRow = (event: any) => ({
  ...event,
  property_id: event.property_id ?? event.propertyId,
  createdAt: event.createdAt ?? event.createdat ?? event.created_at,
});

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

const getTransactionById = async (id: number | string) => one(`
  SELECT transactions.*, COALESCE(properties.department, properties.name) as property
  FROM transactions
  LEFT JOIN properties ON transactions.property_id = properties.id
  WHERE transactions.id = $1
`, [id]);

const getProtectedTransactionError = async (transaction: any) => {
  if (!transaction) return 'Movimiento no encontrado';
  const normalizedTransaction = normalizeTransactionRow(transaction);
  if (normalizedTransaction.booking_id) return 'No se puede modificar un movimiento generado por una reserva. Edita la reserva para corregirlo.';
  if (isWithdrawalConcept(normalizedTransaction.concept)) return 'No se puede modificar un cierre de ciclo.';
  const cycleItem = await one('SELECT id FROM finance_cycle_items WHERE transaction_id = $1 LIMIT 1', [normalizedTransaction.id]);
  if (cycleItem) return 'No se puede modificar un movimiento de un ciclo ya cobrado.';
  return null;
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

const ensureTenantFromBooking = async (
  name: string,
  booking: { property_id?: number; checkIn?: string; bookingSource?: string } = {}
) => {
  const normalizedName = upperText(name) as string;
  if (!normalizedName) return;

  const source = (upperText(booking.bookingSource) as string) || 'RESERVA';
  const since = booking.checkIn || new Date().toISOString().split('T')[0];
  const propertyId = booking.property_id || null;
  const existing = await one<{ id: number }>('SELECT id FROM tenants WHERE lower(trim(name)) = lower(trim($1))', [normalizedName]);

  if (!existing) {
    await q(
      'INSERT INTO tenants (name, property_id, status, source, since) VALUES ($1, $2, $3, $4, $5)',
      [normalizedName, propertyId, 'HUESPED', source, since]
    );
    return;
  }

  await q(`
    UPDATE tenants
    SET
      status = CASE
        WHEN status IS NULL OR trim(status) = '' OR status = 'CONTACTO' THEN 'HUESPED'
        ELSE status
      END,
      source = CASE
        WHEN source IS NULL OR trim(source) = '' THEN $1
        ELSE source
      END,
      since = CASE
        WHEN since IS NULL OR trim(since) = '' OR since > $2 THEN $2
        ELSE since
      END,
      property_id = COALESCE(property_id, $3)
    WHERE id = $4
  `, [source, since, propertyId, existing.id]);
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
  booking: { tenant: string; property_id?: number; status: string; amountTotal?: number; amountPaid?: number; refundIssued?: boolean; refundAmount?: number; paymentMethod?: string }
) => {
  const { total, paid, refunded, refundAmount } = normalizeBookingMoney(booking.status, booking.amountTotal, booking.amountPaid, booking.refundIssued, booking.refundAmount);
  const date = new Date().toISOString().split('T')[0];
  const propertyId = booking.property_id || null;
  const closed = await one<{ income: number; expense: number }>(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
    FROM transactions
    WHERE booking_id = $1
      AND id IN (SELECT transaction_id FROM finance_cycle_items)
  `, [bookingId]);

  await q(`
    DELETE FROM transactions
    WHERE booking_id = $1
      AND id NOT IN (SELECT transaction_id FROM finance_cycle_items)
  `, [bookingId]);

  const closedIncome = Number(closed?.income || 0);
  const closedExpense = Number(closed?.expense || 0);
  const targetIncome = booking.status === 'Confirmado'
    ? total
    : booking.status === 'Pendiente' || booking.status === 'Cancelado'
      ? paid
      : 0;
  const incomeDelta = roundMoney(targetIncome - closedIncome);
  const refundDelta = roundMoney((refunded ? refundAmount : 0) - closedExpense);

  if (incomeDelta > 0) {
    const concept = booking.status === 'Pendiente'
      ? `Pago parcial reserva - ${booking.tenant}`
      : closedIncome > 0
        ? `Saldo reserva - ${booking.tenant}`
        : booking.status === 'Cancelado'
          ? `Pago reserva cancelada - ${booking.tenant}`
          : `Reserva confirmada - ${booking.tenant}`;
    await q(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type, payment_method) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [date, concept, propertyId, bookingId, incomeDelta, 'Completado', 'income', booking.paymentMethod || null]
    );
  }

  if (incomeDelta < 0) {
    await q(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [date, `Ajuste pago reserva - ${booking.tenant}`, propertyId, bookingId, Math.abs(incomeDelta), 'Completado', 'expense']
    );
  }

  if (refundDelta > 0) {
    await q(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [date, `Devolucion reserva cancelada - ${booking.tenant}`, propertyId, bookingId, refundDelta, 'Completado', 'expense']
    );
  }

  if (refundDelta < 0) {
    await q(
      'INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type, payment_method) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [date, `Ajuste devolucion reserva - ${booking.tenant}`, propertyId, bookingId, Math.abs(refundDelta), 'Completado', 'income', booking.paymentMethod || null]
    );
  }
};

const createFinanceCycleFromTransactions = async (withdrawal: any, cycleTransactions: any[]) => {
  if (cycleTransactions.length === 0) return null;

  const income = Math.round(cycleTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0));
  const expense = Math.round(cycleTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0));
  const balance = income - expense;
  const baseShare = OWNERS.length > 0 ? balance / OWNERS.length : 0;
  const ownerSettlements = OWNERS.map((owner) => {
    const expensesPaid = cycleTransactions
      .filter((transaction) => transaction.type === 'expense' && isOwnerMatch(transaction.paidBy, owner))
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
    return {
      owner,
      expensesPaid: Math.round(expensesPaid),
      profitShare: Math.round(baseShare),
      payout: Math.round(baseShare + expensesPaid),
    };
  });
  const paymentMap = cycleTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce<Record<string, number>>((acc, transaction) => {
      const method = transaction.paymentMethod || 'Sin especificar';
      acc[method] = (acc[method] || 0) + Number(transaction.amount || 0);
      return acc;
    }, {});
  const paymentTotals = Object.entries(paymentMap).map(([method, amount]) => ({ method, amount: Math.round(amount) }));
  const expenseRows = cycleTransactions
    .filter((transaction) => transaction.type === 'expense')
    .map((transaction) => ({
      concept: transaction.concept,
      amount: Math.round(Math.abs(Number(transaction.amount || 0))),
      paidBy: transaction.paidBy || 'Sin asignar',
    }));

  const cycle = await one(`
    INSERT INTO finance_cycles (
      closed_at, period_label, income, expense, balance, owner_settlements, payment_totals, expense_rows, transaction_count, withdrawal_transaction_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    withdrawal.date,
    `${formatDateDisplay(cycleTransactions[0].date)} a ${formatDateDisplay(withdrawal.date)}`,
    income,
    expense,
    balance,
    JSON.stringify(ownerSettlements),
    JSON.stringify(paymentTotals),
    JSON.stringify(expenseRows),
    cycleTransactions.length,
    withdrawal.id,
  ]);

  for (const transaction of cycleTransactions) {
    await q('INSERT INTO finance_cycle_items (cycle_id, transaction_id) VALUES ($1, $2)', [cycle.id, transaction.id]);
  }

  return cycle;
};

const backfillLegacyFinanceCycles = async () => {
  const legacyWithdrawals = await q(`
    SELECT transactions.*, COALESCE(properties.department, properties.name) as property
    FROM transactions
    LEFT JOIN properties ON transactions.property_id = properties.id
    WHERE lower(transactions.concept) LIKE 'cobro de fondos%'
      AND transactions.id NOT IN (
        SELECT COALESCE(withdrawal_transaction_id, 0) FROM finance_cycles
      )
    ORDER BY transactions.id ASC
  `);

  for (const withdrawal of legacyWithdrawals.map(normalizeTransactionRow)) {
    const previousWithdrawal = await one<{ id: number }>(`
      SELECT id FROM transactions
      WHERE lower(concept) LIKE 'cobro de fondos%'
        AND id < $1
      ORDER BY id DESC
      LIMIT 1
    `, [withdrawal.id]);
    const cycleTransactions = await q(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      WHERE transactions.id > $1
        AND transactions.id < $2
        AND lower(transactions.concept) NOT LIKE 'cobro de fondos%'
      ORDER BY transactions.id ASC
    `, [previousWithdrawal?.id || 0, withdrawal.id]);

    await createFinanceCycleFromTransactions(withdrawal, cycleTransactions.map(normalizeTransactionRow));
  }
};

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/db-check', async (_req, res) => {
  try {
    const result = await one<{ ok: number }>('SELECT 1 as ok');
    const tables = await q<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('properties', 'tenants', 'transactions', 'bookings', 'events', 'settings')
      ORDER BY table_name
    `);
    res.json({ ok: result?.ok === 1, tables: tables.map((item) => item.table_name) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const key = req.ip || String(req.headers['x-forwarded-for'] || 'default');
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

app.get('/api/properties', async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const properties = await q(`
      SELECT properties.*,
        CASE
          WHEN properties.status != 'Disponible' THEN properties.status
          WHEN EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.property_id = properties.id
              AND bookings.status != 'Cancelado'
              AND bookings.check_in <= $1
              AND bookings.check_out > $1
          ) THEN 'Ocupado'
          ELSE 'Disponible'
        END as availability_status
      FROM properties
      ORDER BY id DESC
    `, [today]);
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
    const validationError = validatePropertyInput({ name, department, location, status, nightlyRate, monthlyRate, images });
    if (validationError) return res.status(400).json({ error: validationError });
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedName = upperText(name) as string;
    const normalizedDepartment = (upperText(department || location) as string) || '';
    const normalizedNightlyRate = roundMoney(nightlyRate ?? monthlyRate);
    const property = await one(`
      INSERT INTO properties (name, location, status, monthly_rate, image, department, nightly_rate, capacity, images)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      normalizedName,
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
    const validationError = validatePropertyInput({ name, department, location, status, nightlyRate, monthlyRate, images });
    if (validationError) return res.status(400).json({ error: validationError });
    const normalizedImages = Array.isArray(images) ? images : image ? [image] : [];
    const normalizedName = upperText(name) as string;
    const normalizedDepartment = (upperText(department || location) as string) || '';
    const normalizedNightlyRate = roundMoney(nightlyRate ?? monthlyRate);
    const property = await one(`
      UPDATE properties
      SET name=$1, location=$2, status=$3, monthly_rate=$4, image=$5, department=$6, nightly_rate=$7, capacity=$8, images=$9
      WHERE id=$10
      RETURNING *
    `, [
      normalizedName,
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
    const normalizedTenant = {
      name: upperText(name),
      email: upperText(email),
      phone: upperText(phone),
      source: upperText(source),
      tags: upperText(tags),
      notes: upperText(notes),
    };
    const tenant = await one(`
      INSERT INTO tenants (name, email, phone, status, since, avatar, source, tags, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [normalizedTenant.name, normalizedTenant.email, normalizedTenant.phone, status, since, avatar, normalizedTenant.source, normalizedTenant.tags, normalizedTenant.notes]);
    res.json(normalizeTenantRow(tenant));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/tenants/:id', async (req, res) => {
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
    const existing = await one<{ name: string }>('SELECT name FROM tenants WHERE id = $1', [req.params.id]);
    const tenant = await one(`
      UPDATE tenants SET name=$1, email=$2, phone=$3, status=$4, since=$5, source=$6, tags=$7, notes=$8
      WHERE id=$9
      RETURNING *
    `, [normalizedTenant.name, normalizedTenant.email, normalizedTenant.phone, status, since, normalizedTenant.source, normalizedTenant.tags, normalizedTenant.notes, req.params.id]);
    if (existing?.name && existing.name !== normalizedTenant.name) {
      await q('UPDATE bookings SET tenant=$1 WHERE lower(tenant)=lower($2)', [normalizedTenant.name, existing.name]);
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
    const { date, concept, property_id, booking_id, amount, status, type, paidBy, paymentMethod } = req.body;
    if (isWithdrawalConcept(concept)) {
      return res.status(400).json({ error: 'Usa el boton Cobrar para cerrar el ciclo con controles.' });
    }
    const validationError = validateTransactionInput({ date, concept, amount, type, paidBy, paymentMethod });
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedConcept = upperText(concept);
    const normalizedPaidBy = upperText(paidBy);
    const normalizedPaymentMethod = upperText(paymentMethod);
    const transaction = await one(`
      INSERT INTO transactions (date, concept, property_id, booking_id, amount, status, type, paid_by, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [date, normalizedConcept, property_id, booking_id, roundMoney(amount), status, type, normalizedPaidBy || null, normalizedPaymentMethod || null]);
    res.json(normalizeTransactionRow(transaction));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const existing = await getTransactionById(req.params.id);
    const protectionError = await getProtectedTransactionError(existing);
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
    await q(`
      UPDATE transactions
      SET date = $1, concept = $2, property_id = $3, amount = $4, status = $5, type = $6, paid_by = $7, payment_method = $8
      WHERE id = $9
    `, [
      date,
      normalizedConcept,
      property_id || null,
      roundMoney(amount),
      status,
      type,
      type === 'expense' ? normalizedPaidBy || null : null,
      normalizedPaymentMethod || null,
      req.params.id,
    ]);
    res.json(normalizeTransactionRow(await getTransactionById(req.params.id)));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const existing = await getTransactionById(req.params.id);
    const protectionError = await getProtectedTransactionError(existing);
    if (protectionError) {
      return res.status(existing ? 409 : 404).json({ error: protectionError });
    }

    await q('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/finance/cycles', async (_req, res) => {
  try {
    await backfillLegacyFinanceCycles();
    const cycles = await q('SELECT * FROM finance_cycles ORDER BY id DESC');
    res.json(cycles.map(normalizeCycleRow));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/finance/close-cycle', async (_req, res) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const pendingResult = await client.query(`
      SELECT bookings.id, bookings.tenant, bookings.amount_total as "amountTotal", bookings.amount_paid as "amountPaid",
             COALESCE(properties.department, properties.name) as property
      FROM bookings
      LEFT JOIN properties ON bookings.property_id = properties.id
      WHERE bookings.status != 'Cancelado'
        AND bookings.check_in <= $1
        AND ROUND(COALESCE(bookings.amount_total, 0)) > 0
        AND ROUND(COALESCE(bookings.amount_paid, 0)) < ROUND(COALESCE(bookings.amount_total, 0))
      ORDER BY bookings.check_in ASC
    `, [new Date().toISOString().split('T')[0]]);
    if (pendingResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede cobrar: hay reservas con pagos pendientes.', pendingBookings: pendingResult.rows });
    }

    const lastCycleResult = await client.query('SELECT withdrawal_transaction_id FROM finance_cycles ORDER BY id DESC LIMIT 1');
    const sinceTransactionId = Number(lastCycleResult.rows[0]?.withdrawal_transaction_id || 0);
    const transactionResult = await client.query(`
      SELECT transactions.*, COALESCE(properties.department, properties.name) as property
      FROM transactions
      LEFT JOIN properties ON transactions.property_id = properties.id
      WHERE transactions.id > $1
        AND lower(transactions.concept) NOT LIKE 'cobro de fondos%'
      ORDER BY transactions.id ASC
    `, [sinceTransactionId]);
    const cycleTransactions = transactionResult.rows.map(normalizeTransactionRow);
    const income = Math.round(cycleTransactions
      .filter((transaction: any) => transaction.type === 'income')
      .reduce((sum: number, transaction: any) => sum + Number(transaction.amount || 0), 0));
    const expense = Math.round(cycleTransactions
      .filter((transaction: any) => transaction.type === 'expense')
      .reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)), 0));
    const balance = income - expense;
    if (balance <= 0 || cycleTransactions.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay saldo disponible para cobrar.' });
    }

    const baseShare = OWNERS.length > 0 ? balance / OWNERS.length : 0;
    const ownerSettlements = OWNERS.map((owner) => {
      const expensesPaid = cycleTransactions
        .filter((transaction: any) => transaction.type === 'expense' && isOwnerMatch(transaction.paidBy, owner))
        .reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)), 0);
      return {
        owner,
        expensesPaid: Math.round(expensesPaid),
        profitShare: Math.round(baseShare),
        payout: Math.round(baseShare + expensesPaid),
      };
    });
    const paymentMap = cycleTransactions
      .filter((transaction: any) => transaction.type === 'income')
      .reduce<Record<string, number>>((acc, transaction: any) => {
        const method = transaction.paymentMethod || 'Sin especificar';
        acc[method] = (acc[method] || 0) + Number(transaction.amount || 0);
        return acc;
      }, {});
    const paymentTotals = Object.entries(paymentMap).map(([method, amount]) => ({ method, amount: Math.round(amount) }));
    const expenseRows = cycleTransactions
      .filter((transaction: any) => transaction.type === 'expense')
      .map((transaction: any) => ({
        concept: transaction.concept,
        amount: Math.round(Math.abs(Number(transaction.amount || 0))),
        paidBy: transaction.paidBy || 'Sin asignar',
      }));
    const closedAt = new Date().toISOString().split('T')[0];
    const firstDate = cycleTransactions[0]?.date || closedAt;
    const periodLabel = `${formatDateDisplay(firstDate)} a ${formatDateDisplay(closedAt)}`;

    const withdrawalResult = await client.query(`
      INSERT INTO transactions (date, concept, amount, status, type, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [closedAt, 'Cobro de fondos - cierre de ciclo', balance, 'Completado', 'expense', 'Cierre de ciclo']);
    const withdrawal = withdrawalResult.rows[0];

    const cycleResult = await client.query(`
      INSERT INTO finance_cycles (
        closed_at, period_label, income, expense, balance, owner_settlements, payment_totals, expense_rows, transaction_count, withdrawal_transaction_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      closedAt,
      periodLabel,
      income,
      expense,
      balance,
      JSON.stringify(ownerSettlements),
      JSON.stringify(paymentTotals),
      JSON.stringify(expenseRows),
      cycleTransactions.length,
      withdrawal.id,
    ]);

    for (const transaction of cycleTransactions) {
      await client.query('INSERT INTO finance_cycle_items (cycle_id, transaction_id) VALUES ($1, $2)', [cycleResult.rows[0].id, transaction.id]);
    }

    await client.query('COMMIT');
    res.json({ cycle: normalizeCycleRow(cycleResult.rows[0]), transaction: normalizeTransactionRow(withdrawal) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    client.release();
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
    if (dateError) return res.status(400).json({ error: dateError });

    if (status !== 'Cancelado') {
      const propertyError = await getReservablePropertyError(property_id);
      if (propertyError) return res.status(400).json({ error: propertyError });
    }

    if (status !== 'Cancelado') {
      const conflict = await findBookingConflict(Number(property_id), checkIn, checkOut);
      if (conflict) return res.status(409).json({ error: `Departamento ocupado hasta ${formatDateDisplay(conflict.checkOut)}`, conflict });
    }

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued, refundAmount);
    await ensureTenantFromBooking(normalizedTenant, { property_id, checkIn, bookingSource: normalizedBookingSource as string });
    const booking = await one(`
      INSERT INTO bookings (
        tenant, property_id, guests, check_in, check_out, status, amount_total, amount_paid, refund_issued, refund_amount,
        received_by, booking_source, payment_method, receipt_data, receipt_name, receipt_files
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      normalizedTenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      money.total,
      money.paid,
      money.refunded,
      money.refundAmount,
      normalizedReceivedBy || null,
      normalizedBookingSource || null,
      normalizedPaymentMethod || null,
      receiptData || null,
      receiptName || null,
      Array.isArray(receiptFiles) ? JSON.stringify(receiptFiles) : receiptFiles || null,
    ]);
    await syncBookingTransactions(booking.id, { tenant: normalizedTenant, property_id, status, amountTotal: money.total, amountPaid: money.paid, refundIssued: money.refunded, refundAmount: money.refundAmount, paymentMethod: normalizedPaymentMethod as string });
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
    if (dateError) return res.status(400).json({ error: dateError });

    if (status !== 'Cancelado') {
      const propertyError = await getReservablePropertyError(property_id);
      if (propertyError) return res.status(400).json({ error: propertyError });
    }

    if (status !== 'Cancelado') {
      const conflict = await findBookingConflict(Number(property_id), checkIn, checkOut, Number(req.params.id));
      if (conflict) return res.status(409).json({ error: `Departamento ocupado hasta ${formatDateDisplay(conflict.checkOut)}`, conflict });
    }

    const money = normalizeBookingMoney(status, amountTotal, amountPaid, refundIssued, refundAmount);
    await ensureTenantFromBooking(normalizedTenant, { property_id, checkIn, bookingSource: normalizedBookingSource as string });
    await one(`
      UPDATE bookings
      SET tenant=$1, property_id=$2, guests=$3, check_in=$4, check_out=$5, status=$6, amount_total=$7, amount_paid=$8,
          refund_issued=$9, refund_amount=$10, received_by=$11, booking_source=$12, payment_method=$13, receipt_data=$14, receipt_name=$15, receipt_files=$16
      WHERE id=$17
      RETURNING *
    `, [
      normalizedTenant,
      property_id,
      guests,
      checkIn,
      checkOut,
      status,
      money.total,
      money.paid,
      money.refunded,
      money.refundAmount,
      normalizedReceivedBy || null,
      normalizedBookingSource || null,
      normalizedPaymentMethod || null,
      receiptData || null,
      receiptName || null,
      Array.isArray(receiptFiles) ? JSON.stringify(receiptFiles) : receiptFiles || null,
      req.params.id,
    ]);
    await syncBookingTransactions(req.params.id, { tenant: normalizedTenant, property_id, status, amountTotal: money.total, amountPaid: money.paid, refundIssued: money.refunded, refundAmount: money.refundAmount, paymentMethod: normalizedPaymentMethod as string });
    res.json(await getBookingById(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const booking = await one<{ id: number; amount_paid: number; check_in: string; check_out: string }>(
      'SELECT id, amount_paid, check_in, check_out FROM bookings WHERE id = $1',
      [req.params.id]
    );
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const today = new Date().toISOString().split('T')[0];
    if (Math.round(Number(booking.amount_paid || 0)) > 0) {
      return res.status(409).json({ error: 'No se puede eliminar una reserva con pagos registrados. Usá Cancelar.' });
    }
    if (booking.check_in <= today && booking.check_out > today) {
      return res.status(409).json({ error: 'No se puede eliminar una reserva en curso. Usá Cancelar.' });
    }
    if (booking.check_out <= today) {
      return res.status(409).json({ error: 'No se puede eliminar una reserva finalizada.' });
    }

    await q('DELETE FROM transactions WHERE booking_id = $1', [req.params.id]);
    await q('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
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
    const normalizedTitle = upperText(title);
    const normalizedDescription = upperText(description);
    const normalizedType = upperText(type);
    const event = await one(`
      INSERT INTO events (title, description, property_id, date, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [normalizedTitle, normalizedDescription, property_id, date, normalizedType]);
    res.json(normalizeEventRow(event));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { title, description, date, type } = req.body;
    const normalizedTitle = upperText(title);
    const normalizedDescription = upperText(description);
    const normalizedType = upperText(type);
    const event = await one(`
      UPDATE events SET title=$1, description=$2, property_id=NULL, date=$3, type=$4
      WHERE id=$5
      RETURNING *
    `, [normalizedTitle, normalizedDescription, date, normalizedType, req.params.id]);
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
