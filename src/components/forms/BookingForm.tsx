import React, { useEffect, useMemo, useState } from 'react';
import { createBooking, getBookings, getProperties, updateBooking, Booking, Property } from '../../services/api';
import { formatDateDisplay } from '../../lib/dates';
import { openStoredFile, parseStoredFiles } from '../../lib/files';

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
    receivedBy: booking?.receivedBy || '',
    bookingSource: booking?.bookingSource || '',
    paymentMethod: booking?.paymentMethod || '',
    receiptFiles: parseStoredFiles(booking?.receiptFiles, booking?.receiptData, booking?.receiptName),
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
  const isPropertyReservable = (property: Property) => property.status === 'Disponible';
  const getPropertyLabel = (property: Property) => property.department || property.location || property.name;
  const getConflictingBooking = (propertyId: number) => {
    if (!selectedDates) return undefined;
    return bookings.find((item) =>
      item.property_id === propertyId &&
      item.status !== 'Cancelado' &&
      item.id !== booking?.id &&
      hasDateOverlap(formData.checkIn, formData.checkOut, item.checkIn, item.checkOut)
    );
  };
  const filteredProperties = selectedDates
    ? properties.filter((property) =>
      isPropertyReservable(property) &&
      (property.capacity || 1) >= selectedGuests &&
      !getConflictingBooking(property.id)
    )
    : [];
  const unavailableByStatus = selectedDates
    ? properties.filter((property) => !isPropertyReservable(property))
    : [];
  const unavailableByCapacity = selectedDates
    ? properties.filter((property) => (property.capacity || 1) < selectedGuests)
    : [];
  const unavailableByDate = selectedDates
    ? properties
      .map((property) => ({ property, conflict: getConflictingBooking(property.id) }))
      .filter(({ property, conflict }) => isPropertyReservable(property) && (property.capacity || 1) >= selectedGuests && conflict)
    : [];
  const selectedProperty = properties.find((property) => property.id === Number(formData.property_id));
  const selectedConflict = selectedProperty ? getConflictingBooking(selectedProperty.id) : undefined;
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

  const handleReceiptChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    const oversized = files.find((file) => file.size > 2 * 1024 * 1024);
    if (oversized) {
      setError(`El comprobante ${oversized.name} supera los 2 MB.`);
      event.target.value = '';
      return;
    }

    const readers = files.map((file) => new Promise<{ name: string; data: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result) });
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
      reader.readAsDataURL(file);
    }));

    try {
      const uploadedFiles = await Promise.all(readers);
      setFormData((prev) => ({
        ...prev,
        receiptFiles: [...prev.receiptFiles, ...uploadedFiles],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron leer los comprobantes.');
    } finally {
      event.target.value = '';
    }
  };

  const removeReceipt = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      receiptFiles: prev.receiptFiles.filter((_, itemIndex) => itemIndex !== index),
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

      if (!selectedProperty || !isPropertyReservable(selectedProperty)) {
        setError('Ese departamento no esta disponible para reservar. Cambia su estado a Disponible o elige otro.');
        setLoading(false);
        return;
      }

      if (selectedConflict) {
        setError(`${getPropertyLabel(selectedProperty)} no se puede reservar en esas fechas. Esta ocupado hasta el ${formatDateDisplay(selectedConflict.checkOut)}.`);
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
        receivedBy: formData.receivedBy.trim(),
        bookingSource: formData.bookingSource,
        paymentMethod: formData.paymentMethod,
        receiptData: formData.receiptFiles[0]?.data || '',
        receiptName: formData.receiptFiles[0]?.name || '',
        receiptFiles: formData.receiptFiles,
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

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">Departamento *</label>
        <select
          name="property_id"
          value={formData.property_id}
          onChange={handleChange}
          required
          disabled={!selectedDates || filteredProperties.length === 0}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-container-low disabled:text-on-surface-variant"
        >
          <option value="">
            {selectedDates ? 'Seleccionar departamento disponible' : 'Primero selecciona check-in y check-out'}
          </option>
          {filteredProperties.map(prop => (
            <option key={prop.id} value={prop.id}>
              {getPropertyLabel(prop)} - hasta {prop.capacity || 1} persona{(prop.capacity || 1) > 1 ? 's' : ''}
            </option>
          ))}
          {unavailableByDate.map(({ property, conflict }) => (
            <option key={property.id} value={property.id} disabled>
              {getPropertyLabel(property)} - ocupado hasta {formatDateDisplay(conflict?.checkOut)}
            </option>
          ))}
          {unavailableByStatus.map(prop => (
            <option key={prop.id} value={prop.id} disabled>
              {getPropertyLabel(prop)} - no disponible ({prop.status})
            </option>
          ))}
        </select>
        {!selectedDates && (
          <p className="text-xs text-on-surface-variant mt-1">
            Carga las fechas para ver solo los departamentos que se pueden reservar.
          </p>
        )}
        {selectedDates && filteredProperties.length === 0 && (
          <p className="text-xs text-error mt-1">
            No hay departamentos disponibles para {selectedGuests} huespedes en esas fechas.
          </p>
        )}
        {unavailableByDate.length > 0 && (
          <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-on-surface-variant">
            <p className="font-bold text-on-surface mb-1">Ocupados en esas fechas:</p>
            {unavailableByDate.slice(0, 3).map(({ property, conflict }) => (
              <p key={property.id}>
                {getPropertyLabel(property)}: no se puede reservar hasta el checkout del {formatDateDisplay(conflict?.checkOut)}
                {conflict?.tenant ? ` (${conflict.tenant})` : ''}
              </p>
            ))}
          </div>
        )}
        {unavailableByStatus.length > 0 && (
          <div className="mt-2 rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
            <p className="font-bold text-on-surface mb-1">No disponibles por estado:</p>
            {unavailableByStatus.slice(0, 4).map((property) => (
              <p key={property.id}>
                {getPropertyLabel(property)}: {property.status}
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

      <div className="rounded-lg border border-outline-variant/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Datos de recepcion y pago</h3>
          <p className="text-xs text-on-surface-variant mt-1">Informacion interna de como ingreso la reserva.</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">Quien recibio la reserva</label>
          <input
            type="text"
            name="receivedBy"
            value={formData.receivedBy}
            onChange={handleChange}
            placeholder="Ej: Rodrigo, Laura, recepcion"
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-1">Canal de reserva</label>
            <select
              name="bookingSource"
              value={formData.bookingSource}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Seleccionar canal</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Telefono">Telefono</option>
              <option value="Instagram">Instagram</option>
              <option value="Airbnb">Airbnb</option>
              <option value="Booking">Booking</option>
              <option value="Web">Web</option>
              <option value="Referido">Referido</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-on-surface mb-1">Medio de pago</label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Seleccionar medio</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Mercado Pago">Mercado Pago</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-on-surface mb-1">Comprobante</label>
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleReceiptChange}
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {formData.receiptFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {formData.receiptFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3 text-xs">
                  <button
                    type="button"
                    onClick={() => openStoredFile(file.data, file.name || 'comprobante')}
                    className="min-w-0 truncate font-bold text-primary hover:underline"
                  >
                    Comprobante {index + 1}: {file.name || 'Ver archivo cargado'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReceipt(index)}
                    className="shrink-0 rounded border border-outline-variant/30 px-2 py-1 font-bold text-error hover:bg-error-container/20"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-on-surface-variant mt-1">Maximo 2 MB. Se guarda junto con la reserva.</p>
        </div>
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
          disabled={loading || filteredProperties.length === 0 || !formData.property_id}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? 'Guardando...' : booking ? 'Guardar cambios' : 'Crear reserva'}
        </button>
      </div>
    </form>
  );
}
