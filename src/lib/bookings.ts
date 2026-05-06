import { Booking } from '../services/api';

export type BookingTimelineStatus = 'Proxima' | 'En curso' | 'Finalizada' | 'Cancelado' | 'Pendiente';

const todayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getBookingTimelineStatus = (booking: Booking, today = todayKey()): BookingTimelineStatus => {
  if (booking.status === 'Cancelado') return 'Cancelado';
  if (booking.checkOut <= today) return 'Finalizada';
  if (booking.checkIn <= today && booking.checkOut >= today) return 'En curso';
  if (booking.status === 'Pendiente') return 'Pendiente';
  return 'Proxima';
};

export const isUpcomingBooking = (booking: Booking, today = todayKey()) => {
  const timelineStatus = getBookingTimelineStatus(booking, today);
  return timelineStatus === 'Proxima' || timelineStatus === 'En curso' || timelineStatus === 'Pendiente';
};

export const sortBookingsByCheckIn = (bookings: Booking[]) => {
  return [...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
};
