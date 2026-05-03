import React from 'react';
import { 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Rocket, 
  Circle,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const stats = [
    { label: 'BALANCE NETO', value: '$12,450.00', change: '+12% vs mes pasado', icon: Wallet, color: 'text-primary' },
    { label: 'INGRESOS TOTALES', value: '$15,200', change: '+8% vs mes pasado', icon: ArrowUpRight, color: 'text-secondary' },
    { label: 'GASTOS', value: '$2,750', change: '-2% vs mes pasado', icon: ArrowDownRight, color: 'text-error' },
  ];

  const occupancy = [
    { day: 'Lun', value: 40 },
    { day: 'Mar', value: 60 },
    { day: 'Mié', value: 45 },
    { day: 'Jue', value: 85 },
    { day: 'Vie', value: 55 },
    { day: 'Sáb', value: 70 },
    { day: 'Dom', value: 30 },
  ];

  const bookings = [
    { tenant: 'Marco Antonio', guests: 2, property: 'Loft Moderno Centro', dates: '12 Oct - 15 Oct', status: 'Confirmado', initial: 'MA', color: 'bg-blue-100 text-blue-700' },
    { tenant: 'Lucía García', guests: 1, property: 'Villa Vista Mar', dates: '18 Oct - 22 Oct', status: 'Pendiente', initial: 'LG', color: 'bg-amber-100 text-amber-700' },
    { tenant: 'Juan Pérez', guests: 4, property: 'Cabaña del Bosque', dates: '25 Oct - 30 Oct', status: 'Cancelado', initial: 'JP', color: 'bg-slate-100 text-slate-700' },
  ];

  const activities = [
    { type: 'Pago recibido', details: 'Villa Vista Mar • Hace 2h', color: 'bg-secondary' },
    { type: 'Gasto mantenimiento', details: 'Reparación tubería • Hace 5h', color: 'bg-error' },
    { type: 'Nueva consulta', details: 'Loft Moderno • Ayer', color: 'bg-blue-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface">Resumen General</h1>
          <p className="text-on-surface-variant mt-1">Bienvenido de nuevo, aquí tienes el estado de tus propiedades.</p>
        </div>
        <button className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nueva Reserva
        </button>
      </section>

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
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Ocupación Mensual</h3>
            </div>
            <div className="flex items-end justify-between h-40 gap-2 px-2">
              {occupancy.map((bar) => (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className={cn(
                      "w-full rounded-t-sm transition-all duration-500",
                      bar.value > 80 ? "bg-primary" : "bg-surface-container"
                    )}
                    style={{ height: `${bar.value}%` }}
                  />
                  <span className="text-[10px] font-bold text-outline uppercase">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bookings Table */}
          <div className="bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-surface-container flex justify-between items-center">
              <h3 className="font-display font-semibold text-primary">Próximas Reservas</h3>
              <button className="text-primary text-sm font-bold border-b border-transparent hover:border-primary transition-all">Ver todas</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container">
                    <th className="px-6 py-3 text-[11px] font-bold uppercase">Inquilino</th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase">Propiedad</th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase">Fechas</th>
                    <th className="px-6 py-3 text-[11px] font-bold uppercase text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/50">
                  {bookings.map((booking, idx) => (
                    <tr key={idx} className="hover:bg-active transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs", booking.color)}>
                            {booking.initial}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{booking.tenant}</p>
                            <p className="text-[10px] text-on-surface-variant">{booking.guests} huéspedes</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-on-surface">{booking.property}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono text-on-surface">{booking.dates}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-tight",
                            booking.status === 'Confirmado' && "bg-secondary-container text-on-secondary-container",
                            booking.status === 'Pendiente' && "bg-tertiary-container/10 text-on-tertiary-container",
                            booking.status === 'Cancelado' && "bg-error-container text-on-error-container"
                          )}>
                            {booking.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Area */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Monthly Goal */}
          <div className="bg-primary text-white rounded-xl p-6 relative overflow-hidden shadow-lg">
            <div className="relative z-10 flex flex-col gap-6">
              <div>
                <span className="text-[11px] font-bold opacity-70 uppercase tracking-widest">OBJETIVO MENSUAL</span>
                <h4 className="text-3xl font-bold mt-1">75% Completado</h4>
                <p className="text-sm opacity-90 mt-2">Te faltan $3,800 para alcanzar tu meta de ingresos de este mes.</p>
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div className="bg-secondary h-full transition-all duration-1000" style={{ width: '75%' }} />
              </div>
            </div>
            <Rocket className="absolute -bottom-8 -right-8 w-40 h-40 opacity-10 rotate-12" />
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-semibold text-primary mb-6">Actividad Reciente</h3>
            <div className="flex flex-col gap-6 relative">
              <div className="absolute left-1 top-2 bottom-2 w-px bg-surface-container" />
              {activities.map((activity, idx) => (
                <div key={idx} className="flex gap-4 relative z-10">
                  <div className={cn("w-2 h-2 rounded-full mt-1.5 ring-4 ring-white shrink-0", activity.color)} />
                  <div>
                    <p className="text-sm font-semibold">{activity.type}</p>
                    <p className="text-xs text-on-surface-variant font-medium mt-1">{activity.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
