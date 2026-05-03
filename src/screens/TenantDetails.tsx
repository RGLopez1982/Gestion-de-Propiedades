import React from 'react';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  TrendingUp, 
  History,
  FileText,
  BadgeCheck,
  MoreVertical,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Download
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function TenantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const transactions = [
    { date: '15 Jul 2024', concept: 'Renta Mensual - Julio', method: 'Transferencia', status: 'LIQUIDADO', amount: '$31,000.00' },
    { date: '15 Jun 2024', concept: 'Renta Mensual - Junio', method: 'Transferencia', status: 'LIQUIDADO', amount: '$31,000.00' },
    { date: '15 May 2024', concept: 'Renta Mensual - Mayo', method: 'Tarjeta', status: 'LIQUIDADO', amount: '$31,000.00' },
    { date: '15 Abr 2024', concept: 'Renta Mensual - Abril', method: 'Transferencia', status: 'PENDIENTE', amount: '$31,000.00' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/tenants')}
            className="p-2 hover:bg-surface-container rounded-full transition-colors border border-outline-variant/20"
          >
            <ArrowLeft className="w-5 h-5 text-primary" />
          </button>
          <h1 className="font-display text-xl md:text-2xl font-bold text-on-surface">Detalle de Inquilino</h1>
        </div>
        <button className="p-2 hover:bg-surface-container rounded-full transition-colors">
          <MoreVertical className="w-5 h-5 text-outline" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-outline-variant/30 rounded-xl p-8 shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container shadow-inner">
                <img 
                  src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200&h=200" 
                  alt="Tenant"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-1 right-1 bg-secondary text-white p-1 rounded-full border-2 border-white shadow-sm">
                <BadgeCheck className="w-4 h-4 fill-white/20" />
              </div>
            </div>

            <h2 className="font-display text-2xl font-bold text-on-surface">Carlos Eduardo Ruiz</h2>
            <p className="text-on-surface-variant font-medium mt-1">Inquilino desde Enero 2023</p>

            <div className="flex gap-4 w-full mt-8">
              <button className="flex-1 bg-primary text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90">
                <Phone className="w-4 h-4" />
                Llamar
              </button>
              <button className="flex-1 border border-primary text-primary py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-surface-container">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </div>

            <div className="w-full mt-8 pt-8 border-t border-surface-container space-y-5 text-left">
              {[
                { icon: Mail, label: 'EMAIL', value: 'c.ruiz_design@email.com' },
                { icon: Phone, label: 'TELÉFONO', value: '+52 55 1234 5678' },
                { icon: MapPin, label: 'PROPIEDAD ACTUAL', value: 'Loft Reforma #402' }
              ].map((info, idx) => (
                <div key={idx} className="flex items-center gap-4 group cursor-pointer">
                  <div className="p-2 bg-surface-container-low rounded-lg text-outline group-hover:text-primary group-hover:bg-surface-container transition-all">
                    <info.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-outline uppercase tracking-widest">{info.label}</label>
                    <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{info.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Identity Documents */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Documentos de Identidad
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                'https://images.unsplash.com/photo-1589210124313-7fd9ed1bf777?auto=format&fit=crop&q=10&w=300&h=200',
                'https://images.unsplash.com/photo-1555529731-bc66e13589b3?auto=format&fit=crop&q=10&w=300&h=200'
              ].map((url, idx) => (
                <div key={idx} className="aspect-[3/2] bg-surface rounded-lg overflow-hidden border border-outline-variant/20 relative group cursor-pointer">
                  <img src={url} alt={`IDDoc ${idx}`} className="w-full h-full object-cover transition-all group-hover:scale-105 duration-500" />
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="w-4 h-4 text-white" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-bold text-outline mt-4 uppercase tracking-wider">VERIFICADO EL 15 DE ENERO, 2024</p>
          </div>
        </div>

        {/* Main Details Area */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Contracts & Finances */}
          <div className="bg-white border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-surface-container flex justify-between items-center">
              <h3 className="font-display font-semibold text-primary">Estancia y Finanzas</h3>
              <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight">Contrato Activo</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-surface-container">
              <div className="p-6">
                <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-2">FECHAS DE ESTANCIA</label>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-sm">15 Mar 2024</span>
                  <ChevronRight className="w-3 h-3 text-outline" />
                  <span className="font-mono font-bold text-sm">15 Mar 2025</span>
                </div>
                <p className="text-xs text-on-surface-variant font-medium">12 meses (Largo plazo)</p>
              </div>
              <div className="p-6">
                <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-2">MONTO TOTAL PAGADO</label>
                <div className="flex flex-col">
                  <span className="font-display text-xl font-bold text-primary">$186,000.00 MXN</span>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">6 de 12 cuotas liquidadas</p>
                </div>
              </div>
              <div className="p-6">
                <label className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-2">DEPÓSITO DE GARANTÍA</label>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display text-xl font-bold text-secondary">$31,000.00</span>
                  <ShieldCheck className="w-5 h-5 text-secondary fill-secondary/10" />
                </div>
                <p className="text-xs text-on-surface-variant font-medium">Resguardado en custodia</p>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-surface-container">
              <h3 className="font-display font-semibold text-primary">Historial de Pagos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-outline border-b border-surface-container">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">FECHA</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">CONCEPTO</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-center">MÉTODO</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-center">ESTADO</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right">MONTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/50">
                  {transactions.map((t, idx) => (
                    <tr key={idx} className="zebra-stripe hover:bg-active transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{t.date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-on-surface">{t.concept}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-medium text-outline">{t.method}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight",
                            t.status === 'LIQUIDADO' ? "bg-secondary-container/20 text-on-secondary-container" : "bg-tertiary-container/10 text-on-tertiary-container"
                          )}>
                            {t.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-on-surface text-sm">{t.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-surface-container-low text-center border-t border-surface-container">
              <button className="text-primary font-bold text-[10px] uppercase hover:underline flex items-center justify-center gap-2 mx-auto">
                <Download className="w-3.5 h-3.5" />
                Descargar Reporte Financiero Completo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Notes */}
            <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
              <h3 className="font-display font-semibold text-primary mb-4">Notas del Propietario</h3>
              <p className="text-sm text-on-surface-variant italic bg-surface-container-low p-4 rounded-lg border border-outline-variant/10 leading-relaxed">
                "Inquilino muy puntual. Reportó una pequeña filtración en mayo que fue atendida de inmediato. No tiene mascotas."
              </p>
              <button className="w-full mt-4 py-2 border border-outline-variant text-[10px] font-bold uppercase text-outline rounded hover:bg-surface-container transition-colors">Añadir Nota</button>
            </div>

            {/* Quick Actions */}
            <div className="bg-primary text-white rounded-xl p-6 shadow-sm">
              <h3 className="font-display font-semibold text-white/90 mb-4">Acciones Rápidas</h3>
              <div className="flex flex-col gap-3">
                <button className="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all">
                  <div className="p-2 bg-white/10 rounded-lg"><FileText className="w-5 h-5" /></div>
                  <span className="text-sm font-semibold">Generar Factura del Mes</span>
                </button>
                <button className="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all">
                  <div className="p-2 bg-white/10 rounded-lg"><History className="w-5 h-5" /></div>
                  <span className="text-sm font-semibold">Enviar Recordatorio de Pago</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
