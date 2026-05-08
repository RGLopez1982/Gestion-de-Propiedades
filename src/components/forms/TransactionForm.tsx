import React, { useState, useEffect } from 'react';
import { createTransaction, getProperties, Transaction, Property, updateTransaction } from '../../services/api';
import { parseMoneyInput } from '../../lib/money';
import { normalizeTextInput } from '../../lib/text';

interface TransactionFormProps {
  onSuccess: (transaction: Transaction) => void;
  onCancel: () => void;
  transaction?: Transaction | null;
}

const getInitialFormData = (transaction?: Transaction | null) => ({
  date: transaction?.date || new Date().toISOString().split('T')[0],
  concept: transaction?.concept || '',
  property_id: transaction?.property_id ? String(transaction.property_id) : '',
  amount: transaction ? String(Math.abs(transaction.amount)) : '',
  type: transaction?.type || 'expense' as 'income' | 'expense',
  status: transaction?.status || 'Completado',
  paidBy: transaction?.paidBy || '',
  paymentMethod: transaction?.paymentMethod || '',
});

export function TransactionForm({ onSuccess, onCancel, transaction }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [formData, setFormData] = useState(getInitialFormData(transaction));

  useEffect(() => {
    setFormData(getInitialFormData(transaction));
    setError('');
  }, [transaction]);

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
      [name]: normalizeTextInput(name, value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (parseMoneyInput(formData.amount) <= 0) {
        setError('El monto debe ser mayor a cero.');
        setLoading(false);
        return;
      }
      if (formData.type === 'income' && !formData.paymentMethod) {
        setError('Los ingresos deben indicar medio de pago.');
        setLoading(false);
        return;
      }

      const payload = {
        date: formData.date,
        concept: formData.concept,
        property_id: formData.property_id ? parseInt(formData.property_id) : undefined,
        amount: parseMoneyInput(formData.amount),
        type: formData.type,
        status: formData.status,
        paidBy: formData.type === 'expense' ? formData.paidBy : undefined,
        paymentMethod: formData.paymentMethod || undefined,
      };
      const savedTransaction = transaction
        ? await updateTransaction(transaction.id, payload)
        : await createTransaction(payload);
      onSuccess(savedTransaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar transaccion');
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
          type="text"
          inputMode="numeric"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          required
          placeholder="1200"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {formData.type === 'expense' && (
        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">
            Quien pagó el gasto *
          </label>
          <select
            name="paidBy"
            value={formData.paidBy}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Seleccionar dueño</option>
            <option value="Diego">Diego</option>
            <option value="Maru">Maru</option>
            <option value="Laura">Laura</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Medio de pago{formData.type === 'income' ? ' *' : ''}
        </label>
        <select
          name="paymentMethod"
          value={formData.paymentMethod}
          onChange={handleChange}
          required={formData.type === 'income'}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Sin especificar</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Mercado Pago">Mercado Pago</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Otro">Otro</option>
        </select>
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
          {loading ? 'Guardando...' : transaction ? 'Guardar cambios' : 'Guardar transaccion'}
        </button>
      </div>
    </form>
  );
}
