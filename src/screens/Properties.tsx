import React, { useState, useEffect } from 'react';
import {
  Plus,
  Filter,
  Building2,
  Users,
  Pencil,
  Search,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getProperties, getBnaRate, Property } from '../services/api';
import { useModal } from '../hooks/useModal';
import { Modal } from '../components/Modal';
import { PropertyForm } from '../components/forms/PropertyForm';

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [bnaRate, setBnaRate] = useState<number | null>(null);

  const getRates = (storedRate: number, rate: number | null) => {
    const currentRate = rate || 1495.00;
    if (storedRate > 10000) {
      return {
        usd: storedRate / currentRate,
        ars: storedRate,
        isLegacyArs: true
      };
    } else {
      return {
        usd: storedRate,
        ars: storedRate * currentRate,
        isLegacyArs: false
      };
    }
  };
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'Todos',
    capacity: 'Todas',
    sort: 'department',
  });
  const modal = useModal();

  const loadProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await loadProperties();
      try {
        const rateData = await getBnaRate();
        setBnaRate(rateData.rate);
      } catch (err) {
        console.error('Error fetching BNA rate:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handlePropertySaved = (property: Property) => {
    setProperties(prev => {
      const exists = prev.some((item) => item.id === property.id);
      return exists
        ? prev.map((item) => item.id === property.id ? property : item)
        : [property, ...prev];
    });
    setSelectedProperty(null);
    modal.close();
  };

  const openNewProperty = () => {
    setSelectedProperty(null);
    modal.open();
  };

  const openEditProperty = (property: Property) => {
    setSelectedProperty(property);
    modal.open();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ocupado':
        return { statusColor: 'bg-secondary-container text-on-secondary-container', indicatorColor: 'bg-secondary' };
      case 'Disponible':
        return { statusColor: 'bg-tertiary-container/10 text-on-tertiary-container', indicatorColor: 'bg-tertiary' };
      case 'Mantenimiento':
        return { statusColor: 'bg-surface-container-high text-on-surface-variant', indicatorColor: 'bg-outline-variant' };
      default:
        return { statusColor: 'bg-surface-container text-on-surface-variant', indicatorColor: 'bg-outline' };
    }
  };

  const getPropertyImages = (property: Property) => {
    if (Array.isArray(property.images)) return property.images;
    if (typeof property.images === 'string') {
      try {
        const parsed = JSON.parse(property.images);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return property.images ? [property.images] : [];
      }
    }
    return property.image ? [property.image] : [];
  };

  const filteredProperties = properties
    .filter((prop) => {
      const query = filters.search.trim().toLowerCase();
      const searchable = `${prop.name} ${prop.department || ''} ${prop.location || ''}`.toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const displayStatus = prop.availabilityStatus || prop.status;
      const matchesStatus = filters.status === 'Todos' || displayStatus === filters.status;
      const matchesCapacity = filters.capacity === 'Todas' || Number(prop.capacity || 1) >= Number(filters.capacity);
      return matchesSearch && matchesStatus && matchesCapacity;
    })
    .sort((a, b) => {
      if (filters.sort === 'price') {
        return (b.nightlyRate ?? b.monthlyRate ?? 0) - (a.nightlyRate ?? a.monthlyRate ?? 0);
      }
      if (filters.sort === 'capacity') {
        return (b.capacity || 1) - (a.capacity || 1);
      }
      return (a.department || a.location || a.name).localeCompare(b.department || b.location || b.name);
    });

  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'Todos',
      capacity: 'Todas',
      sort: 'department',
    });
  };

  const hasActiveFilters = filters.search.trim() !== ''
    || filters.status !== 'Todos'
    || filters.capacity !== 'Todas'
    || filters.sort !== 'department';

  const summary = filteredProperties.slice(0, 3).map((prop) => {
    const storedRate = prop.nightlyRate ?? prop.monthlyRate ?? 0;
    const rates = getRates(storedRate, bnaRate);
    return {
      id: prop.id,
      unit: prop.department || prop.location || prop.name,
      status: (prop.availabilityStatus || prop.status) === 'Ocupado' ? 'OCUPADO' : (prop.availabilityStatus || prop.status) === 'Disponible' ? 'DISPONIBLE' : 'MANTENIMIENTO',
      statusColor: getStatusColor(prop.availabilityStatus || prop.status).statusColor,
      capacity: `${prop.capacity || 1} persona${(prop.capacity || 1) > 1 ? 's' : ''}`,
      nightly: `USD ${rates.usd.toFixed(2)} / $${rates.ars.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ARS`
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8 pb-32">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary">Gestion de Departamentos</h1>
          <p className="text-on-surface-variant mt-1 flex flex-wrap items-center gap-2">
            <span>Administra departamentos temporarios, tarifas por noche y capacidad.</span>
            {bnaRate && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                Cotización BNA Venta: ${bnaRate.toFixed(2)} ARS
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters((value) => !value)}
            className={cn(
              "bg-white border border-primary text-primary px-5 py-2 rounded-lg font-display font-semibold transition-colors hover:bg-surface-container flex items-center gap-2 text-sm",
              showFilters && "bg-surface-container"
            )}
          >
            <Filter className="w-4 h-4" />
            FILTRAR
          </button>
          <button
            onClick={openNewProperty}
            className="bg-primary text-white px-5 py-2 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center gap-2 text-sm shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            NUEVO DEPARTAMENTO
          </button>
        </div>
      </section>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => { setSelectedProperty(null); modal.close(); }}
        title={selectedProperty ? "Editar departamento" : "Crear nuevo departamento"}
        size="md"
      >
        <PropertyForm
          property={selectedProperty}
          onSuccess={handlePropertySaved}
          onCancel={() => { setSelectedProperty(null); modal.close(); }}
        />
      </Modal>

      {showFilters && (
        <section className="bg-white border border-outline-variant/30 rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <label className="md:col-span-4 relative">
              <span className="sr-only">Buscar departamento</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Buscar por nombre o departamento"
                className="w-full min-h-11 rounded-lg border border-outline-variant/30 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="md:col-span-2">
              <span className="sr-only">Estado</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full min-h-11 rounded-lg border border-outline-variant/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Disponible">Disponible</option>
                <option value="Ocupado">Ocupado</option>
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </label>

            <label className="md:col-span-2">
              <span className="sr-only">Capacidad minima</span>
              <select
                value={filters.capacity}
                onChange={(event) => setFilters((prev) => ({ ...prev, capacity: event.target.value }))}
                className="w-full min-h-11 rounded-lg border border-outline-variant/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Todas">Cualquier capacidad</option>
                <option value="1">1+ persona</option>
                <option value="2">2+ personas</option>
                <option value="3">3+ personas</option>
                <option value="4">4 personas</option>
              </select>
            </label>

            <label className="md:col-span-3">
              <span className="sr-only">Ordenar</span>
              <select
                value={filters.sort}
                onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}
                className="w-full min-h-11 rounded-lg border border-outline-variant/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="department">Ordenar por departamento</option>
                <option value="price">Mayor precio por noche</option>
                <option value="capacity">Mayor capacidad</option>
              </select>
            </label>

            <div className="md:col-span-1 flex gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-11 rounded-lg border border-outline-variant/30 px-3 text-xs font-bold uppercase text-primary hover:bg-surface-container transition-colors"
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="min-h-11 flex-1 rounded-lg border border-outline-variant/30 text-primary hover:bg-surface-container transition-colors flex items-center justify-center"
                aria-label="Cerrar filtros"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Mostrando {filteredProperties.length} de {properties.length} departamentos.
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : properties.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-on-surface-variant">No hay departamentos registrados</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-on-surface-variant">No hay departamentos que coincidan con los filtros</p>
          </div>
        ) : (
          filteredProperties.map((prop) => {
            const displayStatus = prop.availabilityStatus || prop.status;
            const { statusColor, indicatorColor } = getStatusColor(displayStatus);
            const images = getPropertyImages(prop);
            const coverImage = images[0] || prop.image || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=600';
            const storedRate = prop.nightlyRate ?? prop.monthlyRate ?? 0;
            const rates = getRates(storedRate, bnaRate);

            return (
              <div key={prop.id} className="group bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={coverImage}
                    alt={prop.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4">
                    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase", statusColor)}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", indicatorColor)} />
                      {displayStatus}
                    </span>
                  </div>
                  {prop.status !== displayStatus && (
                    <div className="absolute top-14 right-4 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
                      Manual: {prop.status}
                    </div>
                  )}
                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-4 bg-black/60 text-white px-2 py-1 rounded text-[10px] font-bold">
                      {images.length} imagenes
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col h-[calc(100%-12rem)]">
                  <div className="mb-4">
                    <h3 className="font-display font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">{prop.name}</h3>
                    <div className="flex items-center gap-1 text-on-surface-variant mt-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-xs">{prop.department || prop.location}</span>
                    </div>
                    <div className="flex items-center gap-1 text-on-surface-variant mt-1">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-xs">Hasta {prop.capacity || 1} persona{(prop.capacity || 1) > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-surface-container flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-outline uppercase tracking-widest leading-none">
                        Precio por noche
                      </span>
                      <span className="text-xs font-bold mt-1 text-on-surface flex flex-col">
                        <span>USD {rates.usd.toFixed(2)}</span>
                        <span className="text-[10px] text-on-surface-variant font-normal">${rates.ars.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ARS</span>
                      </span>
                    </div>
                    <button
                      onClick={() => openEditProperty(prop)}
                      className="rounded-lg border border-outline-variant/30 p-2 text-primary hover:bg-surface-container transition-colors"
                      aria-label="Editar departamento"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-primary mb-6">Resumen por Departamento</h2>
        <div className="bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-outline border-b border-surface-container">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">DEPARTAMENTO</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">ESTADO</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">CAPACIDAD</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right">POR NOCHE</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {summary.map((row) => (
                  <tr key={row.id} className="hover:bg-active transition-colors">
                    <td className="px-6 py-4 font-bold text-sm">{row.unit}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase", row.statusColor)}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">{row.capacity}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-primary">{row.nightly}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          const property = filteredProperties.find((item) => item.id === row.id);
                          if (property) openEditProperty(property);
                        }}
                        className="text-primary text-[10px] font-bold uppercase hover:underline"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <button
        onClick={openNewProperty}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 group"
      >
        <Building2 className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-12 right-0 bg-primary text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Nuevo Departamento
        </div>
      </button>
    </div>
  );
}
