import React from 'react';
import { 
  Plus, 
  Filter, 
  MapPin, 
  ChevronRight, 
  Building2,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Properties() {
  const properties = [
    {
      id: 1,
      name: 'Residencias Alvear 402',
      location: 'Recoleta, Buenos Aires',
      status: 'Ocupado',
      lastPayment: '12 May 2024',
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=600',
      statusColor: 'bg-secondary-container text-on-secondary-container',
      indicatorColor: 'bg-secondary'
    },
    {
      id: 2,
      name: 'Loft San Telmo Tower',
      location: 'San Telmo, Buenos Aires',
      status: 'Disponible',
      yield: '6.5% Anual',
      image: 'https://images.unsplash.com/photo-1536376074432-cd24f92613ce?auto=format&fit=crop&q=80&w=600',
      statusColor: 'bg-tertiary-container/10 text-on-tertiary-container',
      indicatorColor: 'bg-tertiary'
    },
    {
      id: 3,
      name: 'Penthouse Madero Norte',
      location: 'Puerto Madero, CABA',
      status: 'Mantenimiento',
      completion: '22 May 2024',
      image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&q=80&w=600',
      statusColor: 'bg-surface-container-high text-on-surface-variant',
      indicatorColor: 'bg-outline-variant'
    },
    {
      id: 4,
      name: 'Residencia Belgrano R',
      location: 'Belgrano, Buenos Aires',
      status: 'Ocupado',
      lastPayment: '05 May 2024',
      image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d9568e?auto=format&fit=crop&q=80&w=600',
      statusColor: 'bg-secondary-container text-on-secondary-container',
      indicatorColor: 'bg-secondary'
    },
  ];

  const financialSummary = [
    { unit: 'Alvear 402', status: 'VIGENTE', statusColor: 'bg-secondary-container text-on-secondary-container', contract: 'Vence: 12/2025', monthly: '$1,200.00' },
    { unit: 'San Telmo Tower', status: 'VACANTE', statusColor: 'bg-tertiary-container/10 text-on-tertiary-container', contract: '-', monthly: '$950.00' },
    { unit: 'Madero Norte', status: 'BLOQUEADO', statusColor: 'bg-surface-container-high text-on-surface-variant', contract: 'Refacción', monthly: '-' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8 pb-32">
      {/* Header Area */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary">Gestión de Propiedades</h1>
          <p className="text-on-surface-variant mt-1">Supervise y administre su cartera inmobiliaria con precisión.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-primary text-primary px-5 py-2 rounded-lg font-display font-semibold transition-colors hover:bg-surface-container flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4" />
            FILTRAR
          </button>
          <button className="bg-primary text-white px-5 py-2 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2 text-sm shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            NUEVA PROPIEDAD
          </button>
        </div>
      </section>

      {/* Property Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {properties.map((prop) => (
          <div key={prop.id} className="group bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer">
            <div className="relative h-48 overflow-hidden">
              <img 
                src={prop.image} 
                alt={prop.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4">
                <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase", prop.statusColor)}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", prop.indicatorColor)} />
                  {prop.status}
                </span>
              </div>
            </div>
            
            <div className="p-5 flex flex-col h-[calc(100%-12rem)]">
              <div className="mb-4">
                <h3 className="font-display font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">{prop.name}</h3>
                <div className="flex items-center gap-1 text-on-surface-variant mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-xs">{prop.location}</span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-surface-container flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-outline uppercase tracking-widest leading-none">
                    {prop.status === 'Disponible' ? 'Rentabilidad Est.' : prop.status === 'Mantenimiento' ? 'Finalización' : 'Último Pago'}
                  </span>
                  <span className={cn("text-xs font-bold mt-1", prop.status === 'Disponible' ? 'text-secondary' : 'text-on-surface')}>
                    {prop.yield || prop.completion || prop.lastPayment}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary transition-all group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Financial Summary Table */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-primary mb-6">Resumen Financiero por Unidad</h2>
        <div className="bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-outline border-b border-surface-container">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">UNIDAD</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">ESTADO</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">CONTRATO</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right">MENSUALIDAD</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {financialSummary.map((row, idx) => (
                  <tr key={idx} className="hover:bg-active transition-colors">
                    <td className="px-6 py-4 font-bold text-sm">{row.unit}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase", row.statusColor)}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">{row.contract}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-primary">{row.monthly}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-primary text-[10px] font-bold uppercase hover:underline">Ver Detalles</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 group">
        <Building2 className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-12 right-0 bg-primary text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Nueva Propiedad
        </div>
      </button>
    </div>
  );
}
