import React from 'react';
import { 
  Plus,
  Pin, 
  TicketPercent, 
  Lightbulb, 
  Calendar, 
  TrendingUp,
  Settings2,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Events() {
  const annualEvents = [
    { name: 'Navidad', dates: 'Diciembre 24 - Enero 06', impact: '+25%', enabled: true },
    { name: 'Semana Santa', dates: 'Marzo / Abril (Variable)', impact: '+20%', enabled: true },
    { name: 'Festival Local (Feria)', dates: 'Agosto 12 - Agosto 19', impact: '+35%', enabled: false },
  ];

  const punctualEvents = [
    { name: 'Concierto de Taylor Swift', dates: 'Oct 20 - Oct 22, 2024', impact: '+18%', status: 'PENDIENTE', statusColor: 'bg-amber-100 text-amber-700' },
    { name: 'Congreso Médico Internacional', dates: 'Nov 15 - Nov 18, 2024', impact: '+12%', status: 'APLICADO', statusColor: 'bg-secondary-container/20 text-on-secondary-container' },
    { name: 'Final de Copa Local', dates: 'Ene 12, 2025', impact: '+22%', status: 'NUEVO', statusColor: 'bg-primary-container/10 text-primary' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            Agenda de Eventos
          </h1>
          <p className="text-on-surface-variant mt-1">Gestiona eventos locales y su impacto en tu estrategia de precios.</p>
        </div>
        <button className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2 shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5" />
          Nuevo Evento
        </button>
      </section>

      {/* Smart Tip */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-8 flex gap-6 items-start">
        <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 shrink-0">
          <Lightbulb className="w-6 h-6 fill-white/20" />
        </div>
        <div>
          <h3 className="font-display font-bold text-primary text-lg mb-2 flex items-center gap-2">
            Smart Tip: Optimización Dinámica
          </h3>
          <p className="text-on-surface-variant leading-relaxed text-sm md:text-base max-w-3xl">
            Nuestro sistema analiza estos eventos para sugerir ajustes automáticos. Los eventos de alta demanda permiten incrementos del <span className="font-bold text-primary">15-30%</span> sin sacrificar tu tasa de ocupación habitual.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Annual Events Table */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2 p-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-primary">Eventos Anuales</h3>
          </div>
          <div className="bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-outline text-[10px] font-bold uppercase tracking-widest border-b border-surface-container">
                  <th className="px-6 py-4">Evento</th>
                  <th className="px-6 py-4 text-center">Impacto</th>
                  <th className="px-6 py-4 text-right">Aviso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {annualEvents.map((e, idx) => (
                  <tr key={idx} className="zebra-stripe hover:bg-active transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-on-surface">{e.name}</p>
                      <p className="text-[10px] text-outline font-medium mt-0.5">{e.dates}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-secondary-container/20 text-on-secondary-container px-2 py-1 rounded font-bold text-xs">
                        {e.impact}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end pr-2">
                        <button className={cn(
                          "w-10 h-5 rounded-full relative transition-all duration-300",
                          e.enabled ? "bg-primary" : "bg-outline-variant/30"
                        )}>
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
                            e.enabled ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Punctual Events Cards */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2 p-2">
            <Pin className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-primary">Eventos Puntuales</h3>
          </div>
          <div className="flex flex-col gap-4">
            {punctualEvents.map((e, idx) => (
              <div key={idx} className="bg-white border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:border-primary/40 transition-all cursor-pointer group">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-display font-bold text-on-surface group-hover:text-primary transition-colors">{e.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1 text-outline">
                      <Calendar className="w-3 h-3" />
                      <span className="text-xs font-medium">{e.dates}</span>
                    </div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase", e.statusColor)}>
                    {e.status}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-surface-container flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-outline" />
                    <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Ajuste Sugerido</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <span className="text-sm font-bold">{e.impact}</span>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
