// API Service for property management

const API_BASE = '/api';
const SESSION_TOKEN_KEY = 'gp_session_token';

const getApiError = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => null);
  return data?.error || `${fallback} (${res.status})`;
};

const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
};

export const getSession = async (): Promise<{ authenticated: boolean }> => {
  const res = await apiFetch(`${API_BASE}/auth/me`);
  if (!res.ok) return { authenticated: false };
  return res.json();
};

export const login = async (username: string, password: string): Promise<void> => {
  try {
    const res = await apiFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

  if (!res.ok) {
      throw new Error(await getApiError(res, 'No se pudo iniciar sesion'));
    }

    const data = await res.json().catch(() => null);
    if (data?.token) {
      localStorage.setItem(SESSION_TOKEN_KEY, data.token);
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('No se pudo conectar con el servidor de login');
  }
};

export const logout = async (): Promise<void> => {
  await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  localStorage.removeItem(SESSION_TOKEN_KEY);
};

export interface Property {
  id: number;
  name: string;
  location: string;
  status: string;
  monthlyRate: number;
  department?: string;
  availabilityStatus?: string;
  nightlyRate?: number;
  capacity?: number;
  occupancy?: number;
  image?: string;
  images?: string[] | string;
  createdAt?: string;
}

export interface Tenant {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  property_id?: number;
  status: string;
  since: string;
  avatar?: string;
  source?: string;
  tags?: string;
  notes?: string;
  staysCount?: number;
  firstStay?: string;
  lastStay?: string;
  totalPaid?: number;
  stays?: Booking[];
  transactions?: Transaction[];
  createdAt?: string;
  property?: string;
}

export interface Transaction {
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
  createdAt?: string;
  property?: string;
}

export interface FinanceCycle {
  id: number;
  closedAt: string;
  periodLabel: string;
  income: number;
  expense: number;
  balance: number;
  ownerSettlements: Array<{
    owner: string;
    expensesPaid: number;
    profitShare: number;
    payout: number;
  }>;
  paymentTotals: Array<{
    method: string;
    amount: number;
  }>;
  expenseRows: Array<{
    concept: string;
    amount: number;
    paidBy?: string;
  }>;
  transactionCount: number;
  withdrawalTransactionId?: number;
  createdAt?: string;
}

export interface Booking {
  id: number;
  tenant: string;
  property_id?: number;
  guests: number;
  checkIn: string;
  checkOut: string;
  status: string;
  amountTotal?: number;
  amountPaid?: number;
  refundIssued?: boolean | number;
  refundAmount?: number;
  receivedBy?: string;
  bookingSource?: string;
  paymentMethod?: string;
  receiptData?: string;
  receiptName?: string;
  receiptFiles?: string | ReceiptFile[];
  createdAt?: string;
  property?: string;
}

export interface ReceiptFile {
  name: string;
  data: string;
}

export interface EventItem {
  id: number;
  title: string;
  description?: string;
  property_id?: number;
  date: string;
  type?: string;
  createdAt?: string;
  property?: string;
}

// Properties
export const getProperties = async (): Promise<Property[]> => {
  const res = await apiFetch(`${API_BASE}/properties`);
  if (!res.ok) throw new Error('Failed to fetch properties');
  return res.json();
};

export const getProperty = async (id: number): Promise<Property> => {
  const res = await apiFetch(`${API_BASE}/properties/${id}`);
  if (!res.ok) throw new Error('Failed to fetch property');
  return res.json();
};

export const createProperty = async (property: Omit<Property, 'id' | 'createdAt'>): Promise<Property> => {
  const res = await apiFetch(`${API_BASE}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(property),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to create property'));
  return res.json();
};

export const updateProperty = async (id: number, property: Partial<Property>): Promise<Property> => {
  const res = await apiFetch(`${API_BASE}/properties/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(property),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to update property'));
  return res.json();
};

export const deleteProperty = async (id: number): Promise<void> => {
  const res = await apiFetch(`${API_BASE}/properties/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to delete property'));
};

// Tenants
export const getTenants = async (): Promise<Tenant[]> => {
  const res = await apiFetch(`${API_BASE}/tenants`);
  if (!res.ok) throw new Error('Failed to fetch tenants');
  return res.json();
};

export const getTenant = async (id: number): Promise<Tenant> => {
  const res = await apiFetch(`${API_BASE}/tenants/${id}`);
  if (!res.ok) throw new Error('Failed to fetch tenant');
  return res.json();
};

export const createTenant = async (tenant: Omit<Tenant, 'id' | 'createdAt'>): Promise<Tenant> => {
  const res = await apiFetch(`${API_BASE}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tenant),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to create tenant'));
  return res.json();
};

export const updateTenant = async (id: number, tenant: Partial<Tenant>): Promise<Tenant> => {
  const res = await apiFetch(`${API_BASE}/tenants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tenant),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to update tenant'));
  return res.json();
};

export const deleteTenant = async (id: number): Promise<void> => {
  const res = await apiFetch(`${API_BASE}/tenants/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to delete tenant'));
};

// Transactions
export const getTransactions = async (): Promise<Transaction[]> => {
  const res = await apiFetch(`${API_BASE}/transactions`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
};

export const createTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> => {
  const res = await apiFetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to create transaction'));
  return res.json();
};

export const getFinanceCycles = async (): Promise<FinanceCycle[]> => {
  const res = await apiFetch(`${API_BASE}/finance/cycles`);
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to fetch finance cycles'));
  return res.json();
};

export const closeFinanceCycle = async (): Promise<{ cycle: FinanceCycle; transaction: Transaction }> => {
  const res = await apiFetch(`${API_BASE}/finance/close-cycle`, { method: 'POST' });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to close finance cycle'));
  return res.json();
};

export const deleteBooking = async (id: number): Promise<void> => {
  const res = await apiFetch(`${API_BASE}/bookings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to delete booking'));
};

// Bookings
export const getBookings = async (): Promise<Booking[]> => {
  const res = await apiFetch(`${API_BASE}/bookings`);
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
};

export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> => {
  const res = await apiFetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (!res.ok) {
    throw new Error(await getApiError(res, 'Failed to create booking'));
  }
  return res.json();
};

export const updateBooking = async (id: number, booking: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> => {
  const res = await apiFetch(`${API_BASE}/bookings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (!res.ok) {
    throw new Error(await getApiError(res, 'Failed to update booking'));
  }
  return res.json();
};

// Events
export const getEvents = async (): Promise<EventItem[]> => {
  const res = await apiFetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
};

export const createEvent = async (event: Omit<EventItem, 'id' | 'createdAt'>): Promise<EventItem> => {
  const res = await apiFetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to create event'));
  return res.json();
};

export const updateEvent = async (id: number, event: Partial<EventItem>): Promise<EventItem> => {
  const res = await apiFetch(`${API_BASE}/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to update event'));
  return res.json();
};

export const deleteEvent = async (id: number): Promise<void> => {
  const res = await apiFetch(`${API_BASE}/events/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to delete event'));
};

// Settings
export const getMonthlyGoal = async (): Promise<number> => {
  const res = await apiFetch(`${API_BASE}/settings/monthly-goal`);
  if (!res.ok) throw new Error('Failed to fetch monthly goal');
  const data = await res.json();
  return data.monthlyGoal;
};

export const updateMonthlyGoal = async (monthlyGoal: number): Promise<number> => {
  const res = await apiFetch(`${API_BASE}/settings/monthly-goal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monthlyGoal }),
  });
  if (!res.ok) throw new Error(await getApiError(res, 'Failed to update monthly goal'));
  const data = await res.json();
  return data.monthlyGoal;
};
