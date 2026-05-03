import React from 'react';
import { 
  Users, 
  MoreVertical, 
  MessageCircle, 
  Phone, 
  Search, 
  Filter,
  ChevronRight,
  TrendingUp,
  UserPlus,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Tenants() {
  const tenants = [
    { id: 1, name: 'Carlos Eduardo Ruiz', status: 'VIGENTE', property: 'Loft Reforma #402', since: 'Enero 2023', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100&h=100' },
    { id: 2, name: 'Marco Antonio', status: 'ENTRANTE', property: 'Loft Moderno Centro', since: 'Octubre 2023', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100' },
    { id: 3, name: 'Elena Rossi', status: 'VIGENTE', property: 'Villa Marítima', since: 'Mayo 2023', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100&h=100' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary">Gestión de Inquilinos</h1>
          <p className="text-on-surface-variant mt-1">Directorio completo de sus inquilinos actuales y pasados.</p>
        </div>
        <button className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Añadir Inquilino
        </button>
      </section>

      <section className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, propiedad o email..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button className="px-4 py-2 bg-white border border-outline-variant/30 rounded-lg text-on-surface hover:bg-surface-container transition-colors">
          <Filter className="w-4 h-4" />
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tenants.map((t) => (
          <Link 
            key={t.id} 
            to={`/tenants/${t.id}`}
            className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-surface-container group-hover:border-primary transition-colors">
                  <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-on-surface group-hover:text-primary transition-colors">{t.name}</h3>
                  <span className={cn(
                    "inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase mt-1",
                    t.status === 'VIGENTE' ? "bg-secondary-container/20 text-on-secondary-container" : "bg-primary-container/10 text-primary"
                  )}>
                    {t.status}
                  </span>
                </div>
              </div>
              <button className="p-1 hover:bg-surface-container rounded-lg">
                <MoreVertical className="w-4 h-4 text-outline" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t.property}</span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Desde {t.since}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-6 pt-6 border-t border-surface-container">
              <button className="p-2 border border-outline-variant/30 rounded-lg text-primary hover:bg-surface-container transition-colors grow flex justify-center">
                <Phone className="w-4 h-4" />
              </button>
              <button className="p-2 border border-outline-variant/30 rounded-lg text-primary hover:bg-surface-container transition-colors grow flex justify-center">
                <MessageCircle className="w-4 h-4" />
              </button>
              <div className="p-2 bg-primary text-white rounded-lg transition-colors group-hover:rotate-45 transition-transform flex justify-center items-center">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
