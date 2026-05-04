import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  User,
  Calendar as CalendarIcon,
  Building,
  Pencil
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Booking, getBookings } from '../services/api';
import { useModal } from '../hooks/useModal';
import { Modal } from '../components/Modal';
import { BookingForm } from '../components/forms/BookingForm';

const weekdays = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

const toDateKey = (date: Date) => date.toISOString().split('T')[0];

const formatDate = (value?: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
};

export default function Calendar() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const modal = useModal();

  const loadBookings = async () => {
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const key = toDateKey(new Date(year, month, day));
      const dayBookings = bookings.filter((item) => item.status !== 'Cancelado' && key >= item.checkIn && key < item.checkOut);
      return { day, key, bookings: dayBookings };
    });
  }, [bookings, daysInMonth, month, year]);

  const nextBookings = bookings.slice(0, 5);

  const handleBookingCreated = (booking: Booking) => {
    loadBookings();
    setSelectedBooking(null);
    modal.close();
  };

  const openNewBooking = () => {
    setSelectedBooking(null);
    modal.open();
  };

  const openEditBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    modal.open();
  };

  const moveMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary">Calendario de Disponibilidad</h1>
          <p className="text-on-surface-variant mt-1">Administre reservas reales guardadas en la base de datos.</p>
        </div>
        <button
          onClick={openNewBooking}
          className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <PlusCircle className="w-5 h-5 fill-white/20" />
          Anadir Reserva
        </button>
      </section>

      <Modal isOpen={modal.isOpen} onClose={() => { setSelectedBooking(null); modal.close(); }} title={selectedBooking ? "Editar reserva" : "Crear reserva"} size="md">
        <BookingForm booking={selectedBooking} onSuccess={handleBookingCreated} onCancel={() => { setSelectedBooking(null); modal.close(); }} />
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white border border-outline-variant/30 rounded-xl p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="font-display text-xl font-bold capitalize">{monthLabel}</h2>
              <div className="flex gap-1">
                <button onClick={() => moveMonth(-1)} className="p-1.5 hover:bg-surface-container rounded-lg transition-colors border border-outline-variant/20">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => moveMonth(1)} className="p-1.5 hover:bg-surface-container rounded-lg transition-colors border border-outline-variant/20">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-sm" />
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Reservado</span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-80">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-outline-variant/20 rounded-xl overflow-hidden border border-outline-variant/20">
              {weekdays.map((day) => (
                <div key={day} className="bg-surface-container-low py-3 text-center text-[10px] font-bold text-on-surface-variant tracking-widest">{day}</div>
              ))}

              {Array.from({ length: firstWeekday }).map((_, index) => (
                <div key={`empty-${index}`} className="min-h-[80px] bg-surface-container-low" />
              ))}

              {calendarDays.map(({ day, bookings: dayBookings }) => (
                <div
                  key={day}
                  className={cn(
                    "min-h-[96px] p-2 relative transition-all group",
                    dayBookings.length > 0 ? "bg-primary/5" : "bg-white hover:bg-surface-container-low"
                  )}
                >
                  <span className="text-sm font-bold text-on-surface">{day}</span>
                  <div className="mt-2 flex flex-col gap-1">
                    {dayBookings.slice(0, 3).map((booking) => (
                      <button
                        key={booking.id}
                        onClick={() => openEditBooking(booking)}
                        className="w-full rounded bg-primary px-2 py-1 text-left text-white transition-opacity hover:opacity-90"
                      >
                        <p className="text-[9px] font-bold uppercase truncate">{booking.tenant}</p>
                        <p className="text-[8px] opacity-80 truncate">{booking.property || 'Sin propiedad'}</p>
                      </button>
                    ))}
                    {dayBookings.length > 3 && (
                      <span className="text-[9px] font-bold text-primary">+{dayBookings.length - 3} mas</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm flex flex-col gap-6">
            <h3 className="font-display font-semibold text-primary">Proximas Reservas</h3>
            {nextBookings.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No hay reservas registradas.</p>
            ) : (
              <div className="space-y-4">
                {nextBookings.map((booking) => (
                  <div key={booking.id} className="p-3 rounded-xl border border-surface-container">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-surface-container rounded-lg shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{booking.tenant}</p>
                        <p className="text-[10px] text-on-surface-variant">{booking.guests} huespedes</p>
                      </div>
                      <button
                        onClick={() => openEditBooking(booking)}
                        className="rounded-lg border border-outline-variant/30 p-2 text-primary hover:bg-surface-container transition-colors"
                        aria-label="Editar reserva"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5" />
                        <span><strong className="text-on-surface">Departamento:</strong> {booking.property || 'Sin departamento'}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span><strong className="text-on-surface">Check-in:</strong> {formatDate(booking.checkIn)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span><strong className="text-on-surface">Check-out:</strong> {formatDate(booking.checkOut)}</span>
                      </span>
                      <span className="font-mono">${Number(booking.amountPaid || 0).toFixed(2)} pagado de ${Number(booking.amountTotal || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
