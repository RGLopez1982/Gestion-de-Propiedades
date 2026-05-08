import React, { useState } from 'react';
import { createTenant, Tenant, updateTenant } from '../../services/api';
import { normalizeTextInput } from '../../lib/text';

interface TenantFormProps {
  onSuccess: (tenant: Tenant) => void;
  onCancel: () => void;
  tenant?: Tenant;
}

export function TenantForm({ onSuccess, onCancel, tenant }: TenantFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    email: tenant?.email || '',
    phone: tenant?.phone || '',
    source: tenant?.source || '',
    tags: tenant?.tags || '',
    notes: tenant?.notes || '',
    status: tenant?.status || 'CONTACTO',
    since: tenant?.since || new Date().toISOString().split('T')[0],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: normalizeTextInput(name, value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        source: formData.source.trim() || undefined,
        tags: formData.tags.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        status: formData.status,
        since: formData.since,
      };
      const savedTenant = tenant
        ? await updateTenant(tenant.id, payload)
        : await createTenant(payload);
      onSuccess(savedTenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar huesped');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-error-container text-on-error-container rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Nombre completo *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Ej: Laura Garay"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="nombre@email.com"
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">
            Telefono / WhatsApp
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+54 9 11 2345-6789"
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">
            Origen del contacto
          </label>
          <input
            type="text"
            name="source"
            value={formData.source}
            onChange={handleChange}
            placeholder="Booking, Airbnb, Instagram, referido..."
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">
            Estado comercial
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="CONTACTO">Contacto</option>
            <option value="HUESPED">Huesped</option>
            <option value="RECURRENTE">Recurrente</option>
            <option value="NO_CONTACTAR">No contactar</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Etiquetas para futuras campanas
        </label>
        <input
          type="text"
          name="tags"
          value={formData.tags}
          onChange={handleChange}
          placeholder="familia, trabajo, fin de semana, promo invierno"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Fecha de primer contacto
        </label>
        <input
          type="date"
          name="since"
          value={formData.since}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Notas internas
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          placeholder="Preferencias, motivo del viaje, grupo familiar, pedidos especiales..."
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-outline-variant/20">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-outline-variant/30 rounded-lg text-on-surface font-bold hover:bg-surface-container transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? 'Guardando...' : tenant ? 'Guardar cambios' : 'Guardar huesped'}
        </button>
      </div>
    </form>
  );
}
