import React, { useState, useEffect } from 'react';
import { createTransaction, getProperties, Transaction, Property } from '../../services/api';

interface TransactionFormProps {
  onSuccess: (transaction: Transaction) => void;
  onCancel: () => void;
}

export function TransactionForm({ onSuccess, onCancel }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    concept: '',
    property_id: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    status: 'Completado',
  });

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const data = await getProperties();
        setProperties(data);
      } catch (err) {
        console.error('Error loading properties:', err);
      }
    };
    loadProperties();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const transaction = await createTransaction({
        date: formData.date,
        concept: formData.concept,
        property_id: formData.property_id ? parseInt(formData.property_id) : undefined,
        amount: parseFloat(formData.amount),
        type: formData.type,
        status: formData.status,
      });
      onSuccess(transaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear transacción');
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
          Tipo de transacción *
        </label>
        <select
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Concepto *
        </label>
        <input
          type="text"
          name="concept"
          value={formData.concept}
          onChange={handleChange}
          required
          placeholder="Ej: Alquiler mensual"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Departamento asociado
        </label>
        <select
          name="property_id"
          value={formData.property_id}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Sin asignar</option>
          {properties.map(prop => (
            <option key={prop.id} value={prop.id}>
              {prop.department || prop.location || prop.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Monto ($) *
        </label>
        <input
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          required
          step="0.01"
          placeholder="1200.00"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Fecha
        </label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Estado
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="Completado">Completado</option>
          <option value="Pendiente">Pendiente</option>
        </select>
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
          {loading ? 'Guardando...' : 'Guardar transacción'}
        </button>
      </div>
    </form>
  );
}
