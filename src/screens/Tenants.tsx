import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Search,
  Tag,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { getTenants, Tenant } from '../services/api';
import { useModal } from '../hooks/useModal';
import { Modal } from '../components/Modal';
import { TenantForm } from '../components/forms/TenantForm';

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const modal = useModal();

  const loadTenants = async () => {
    try {
      const data = await getTenants();
      setTenants(data);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await loadTenants();
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleTenantCreated = (tenant: Tenant) => {
    setTenants(prev => [tenant, ...prev]);
    modal.close();
  };

  const handleTenantSaved = (tenant: Tenant) => {
    if (editingTenant) {
      setTenants(prev => prev.map((item) => item.id === tenant.id ? { ...item, ...tenant } : item));
    } else {
      setTenants(prev => [tenant, ...prev]);
    }
    setEditingTenant(null);
    modal.close();
  };

  const openCreateModal = () => {
    setEditingTenant(null);
    modal.open();
  };

  const openEditModal = (event: React.MouseEvent, tenant: Tenant) => {
    event.preventDefault();
    setEditingTenant(tenant);
    modal.open();
  };

  const closeModal = () => {
    setEditingTenant(null);
    modal.close();
  };

  const formatDate = (value?: string) => {
    if (!value) return 'Sin fecha';
    const [year, month, day] = value.split('-');
    return day && month && year ? `${day}-${month}-${year}` : value;
  };

  const filteredTenants = tenants.filter((tenant) => {
    const term = searchTerm.toLowerCase();
    return tenant.name.toLowerCase().includes(term)
      || Boolean(tenant.property?.toLowerCase().includes(term))
      || Boolean(tenant.email?.toLowerCase().includes(term))
      || Boolean(tenant.phone?.toLowerCase().includes(term))
      || Boolean(tenant.tags?.toLowerCase().includes(term));
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary">Huespedes temporarios</h1>
          <p className="text-on-surface-variant mt-1">Historial de estadias, contactos y datos utiles para futuras campanas.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Agregar huesped
        </button>
      </section>

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={editingTenant ? 'Editar huesped' : 'Agregar huesped o contacto'}
        size="md"
      >
        <TenantForm
          tenant={editingTenant || undefined}
          onSuccess={editingTenant ? handleTenantSaved : handleTenantCreated}
          onCancel={closeModal}
        />
      </Modal>

      <section className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            placeholder="Buscar por nombre, departamento, email, telefono o etiqueta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button className="px-4 py-2 bg-white border border-outline-variant/30 rounded-lg text-on-surface hover:bg-surface-container transition-colors">
          <Filter className="w-4 h-4" />
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-on-surface-variant">No hay huespedes registrados</p>
          </div>
        ) : (
          filteredTenants.map((tenant) => (
            <Link
              key={tenant.id}
              to={`/tenants/${tenant.id}`}
              className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-surface-container group-hover:border-primary transition-colors bg-gradient-to-br from-primary to-secondary">
                    {tenant.avatar ? (
                      <img src={tenant.avatar} alt={tenant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold">
                        {tenant.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-on-surface group-hover:text-primary transition-colors">{tenant.name}</h3>
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase mt-1',
                      tenant.status === 'NO_CONTACTAR' ? 'bg-error-container/20 text-error' : 'bg-secondary-container/20 text-on-secondary-container'
                    )}>
                      {tenant.status === 'NO_CONTACTAR' ? 'No contactar' : tenant.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(event) => openEditModal(event, tenant)}
                  className="p-2 hover:bg-surface-container rounded-lg text-outline hover:text-primary transition-colors"
                  title="Editar huesped"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Ultimo depto: {tenant.property || 'Sin estadias'}</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    {Number(tenant.staysCount) > 0
                      ? `${tenant.staysCount} estadia(s) - ultima salida ${formatDate(tenant.lastStay)}`
                      : `Contacto desde ${formatDate(tenant.since)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Pagado historico: ${Number(tenant.totalPaid || 0).toFixed(2)}</span>
                </div>
                {tenant.tags && (
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Tag className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium line-clamp-1">{tenant.tags}</span>
                  </div>
                )}
                {(tenant.email || tenant.phone) && (
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    {tenant.email ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                    <span className="text-xs font-medium line-clamp-1">{tenant.email || tenant.phone}</span>
                  </div>
                )}
                {tenant.source && (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-outline">
                    Origen: {tenant.source}
                  </div>
                )}
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
          ))
        )}
      </div>
    </div>
  );
}
