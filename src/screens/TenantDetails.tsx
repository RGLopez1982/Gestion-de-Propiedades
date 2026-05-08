import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Download,
  History,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Tag,
  Trash2,
  User
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Booking, deleteTenant, getTenant, Tenant, Transaction } from '../services/api';
import { Modal } from '../components/Modal';
import { TenantForm } from '../components/forms/TenantForm';
import { useModal } from '../hooks/useModal';
import { formatDateDisplay } from '../lib/dates';
import { openStoredFile, parseStoredFiles } from '../lib/files';
import { buildReservationWhatsappMessage, getMostRelevantBooking, getPhoneHref, openWhatsappWeb } from '../lib/contact';

export default function TenantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const editModal = useModal();

  useEffect(() => {
    const loadTenant = async () => {
      if (!id) return;

      try {
        const data = await getTenant(Number(id));
        setTenant(data);
      } catch (error) {
        console.error('Error loading tenant:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, [id]);

  const stays = tenant?.stays || [];
  const transactions = tenant?.transactions || [];
  const totalPaid = Number(tenant?.totalPaid || 0);
  const totalNights = stays.reduce((sum, stay) => {
    const checkIn = new Date(`${stay.checkIn}T00:00:00`);
    const checkOut = new Date(`${stay.checkOut}T00:00:00`);
    const nights = Math.max(Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000), 0);
    return sum + nights;
  }, 0);

  const handleTenantUpdated = (updatedTenant: Tenant) => {
    setTenant((prev) => prev ? { ...prev, ...updatedTenant } : updatedTenant);
    editModal.close();
  };

  const handleTenantDeleted = () => {
    if (!tenant) return;
    setDeleteDialogOpen(true);
  };

  const confirmTenantDeleted = async () => {
    if (!tenant) return;
    try {
      await deleteTenant(tenant.id);
      navigate('/tenants');
    } catch (error) {
      console.error('Error deleting tenant:', error);
      setDeleteDialogOpen(false);
      setNotice('No se pudo eliminar el huesped. Intentalo nuevamente.');
    }
  };

  const handleCallTenant = () => {
    const phoneHref = getPhoneHref(tenant?.phone);
    if (!phoneHref) {
      setNotice('Este huesped no tiene telefono cargado.');
      return;
    }

    window.location.href = phoneHref;
  };

  const handleWhatsappTenant = () => {
    if (!tenant) return;

    const booking = getMostRelevantBooking(stays);
    const opened = openWhatsappWeb(tenant.phone, buildReservationWhatsappMessage(tenant, booking));
    if (!opened) {
      setNotice('Este huesped no tiene telefono cargado para WhatsApp.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <button
          onClick={() => navigate('/tenants')}
          className="mb-6 p-2 hover:bg-surface-container rounded-full transition-colors border border-outline-variant/20"
        >
          <ArrowLeft className="w-5 h-5 text-primary" />
        </button>
        <p className="text-on-surface-variant">No se encontro el huesped solicitado.</p>
      </div>
    );
  }

  const statusLabel = tenant.status === 'NO_CONTACTAR' ? 'No contactar' : tenant.status;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tenants')}
              className="p-2 hover:bg-surface-container rounded-full transition-colors border border-outline-variant/20"
            >
              <ArrowLeft className="w-5 h-5 text-primary" />
            </button>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold text-on-surface">Historial del huesped</h1>
              <p className="text-sm text-on-surface-variant">Contacto, estadias y pagos reales registrados.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={editModal.open}
            className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Pencil className="w-4 h-4" />
            Editar datos
          </button>
          <button
            onClick={handleTenantDeleted}
            className="border border-error/30 text-error px-5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-error-container/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>

      <Modal isOpen={editModal.isOpen} onClose={editModal.close} title="Editar huesped" size="md">
        <TenantForm
          tenant={tenant}
          onSuccess={handleTenantUpdated}
          onCancel={editModal.close}
        />
      </Modal>

      <Modal isOpen={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} title="Eliminar huesped" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-on-surface-variant">
            Vas a eliminar a <strong>{tenant?.name}</strong>. Esta accion no elimina sus reservas historicas.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteDialogOpen(false)} className="flex-1 rounded-lg border border-outline-variant/30 px-4 py-2 font-bold">
              Volver
            </button>
            <button onClick={confirmTenantDeleted} className="flex-1 rounded-lg bg-error px-4 py-2 font-bold text-white">
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(notice)} onClose={() => setNotice('')} title="Aviso" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-on-surface-variant">{notice}</p>
          <button onClick={() => setNotice('')} className="w-full rounded-lg bg-primary px-4 py-2 font-bold text-white">
            Entendido
          </button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-outline-variant/30 rounded-xl p-8 shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-surface-container shadow-inner">
                {tenant.avatar ? (
                  <img src={tenant.avatar} alt={tenant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-secondary text-white text-4xl font-bold">
                    {tenant.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute bottom-1 right-1 bg-secondary text-white p-1 rounded-full border-2 border-white shadow-sm">
                <BadgeCheck className="w-4 h-4 fill-white/20" />
              </div>
            </div>

            <h2 className="font-display text-2xl font-bold text-on-surface">{tenant.name}</h2>
            <span className={cn(
              'mt-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase',
              tenant.status === 'NO_CONTACTAR' ? 'bg-error-container/20 text-error' : 'bg-secondary-container/20 text-on-secondary-container'
            )}>
              {statusLabel}
            </span>

            <div className="flex gap-4 w-full mt-8">
              <button
                type="button"
                onClick={handleCallTenant}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              >
                <Phone className="w-4 h-4" />
                Llamar
              </button>
              <button
                type="button"
                onClick={handleWhatsappTenant}
                className="flex-1 border border-primary text-primary py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-surface-container"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </div>

            <div className="w-full mt-8 pt-8 border-t border-surface-container space-y-5 text-left">
              {[
                { icon: Mail, label: 'EMAIL', value: tenant.email || 'Sin email registrado' },
                { icon: Phone, label: 'TELEFONO', value: tenant.phone || 'Sin telefono registrado' },
                { icon: MapPin, label: 'ULTIMO DEPARTAMENTO', value: tenant.property || 'Sin estadias registradas' },
                { icon: User, label: 'ORIGEN', value: tenant.source || 'Sin origen registrado' },
                { icon: Tag, label: 'ETIQUETAS', value: tenant.tags || 'Sin etiquetas' },
              ].map((info, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="p-2 bg-surface-container-low rounded-lg text-outline">
                    <info.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-outline uppercase tracking-widest">{info.label}</label>
                    <p className="text-sm font-semibold text-on-surface">{info.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-semibold text-primary mb-4">Notas para seguimiento</h3>
            <p className="text-sm text-on-surface-variant bg-surface-container-low p-4 rounded-lg border border-outline-variant/10 leading-relaxed whitespace-pre-wrap">
              {tenant.notes || 'Todavia no hay notas internas para este huesped.'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-8">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Estadias', value: String(stays.length), detail: `Noches acumuladas: ${totalNights}` },
              { label: 'Ultima salida', value: formatDateDisplay(tenant.lastStay), detail: tenant.property || 'Sin departamento' },
              { label: 'Pagado historico', value: `$${totalPaid.toFixed(2)}`, detail: `${transactions.length} movimiento(s)` },
            ].map((item) => (
              <div key={item.label} className="bg-white border border-outline-variant/30 rounded-xl p-5 shadow-sm">
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">{item.label}</p>
                <p className="font-display text-2xl font-bold text-primary">{item.value}</p>
                <p className="text-xs text-on-surface-variant mt-1">{item.detail}</p>
              </div>
            ))}
          </section>

          <section className="bg-white border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-surface-container flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-primary">Historial de estadias</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-outline border-b border-surface-container">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">Departamento</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">Check-in</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">Check-out</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-center">Huespedes</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right">Pago</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">Recepcion</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/50">
                  {stays.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-on-surface-variant">
                        No hay reservas registradas para este huesped.
                      </td>
                    </tr>
                  ) : (
                    stays.map((stay: Booking) => {
                      const receiptFiles = parseStoredFiles(stay.receiptFiles, stay.receiptData, stay.receiptName);
                      return (
                      <tr key={stay.id} className="zebra-stripe hover:bg-active transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-on-surface">{stay.property || '-'}</td>
                        <td className="px-6 py-4 font-mono text-xs">{formatDateDisplay(stay.checkIn)}</td>
                        <td className="px-6 py-4 font-mono text-xs">{formatDateDisplay(stay.checkOut)}</td>
                        <td className="px-6 py-4 text-center text-sm">{stay.guests}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold">
                          ${Number(stay.amountPaid || 0).toFixed(2)} de ${Number(stay.amountTotal || 0).toFixed(2)}
                          {stay.paymentMethod && (
                            <p className="text-[10px] font-normal text-on-surface-variant">{stay.paymentMethod}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant">
                          <p>{stay.receivedBy || 'Sin receptor'}</p>
                          <p>{stay.bookingSource || 'Sin canal'}</p>
                          {receiptFiles.map((file, index) => (
                            <button
                              key={`${file.name}-${index}`}
                              type="button"
                              onClick={() => openStoredFile(file.data, file.name || 'comprobante')}
                              className="block text-left font-bold text-primary hover:underline"
                            >
                              Comprobante {receiptFiles.length > 1 ? index + 1 : ''}: {file.name || 'Ver archivo'}
                            </button>
                          ))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-primary-container/10 text-primary">
                            {stay.status}
                          </span>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-surface-container flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-primary">Pagos asociados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-outline border-b border-surface-container">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">Fecha</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">Concepto</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">Departamento</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/50">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-on-surface-variant">
                        No hay pagos asociados a reservas de este huesped.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction: Transaction) => (
                      <tr key={transaction.id} className="zebra-stripe hover:bg-active transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">{formatDateDisplay(transaction.date)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-on-surface">{transaction.concept}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{transaction.property || '-'}</td>
                        <td className={cn('px-6 py-4 text-right text-sm font-bold', transaction.type === 'income' ? 'text-secondary' : 'text-error')}>
                          {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-surface-container-low text-center border-t border-surface-container">
              <button className="text-primary font-bold text-[10px] uppercase hover:underline flex items-center justify-center gap-2 mx-auto">
                <Download className="w-3.5 h-3.5" />
                Exportar historial del huesped
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
