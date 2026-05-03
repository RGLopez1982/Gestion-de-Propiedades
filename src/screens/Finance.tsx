import React from 'react';
import { 
  TrendingUp, 
  Download, 
  Plus, 
  ChevronDown, 
  Building,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  CreditCard,
  Banknote
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Finance() {
  const summaries = [
    { label: 'Balance Acumulado', value: '$12,450.00', trend: '+12.5% este mes', icon: TrendingUp, color: 'text-primary' },
    { label: 'Ingresos del Mes', value: '$8,200.00', sub: '12 transacciones confirmadas', icon: ArrowUpRight, color: 'text-secondary' },
    { label: 'Gastos del Mes', value: '-$1,840.00', sub: '4 facturas de mantenimiento', icon: ArrowDownRight, color: 'text-error' },
  ];

  const transactions = [
    { date: '14 Sep 2023', concept: 'Alquiler Mensual - Juan Pérez', property: 'Apartamento Centro 4A', amount: '+$1,200.00', status: 'Completado', type: 'income' },
    { date: '12 Sep 2023', concept: 'Limpieza Profunda', property: 'Villa Marítima', amount: '-$150.00', status: 'Completado', type: 'expense' },
    { date: '10 Sep 2023', concept: 'Reparación Aire Acondicionado', property: 'Loft Industrial', amount: '-$450.00', status: 'Pendiente', type: 'expense' },
    { date: '08 Sep 2023', concept: 'Alquiler Vacacional - 5 noches', property: 'Villa Marítima', amount: '+$2,450.00', status: 'Completado', type: 'income' },
    { date: '05 Sep 2023', concept: 'Mantenimiento de Jardín', property: 'Villa Marítima', amount: '-$80.00', status: 'Completado', type: 'expense' },
    { date: '02 Sep 2023', concept: 'Alquiler Mensual - Elena Mora', property: 'Loft Industrial', amount: '+$950.00', status: 'Completado', type: 'income' },
  ];

  const distributions = [
    { label: 'Mantenimiento', percentage: 45, color: 'bg-primary' },
    { label: 'Impuestos / Tasas', percentage: 30, color: 'bg-surface-tint' },
    { label: 'Servicios (Luz/Agua)', percentage: 25, color: 'bg-on-primary-container' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Overview Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaries.map((stat, idx) => (
          <div key={idx} className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">{stat.label}</p>
            <h2 className={cn("font-display text-2xl md:text-3xl font-bold", stat.color)}>{stat.value}</h2>
            <div className="mt-2 flex items-center gap-1.5">
              {stat.trend ? (
                <div className="flex items-center gap-1 text-secondary font-bold text-xs">
                  <stat.icon className="w-3.5 h-3.5" />
                  <span>{stat.trend}</span>
                </div>
              ) : (
                <p className="text-xs text-outline font-medium">{stat.sub}</p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Filters & Actions */}
      <section className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative group">
            <select className="appearance-none bg-white border border-outline-variant/30 pl-4 pr-10 py-2 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[160px]">
              <option>Septiembre 2023</option>
              <option>Agosto 2023</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none group-hover:text-primary transition-colors" />
          </div>
          <div className="relative group">
            <select className="appearance-none bg-white border border-outline-variant/30 pl-10 pr-10 py-2 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[200px]">
              <option>Todas las propiedades</option>
              <option>Apartamento Centro 4A</option>
            </select>
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none group-hover:text-primary transition-colors" />
          </div>
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 border border-primary text-primary px-5 py-2 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-primary text-white px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            Nuevo Gasto
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Transactions Table */}
        <div className="lg:col-span-8 bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center">
            <h3 className="font-display font-bold text-primary">Transacciones Recientes</h3>
            <span className="text-xs text-outline font-medium">Mostrando 15 de 42</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-[10px] font-bold text-outline uppercase tracking-widest border-b border-surface-container">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Concepto</th>
                  <th className="px-6 py-4">Propiedad</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, idx) => (
                  <tr key={idx} className="zebra-stripe border-b border-surface-container/30 last:border-0 hover:bg-active transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-on-surface">{t.date}</td>
                    <td className="px-6 py-4 text-xs font-bold text-on-surface">{t.concept}</td>
                    <td className="px-6 py-4 text-xs text-outline">{t.property}</td>
                    <td className={cn("px-6 py-4 text-xs font-bold text-right", t.type === 'income' ? 'text-secondary' : 'text-error')}>
                      {t.amount}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight",
                          t.status === 'Completado' ? "bg-secondary-container/20 text-on-secondary-container" : "bg-tertiary-container/10 text-on-tertiary-container"
                        )}>
                          {t.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-white text-center border-t border-surface-container">
            <button className="text-primary font-bold text-xs hover:underline">Ver todo el historial</button>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Distribution Card */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-bold text-primary mb-6">Distribución de Gastos</h3>
            <div className="space-y-6">
              {distributions.map((d, id) => (
                <div key={id} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-on-surface">{d.label}</span>
                    <span className="text-primary">{d.percentage}%</span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all duration-1000", d.color)} style={{ width: `${d.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Projected Payout */}
          <div className="bg-primary text-white rounded-xl p-6 relative overflow-hidden shadow-lg group">
            <div className="relative z-10">
              <h3 className="text-sm font-bold opacity-70 mb-1">Pago Estimado</h3>
              <p className="text-[10px] opacity-60 mb-6 uppercase tracking-wider">Disponible para retirar el 30 de Septiembre</p>
              <h2 className="font-display text-4xl font-bold mb-8">$6,360.00</h2>
              <button className="w-full bg-secondary hover:bg-secondary/90 text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2">
                <Banknote className="w-4 h-4" />
                Solicitar Retiro
              </button>
            </div>
            <CreditCard className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 rotate-12 transition-transform group-hover:scale-110" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          </div>

          {/* Smart Tip */}
          <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/20 border-dashed">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Lightbulb className="w-4 h-4 text-secondary fill-secondary/20" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-primary mb-1">Smart Tip</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">Tus gastos de limpieza en 'Villa Marítima' han subido un 15% este mes. Considera revisar el contrato con el proveedor.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
