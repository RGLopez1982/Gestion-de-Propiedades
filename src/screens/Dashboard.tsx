import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus,
  Pencil
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getTransactions, getBookings, getProperties, Transaction, Booking, Property } from '../services/api';
import { useModal } from '../hooks/useModal';
import { Modal } from '../components/Modal';
import { BookingForm } from '../components/forms/BookingForm';
import { getBookingTimelineStatus, isUpcomingBooking, sortBookingsByCheckIn } from '../lib/bookings';
import { formatDateDisplay } from '../lib/dates';
import { formatMoney } from '../lib/money';

const getOverlappingNights = (booking: Booking, monthStart: Date, monthEnd: Date) => {
  if (booking.status === 'Cancelado') return 0;

  const start = new Date(Math.max(new Date(`${booking.checkIn}T00:00:00`).getTime(), monthStart.getTime()));
  const end = new Date(Math.min(new Date(`${booking.checkOut}T00:00:00`).getTime(), monthEnd.getTime()));
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0);
};

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const modal = useModal();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [txn, bk, prop] = await Promise.all([
          getTransactions(),
          getBookings(),
          getProperties()
        ]);
        setTransactions(txn);
        setBookings(bk);
        setProperties(prop);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate stats
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const balance = totalIncome - totalExpense;

  const handleBookingCreated = async (booking: Booking) => {
    try {
      const [updatedBookings, updatedTransactions] = await Promise.all([
        getBookings(),
        getTransactions(),
      ]);
      setBookings(updatedBookings);
      setTransactions(updatedTransactions);
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      setBookings(prev => {
        const exists = prev.some((item) => item.id === booking.id);
        return exists
          ? prev.map((item) => item.id === booking.id ? booking : item)
          : [booking, ...prev];
      });
    }
    setSelectedBooking(null);
    modal.close();
  };

  const handleBookingDeleted = async () => {
    try {
      const [updatedBookings, updatedTransactions] = await Promise.all([
        getBookings(),
        getTransactions(),
      ]);
      setBookings(updatedBookings);
      setTransactions(updatedTransactions);
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    }
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

  const stats = [
    { label: 'BALANCE NETO', value: `$${balance.toFixed(2)}`, change: '+12% vs mes pasado', icon: Wallet, color: 'text-primary' },
    { label: 'INGRESOS TOTALES', value: `$${totalIncome.toFixed(2)}`, change: '+8% vs mes pasado', icon: ArrowUpRight, color: 'text-secondary' },
    { label: 'GASTOS', value: `$${Math.abs(totalExpense).toFixed(2)}`, change: '-2% vs mes pasado', icon: ArrowDownRight, color: 'text-error' },
  ];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const totalAvailableNights = properties.length * daysInMonth;
  const occupiedNights = bookings.reduce((sum, booking) => sum + getOverlappingNights(booking, monthStart, monthEnd), 0);
  const monthlyOccupancyRate = totalAvailableNights > 0
    ? Math.round((occupiedNights / totalAvailableNights) * 100)
    : 0;

  const occupancyByDepartment = properties.map((property) => {
    const propertyBookings = bookings.filter((booking) => booking.property_id === property.id);
    const nights = propertyBookings.reduce((sum, booking) => sum + getOverlappingNights(booking, monthStart, monthEnd), 0);
    return {
      id: property.id,
      name: property.department || property.location || property.name,
      nights,
      percentage: daysInMonth > 0 ? Math.round((nights / daysInMonth) * 100) : 0,
    };
  });

  const upcomingBookings = sortBookingsByCheckIn(bookings.filter(isUpcomingBooking));

  const activities = [
    ...transactions.slice(0, 3).map((transaction) => ({
      type: transaction.type === 'income' ? 'Pago recibido' : 'Gasto registrado',
      details: `${transaction.concept} - ${transaction.property || 'Sin propiedad'}`,
      color: transaction.type === 'income' ? 'bg-secondary' : 'bg-error',
    })),
    ...upcomingBookings.slice(0, 2).map((booking) => ({
      type: getBookingTimelineStatus(booking) === 'En curso' ? 'Reserva en curso' : 'Reserva registrada',
      details: `${booking.tenant} - ${booking.property || 'Sin propiedad'}`,
      color: 'bg-blue-400',
    })),
  ].slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface">Resumen General</h1>
          <p className="text-on-surface-variant mt-1">Bienvenido de nuevo, aquí tienes el estado de tus propiedades.</p>
        </div>
        <button
          onClick={openNewBooking}
          className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nueva Reserva
        </button>
      </section>

      <Modal isOpen={modal.isOpen} onClose={() => { setSelectedBooking(null); modal.close(); }} title={selectedBooking ? "Editar reserva" : "Crear reserva"} size="md">
        <BookingForm booking={selectedBooking} onSuccess={handleBookingCreated} onDelete={handleBookingDeleted} onCancel={() => { setSelectedBooking(null); modal.close(); }} />
      </Modal>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-outline-variant/30 rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest leading-none">{stat.label}</span>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <div className="mt-4">
              <h3 className={cn("font-display text-2xl font-bold", stat.color)}>{stat.value}</h3>
              <p className={cn("text-xs font-semibold flex items-center gap-1 mt-1", stat.label === 'GASTOS' ? 'text-error' : 'text-secondary')}>
                {stat.label !== 'GASTOS' && <TrendingUp className="w-3.5 h-3.5" />}
                {stat.change}
              </p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Occupancy Chart */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm lg:h-[280px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Ocupacion del Mes</h3>
                <p className="text-xs text-on-surface-variant capitalize mt-1">{monthLabel}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-bold text-primary">{monthlyOccupancyRate}%</p>
                <p className="text-xs text-on-surface-variant">{occupiedNights} de {totalAvailableNights} noches</p>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {properties.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No hay departamentos cargados.</p>
              ) : (
                occupancyByDepartment.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="text-on-surface truncate">{item.name}</span>
                      <span className="text-primary shrink-0">{item.nights} noches - {item.percentage}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-surface-container overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
              {properties.length > 0 && occupiedNights === 0 && (
                <p className="text-xs text-on-surface-variant">Todavia no hay noches reservadas este mes.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Area */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Recent Activity */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm lg:h-[280px] flex flex-col overflow-hidden">
            <h3 className="font-display font-semibold text-primary mb-6 shrink-0">Actividad Reciente</h3>
            <div className="flex-1 min-h-0 overflow-y-auto pr-2">
            <div className="flex flex-col gap-6 relative">
              <div className="absolute left-1 top-2 bottom-2 w-px bg-surface-container" />
              {activities.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Todavia no hay actividad registrada.</p>
              ) : (
                activities.map((activity, idx) => (
                  <div key={idx} className="flex gap-4 relative z-10">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 ring-4 ring-white shrink-0", activity.color)} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{activity.type}</p>
                      <p className="text-xs text-on-surface-variant font-medium mt-1 break-words">{activity.details}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="lg:col-span-12 bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-surface-container flex justify-between items-center">
            <h3 className="font-display font-semibold text-primary">Próximas Reservas</h3>
            <button className="text-primary text-sm font-bold border-b border-transparent hover:border-primary transition-all">Ver todas</button>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-on-surface-variant">No hay reservas proximas o en curso</p>
            </div>
          ) : (
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[18%]" />
                <col className="w-[25%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container">
                  <th className="px-6 py-3 text-[11px] font-bold uppercase">Inquilino</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase">Departamento</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase">Fechas</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase text-right">Pago</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase text-center">Estado</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase text-right">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {upcomingBookings.slice(0, 6).map((booking, idx) => {
                  const timelineStatus = getBookingTimelineStatus(booking);
                  return (
                  <tr key={idx} className="hover:bg-active transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-gradient-to-br from-primary to-secondary text-white shrink-0")}>
                          {booking.tenant.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{booking.tenant}</p>
                          <p className="text-[10px] text-on-surface-variant">{booking.guests} huéspedes</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-on-surface truncate">{booking.property || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="whitespace-nowrap text-sm font-mono text-on-surface">{formatDateDisplay(booking.checkIn)} a {formatDateDisplay(booking.checkOut)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-xs font-mono text-on-surface">{formatMoney(Number(booking.amountPaid || 0))}</p>
                      <p className="text-[10px] text-on-surface-variant">de {formatMoney(Number(booking.amountTotal || 0))}</p>
                      {booking.paymentMethod && (
                        <p className="text-[10px] text-on-surface-variant truncate">{booking.paymentMethod}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={cn(
                          "inline-flex min-h-8 min-w-[76px] items-center justify-center rounded-full px-3 text-center text-[9px] font-bold uppercase leading-none tracking-tight",
                          timelineStatus === 'Proxima' && "bg-secondary-container text-on-secondary-container",
                          timelineStatus === 'En curso' && "bg-primary text-white",
                          timelineStatus === 'Pendiente' && "bg-tertiary-container/10 text-on-tertiary-container",
                          timelineStatus === 'Cancelado' && "bg-error-container text-on-error-container"
                        )}>
                          {timelineStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditBooking(booking)}
                        className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 p-2 text-primary hover:bg-surface-container transition-colors"
                        aria-label="Editar reserva"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
