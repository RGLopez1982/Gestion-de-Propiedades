import React, { useEffect, useMemo, useState } from 'react';
import { createBooking, getBookings, getProperties, updateBooking, Booking, Property } from '../../services/api';

interface BookingFormProps {
  onSuccess: (booking: Booking) => void;
  onCancel: () => void;
  booking?: Booking | null;
}

const dateDiffInNights = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  return Math.max(Math.round((end - start) / 86400000), 0);
};

const hasDateOverlap = (startA: string, endA: string, startB: string, endB: string) => {
  return startA < endB && endA > startB;
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
};

const todayKey = new Date().toISOString().split('T')[0];

export function BookingForm({ onSuccess, onCancel, booking }: BookingFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [formData, setFormData] = useState({
    tenant: booking?.tenant || '',
    property_id: booking?.property_id ? String(booking.property_id) : '',
    guests: String(booking?.guests || 1),
    checkIn: booking?.checkIn || '',
    checkOut: booking?.checkOut || '',
    status: booking?.status || 'Confirmado',
    amountTotal: String(booking?.amountTotal || booking?.amountPaid || ''),
    amountPaid: String(booking?.amountPaid || ''),
    refundIssued: Boolean(booking?.refundIssued),
  });

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const [propertyData, bookingData] = await Promise.all([getProperties(), getBookings()]);
        setProperties(propertyData);
        setBookings(bookingData);
      } catch (err) {
        console.error('Error loading booking form data:', err);
      }
    };
    loadProperties();
  }, []);

  const selectedGuests = Math.min(Math.max(parseInt(formData.guests) || 1, 1), 4);
  const selectedDates = Boolean(formData.checkIn && formData.checkOut && formData.checkOut > formData.checkIn);
  const getConflictingBooking = (propertyId: number) => {
    if (!selectedDates) return undefined;
    return bookings.find((item) =>
      item.property_id === propertyId &&
      item.status !== 'Cancelado' &&
      item.id !== booking?.id &&
      hasDateOverlap(formData.checkIn, formData.checkOut, item.checkIn, item.checkOut)
    );
  };
  const filteredProperties = properties.filter((property) =>
    (property.capacity || 1) >= selectedGuests &&
    !getConflictingBooking(property.id)
  );
  const unavailableByCapacity = properties.filter((property) => (property.capacity || 1) < selectedGuests);
  const unavailableByDate = properties
    .map((property) => ({ property, conflict: getConflictingBooking(property.id) }))
    .filter(({ property, conflict }) => (property.capacity || 1) >= selectedGuests && conflict);
  const selectedProperty = properties.find((property) => property.id === Number(formData.property_id));
  const nights = dateDiffInNights(formData.checkIn, formData.checkOut);
  const suggestedTotal = useMemo(() => {
    const rate = selectedProperty?.nightlyRate ?? selectedProperty?.monthlyRate ?? 0;
    return nights > 0 ? rate * nights : 0;
  }, [nights, selectedProperty]);

  useEffect(() => {
    if (!booking && suggestedTotal > 0 && formData.status === 'Confirmado') {
      setFormData((prev) => ({
        ...prev,
        amountTotal: String(suggestedTotal),
        amountPaid: String(suggestedTotal),
      }));
    }
  }, [booking, suggestedTotal, formData.status]);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.status === 'Confirmado' && prev.amountTotal) {
        return { ...prev, amountPaid: prev.amountTotal, refundIssued: false };
      }
      if (prev.status === 'Pendiente') {
        return { ...prev, refundIssued: false };
      }
      return prev;
    });
  }, [formData.status, formData.amountTotal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(['guests', 'checkIn', 'checkOut'].includes(name) ? { property_id: '' } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!selectedDates) {
        setError('Selecciona un rango de fechas valido.');
        setLoading(false);
        return;
      }

      if (!booking?.id && formData.checkIn < todayKey) {
        setError('La fecha de inicio no puede ser anterior a hoy.');
        setLoading(false);
        return;
      }

      if (formData.checkOut <= formData.checkIn) {
        setError('La fecha de salida debe ser posterior a la fecha de ingreso.');
        setLoading(false);
        return;
      }

      const payload = {
        tenant: formData.tenant,
        property_id: formData.property_id ? parseInt(formData.property_id) : undefined,
        guests: selectedGuests,
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        status: formData.status,
        amountTotal: formData.status === 'Confirmado'
          ? parseFloat(formData.amountTotal) || 0
          : parseFloat(formData.amountTotal || formData.amountPaid) || 0,
        amountPaid: formData.status === 'Confirmado'
          ? parseFloat(formData.amountTotal) || 0
          : parseFloat(formData.amountPaid) || 0,
        refundIssued: formData.status === 'Cancelado' ? formData.refundIssued : false,
      };
      const savedBooking = booking?.id
        ? await updateBooking(booking.id, payload)
        : await createBooking(payload);
      onSuccess(savedBooking);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar reserva');
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
        <label className="block text-sm font-bold text-on-surface mb-1">Nombre del huesped *</label>
        <input
          type="text"
          name="tenant"
          value={formData.tenant}
          onChange={handleChange}
          required
          placeholder="Juan Perez"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">Numero de huespedes</label>
        <select
          name="guests"
          value={formData.guests}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="1">1 huesped</option>
          <option value="2">2 huespedes</option>
          <option value="3">3 huespedes</option>
          <option value="4">4 huespedes</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">Departamento *</label>
        <select
          name="property_id"
          value={formData.property_id}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Seleccionar departamento</option>
          {filteredProperties.map(prop => (
            <option key={prop.id} value={prop.id}>
              {(prop.department || prop.location || prop.name)} - hasta {prop.capacity || 1} persona{(prop.capacity || 1) > 1 ? 's' : ''}
            </option>
          ))}
        </select>
        {filteredProperties.length === 0 && (
          <p className="text-xs text-error mt-1">
            {selectedDates
              ? `No hay departamentos disponibles para ${selectedGuests} huespedes en esas fechas.`
              : 'Selecciona fechas para verificar disponibilidad.'}
          </p>
        )}
        {unavailableByDate.length > 0 && (
          <div className="mt-2 rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
            <p className="font-bold text-on-surface mb-1">Ocupados en esas fechas:</p>
            {unavailableByDate.slice(0, 3).map(({ property, conflict }) => (
              <p key={property.id}>
                {property.department || property.location || property.name}: se desocupa el {formatDate(conflict?.checkOut)}
              </p>
            ))}
          </div>
        )}
        {unavailableByCapacity.length > 0 && (
          <p className="text-xs text-on-surface-variant mt-2">
            {unavailableByCapacity.length} departamento{unavailableByCapacity.length > 1 ? 's' : ''} no cumple{unavailableByCapacity.length > 1 ? 'n' : ''} con la capacidad solicitada.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">Check-in *</label>
          <input
            type="date"
            name="checkIn"
            value={formData.checkIn}
            onChange={handleChange}
            min={booking?.id ? undefined : todayKey}
            required
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">Check-out *</label>
          <input
            type="date"
            name="checkOut"
            value={formData.checkOut}
            onChange={handleChange}
            min={formData.checkIn || todayKey}
            required
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {suggestedTotal > 0 && (
        <p className="text-xs text-on-surface-variant">
          Sugerido: {nights} noche{nights !== 1 ? 's' : ''} x ${(selectedProperty?.nightlyRate ?? selectedProperty?.monthlyRate ?? 0).toFixed(2)} = ${suggestedTotal.toFixed(2)}
        </p>
      )}

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">Estado</label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="Confirmado">Confirmado - pago total realizado</option>
          <option value="Pendiente">Pendiente - pago parcial o sin pago</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </div>

      {formData.status === 'Confirmado' && (
        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">Monto pagado total</label>
          <input
            type="number"
            name="amountTotal"
            value={formData.amountTotal}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder={suggestedTotal > 0 ? String(suggestedTotal) : '0.00'}
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {formData.status === 'Pendiente' && (
        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">Pago parcial registrado</label>
          <input
            type="number"
            name="amountPaid"
            value={formData.amountPaid}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {formData.status === 'Cancelado' && (
        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">
            Pago recibido antes de cancelar
          </label>
          <input
            type="number"
            name="amountPaid"
            value={formData.amountPaid}
            onChange={handleChange}
            min="0"
            step="0.01"
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {formData.status === 'Cancelado' && Number(formData.amountPaid) > 0 && (
        <label className="flex items-center gap-3 rounded-lg border border-outline-variant/30 p-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="refundIssued"
            checked={formData.refundIssued}
            onChange={handleChange}
            className="h-4 w-4"
          />
          Se hizo devolucion del pago
        </label>
      )}

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
          disabled={loading || filteredProperties.length === 0}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? 'Guardando...' : booking ? 'Guardar cambios' : 'Crear reserva'}
        </button>
      </div>
    </form>
  );
}
