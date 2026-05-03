import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle, 
  User, 
  MapPin, 
  Calendar as CalendarIcon,
  Lightbulb,
  Building
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Calendar() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const weekdays = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  
  // Mock data for specific days
  const reservedDays = [3, 4, 5, 16, 17, 18];
  const blockedDays = [12, 13];
  const events = [
    { day: 1, type: 'checkin' },
    { day: 6, type: 'checkin' },
    { day: 10, type: 'selected' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary">Calendario de Disponibilidad</h1>
          <p className="text-on-surface-variant mt-1">Administre las reservas y el estado de la propiedad para octubre de 2023</p>
        </div>
        <button className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2 shadow-lg shadow-primary/20">
          <PlusCircle className="w-5 h-5 fill-white/20" />
          Añadir Reserva
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Card */}
        <div className="lg:col-span-8 bg-white border border-outline-variant/30 rounded-xl p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="font-display text-xl font-bold">Octubre 2023</h2>
              <div className="flex gap-1">
                <button className="p-1.5 hover:bg-surface-container rounded-lg transition-colors border border-outline-variant/20"><ChevronLeft className="w-4 h-4" /></button>
                <button className="p-1.5 hover:bg-surface-container rounded-lg transition-colors border border-outline-variant/20"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-sm" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">RESERVADO</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 diagonal-hash border border-outline-variant/30 rounded-sm" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">BLOQUEADO</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-outline-variant/20 rounded-xl overflow-hidden border border-outline-variant/20">
            {weekdays.map(d => (
              <div key={d} className="bg-surface-container-low py-3 text-center text-[10px] font-bold text-on-surface-variant tracking-widest">{d}</div>
            ))}
            
            {/* Padding for first week (assuming Oct 2023 starts on Sunday) */}
            {days.map(day => {
              const isReserved = reservedDays.includes(day);
              const isBlocked = blockedDays.includes(day);
              const event = events.find(e => e.day === day);
              
              return (
                <div 
                  key={day} 
                  className={cn(
                    "min-h-[80px] p-2 relative transition-all group",
                    isReserved ? "bg-primary text-white" : isBlocked ? "diagonal-hash opacity-40 bg-surface" : "bg-white hover:bg-surface-container-low cursor-pointer",
                    event?.type === 'selected' && "ring-2 ring-inset ring-primary z-10 shadow-lg"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold",
                    !isReserved && !isBlocked && "text-on-surface",
                    event?.type === 'selected' && "text-primary"
                  )}>
                    {day}
                  </span>
                  
                  {day === 3 && <div className="absolute bottom-2 left-2 text-[8px] font-bold uppercase">Ingresó</div>}
                  {day === 5 && <div className="absolute bottom-2 left-2 text-[8px] font-bold uppercase">Salida</div>}
                  {event?.type === 'checkin' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-secondary rounded-full" />}
                  {event?.type === 'selected' && <div className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-primary rounded-full" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Booking Details */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-primary">Detalles de la Reserva</h3>
              <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[10px] font-bold uppercase">Confirmado</span>
            </div>
            
            <div className="space-y-6">
              {[
                { icon: User, label: 'Inquilino', value: 'Alejandro Martínez' },
                { icon: Building, label: 'Propiedad', value: 'Skyline Tower - Suite 402' },
                { icon: CalendarIcon, label: 'Estancia', value: 'Oct 10, 2023 - Oct 15, 2023' },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="p-2 bg-surface-container rounded-lg shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">{item.label}</label>
                    <p className="text-sm font-bold text-on-surface mt-0.5">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-6 border-t border-surface-container">
              <button className="flex-1 py-2.5 border border-primary text-primary text-sm font-bold rounded-lg transition-colors hover:bg-surface-container">Editar</button>
              <button className="flex-1 py-2.5 border border-error text-error text-sm font-bold rounded-lg transition-colors hover:bg-error-container">Cancelar</button>
            </div>
          </div>

          {/* Smart Pricing */}
          <div className="bg-secondary-container/20 border border-secondary/20 rounded-xl p-6">
            <div className="flex items-center gap-2 text-on-secondary-container mb-3">
              <Lightbulb className="w-4 h-4 fill-secondary-container" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider">Sugerencia de Precio Inteligente</h4>
            </div>
            <p className="text-sm text-on-secondary-container/90">La demanda es un 20% más alta para el fin de semana del 20 al 22 de octubre. Recomendamos ajustar su tarifa base.</p>
            <button className="mt-4 text-sm font-bold text-on-secondary-container underline underline-offset-4">Aplicar sugerencias</button>
          </div>

          {/* Upcoming Ingress */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-semibold text-primary mb-4">Próximos Ingresos</h3>
            <div className="space-y-4">
              {[
                { name: 'Elena Rossi', property: 'Villa Marítima' },
                { name: 'Mark Thompson', property: 'Loft Industrial' }
              ].map((user, idx) => (
                <div key={idx} className={cn("flex items-center justify-between p-3 rounded-xl border border-surface-container transition-colors hover:bg-surface-container cursor-pointer")}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
                      <User className="w-4 h-4 text-on-surface-variant" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{user.name}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">{user.property}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-outline" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
