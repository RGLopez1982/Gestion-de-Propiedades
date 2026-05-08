import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Building2, 
  Wallet, 
  Users, 
  Bell,
  LogOut,
  TicketPercent,
  X,
  MessageCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getBookings, getEvents, getTenants, Booking, EventItem, Tenant } from '../../services/api';
import { getBookingTimelineStatus, isUpcomingBooking, sortBookingsByCheckIn } from '../../lib/bookings';
import { formatDateDisplay } from '../../lib/dates';

interface NavbarProps {
  onLogout: () => void;
}

export function Navbar({ onLogout }: NavbarProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Calendario', icon: CalendarDays, path: '/calendar' },
    { name: 'Propiedades', icon: Building2, path: '/properties' },
    { name: 'Finanzas', icon: Wallet, path: '/finance' },
    { name: 'Inquilinos', icon: Users, path: '/tenants' },
    { name: 'Eventos', icon: TicketPercent, path: '/events' },
  ];

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const [bookingData, eventData, tenantData] = await Promise.all([getBookings(), getEvents(), getTenants()]);
        setBookings(bookingData);
        setEvents(eventData);
        setTenants(tenantData);
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedTenantNames = tenants.map((tenant) => ({
      ...tenant,
      normalizedName: tenant.name.trim().toUpperCase(),
    }));
    const findTenantPhone = (booking: Booking) => normalizedTenantNames.find((tenant) => tenant.normalizedName === booking.tenant.trim().toUpperCase())?.phone;
    const getDaysUntilCheckIn = (booking: Booking) => {
      const checkIn = new Date(`${booking.checkIn}T00:00:00`);
      return Math.round((checkIn.getTime() - today.getTime()) / 86400000);
    };
    const buildReminderText = (booking: Booking) => [
      `Hola ${booking.tenant}, te recordamos tu reserva en ${booking.property || 'el departamento'}.`,
      `Check-in: ${formatDateDisplay(booking.checkIn)}.`,
      `Check-out: ${formatDateDisplay(booking.checkOut)}.`,
      `Huespedes: ${booking.guests}.`,
      `Total: $${Number(booking.amountTotal || 0).toFixed(2)}.`,
      `Pagado: $${Number(booking.amountPaid || 0).toFixed(2)}.`,
    ].join('\n');
    const buildWhatsAppUrl = (booking: Booking) => {
      const phone = findTenantPhone(booking)?.replace(/\D/g, '');
      if (!phone) return undefined;
      return `https://wa.me/${phone}?text=${encodeURIComponent(buildReminderText(booking))}`;
    };

    const reminderNotifications = sortBookingsByCheckIn(bookings)
      .filter((booking) => {
        const status = getBookingTimelineStatus(booking);
        const daysUntil = getDaysUntilCheckIn(booking);
        return status !== 'Cancelado' && status !== 'Finalizada' && daysUntil >= 0 && daysUntil <= 3;
      })
      .slice(0, 4)
      .map((booking) => {
        const daysUntil = getDaysUntilCheckIn(booking);
        const title = daysUntil === 0
          ? 'Enviar aviso de ingreso hoy'
          : daysUntil === 1
            ? 'Enviar aviso de ingreso manana'
            : `Enviar aviso en ${daysUntil} dias`;

        return {
          id: `reminder-${booking.id}`,
          title,
          detail: `${booking.tenant} - ${booking.property || 'Sin departamento'}`,
          meta: `Check-in ${formatDateDisplay(booking.checkIn)} · ${booking.guests} huespedes`,
          path: '/calendar',
          color: 'bg-amber-400',
          actionUrl: buildWhatsAppUrl(booking),
          actionLabel: 'WhatsApp',
        };
      });

    const bookingNotifications = sortBookingsByCheckIn(bookings.filter(isUpcomingBooking)).slice(0, 4).map((booking) => ({
      id: `booking-${booking.id}`,
      title: getBookingTimelineStatus(booking),
      detail: `${booking.tenant} - ${booking.property || 'Sin departamento'}`,
      meta: `${formatDateDisplay(booking.checkIn)} a ${formatDateDisplay(booking.checkOut)}`,
      path: '/calendar',
      color: getBookingTimelineStatus(booking) === 'En curso' ? 'bg-primary' : 'bg-secondary',
    }));

    const eventNotifications = events.slice(0, 3).map((event) => ({
      id: `event-${event.id}`,
      title: event.type || 'Evento',
      detail: event.title,
      meta: formatDateDisplay(event.date),
      path: '/events',
      color: 'bg-blue-400',
    }));

    return [...reminderNotifications, ...bookingNotifications, ...eventNotifications].slice(0, 8);
  }, [bookings, events, tenants]);

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b border-outline-variant/30 flex justify-between items-center w-full px-6 h-16 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant">
            <img 
              alt="Manager profile" 
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=100&h=100" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-display text-lg font-bold text-primary">Gestión de Propiedades</span>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "text-primary bg-surface-container" 
                    : "text-on-surface-variant hover:bg-surface-container-low"
                )}
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
          
          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((value) => !value)}
              className="relative p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              aria-label="Ver notificaciones"
              aria-expanded={isNotificationsOpen}
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute right-1 top-1 flex h-2.5 w-2.5 rounded-full bg-error ring-2 ring-white" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 top-12 w-[min(340px,calc(100vw-2rem))] rounded-xl border border-outline-variant/30 bg-white shadow-xl shadow-black/10 z-[60] overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-surface-container px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-primary">Notificaciones</h3>
                    <p className="text-[11px] text-on-surface-variant">Reservas y eventos próximos</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
                    aria-label="Cerrar notificaciones"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-on-surface-variant">No hay avisos pendientes.</p>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg px-3 py-3 hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex gap-3 text-left">
                          <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', item.color)} />
                          <div className="min-w-0 flex-1">
                            <Link
                              to={item.path}
                              onClick={() => setIsNotificationsOpen(false)}
                              className="block min-w-0"
                            >
                              <span className="block text-xs font-bold text-on-surface">{item.title}</span>
                              <span className="block truncate text-sm font-semibold text-on-surface">{item.detail}</span>
                              <span className="block text-[11px] text-on-surface-variant">{item.meta}</span>
                            </Link>
                            {item.actionUrl && (
                              <a
                                href={item.actionUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setIsNotificationsOpen(false)}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-secondary/90"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                {item.actionLabel}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
            aria-label="Cerrar sesion"
            title="Cerrar sesion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center bg-white border-t border-outline-variant/30 h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
              isActive 
                ? "text-primary border-t-2 border-primary pt-0" 
                : "text-on-surface-variant pt-0.5"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
