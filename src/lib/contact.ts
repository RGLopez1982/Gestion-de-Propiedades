import { Booking, Tenant } from '../services/api';
import { formatDateDisplay } from './dates';

const normalizePhone = (phone?: string | null) => {
  return (phone || '').replace(/\D/g, '');
};

export const getPhoneHref = (phone?: string | null) => {
  const normalizedPhone = normalizePhone(phone);
  return normalizedPhone ? `tel:${normalizedPhone}` : '';
};

export const getMostRelevantBooking = (bookings: Booking[] = []) => {
  const today = new Date().toISOString().split('T')[0];
  const activeOrFuture = bookings
    .filter((booking) => booking.status !== 'Cancelado' && booking.checkOut >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  return activeOrFuture[0] || bookings[0];
};

export const buildReservationWhatsappMessage = (tenant: Tenant, booking?: Booking) => {
  const lines = [
    `Hola ${tenant.name}. Te contacto por tu reserva.`,
    '',
    'Datos de la reserva:',
  ];

  if (booking) {
    lines.push(
      `Departamento: ${booking.property || tenant.property || '-'}`,
      `Check-in: ${formatDateDisplay(booking.checkIn)}`,
      `Check-out: ${formatDateDisplay(booking.checkOut)}`,
      `Huespedes: ${booking.guests || '-'}`,
      `Estado: ${booking.status || '-'}`,
      `Pago: $${Number(booking.amountPaid || 0).toFixed(2)} de $${Number(booking.amountTotal || 0).toFixed(2)}`
    );

    if (booking.paymentMethod) lines.push(`Medio de pago: ${booking.paymentMethod}`);
    if (booking.bookingSource) lines.push(`Canal: ${booking.bookingSource}`);
    if (booking.receivedBy) lines.push(`Reserva recibida por: ${booking.receivedBy}`);
  } else {
    lines.push(
      `Departamento: ${tenant.property || '-'}`,
      `Ultima salida: ${formatDateDisplay(tenant.lastStay)}`,
      `Estadias registradas: ${tenant.staysCount || 0}`,
      `Pagado historico: $${Number(tenant.totalPaid || 0).toFixed(2)}`
    );
  }

  lines.push('', 'Cualquier consulta quedo atento.');

  return lines.join('\n');
};

export const openWhatsappWeb = (phone: string | undefined | null, message: string) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;

  const url = `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};
