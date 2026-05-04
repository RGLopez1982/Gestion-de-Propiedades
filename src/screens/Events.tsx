import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Pin,
  Lightbulb,
  Calendar,
  Trash2,
  Settings2,
  Upload,
  FileSpreadsheet,
  Pencil
} from 'lucide-react';
import { cn } from '../lib/utils';
import { createEvent, deleteEvent, EventItem, getEvents, updateEvent } from '../services/api';
import { useModal } from '../hooks/useModal';
import { Modal } from '../components/Modal';

type ImportedEvent = Pick<EventItem, 'title' | 'description' | 'date' | 'type'>;

const normalizeHeader = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const columnFromCellRef = (cellRef: string) => cellRef.replace(/[0-9]/g, '');

const columnIndex = (column: string) => {
  return column.split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
};

const readZipEntry = async (bytes: Uint8Array, entry: { offset: number; compressedSize: number; method: number }) => {
  const nameLength = bytes[entry.offset + 26] | (bytes[entry.offset + 27] << 8);
  const extraLength = bytes[entry.offset + 28] | (bytes[entry.offset + 29] << 8);
  const dataStart = entry.offset + 30 + nameLength + extraLength;
  const data = bytes.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new Error('El Excel usa una compresion no soportada.');

  const DecompressionStreamClass = (window as unknown as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DecompressionStreamClass) {
    throw new Error('Este navegador no permite leer archivos Excel comprimidos.');
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStreamClass('deflate-raw'));
  const inflated = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(inflated);
};

const readXlsxEntries = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let eocd = -1;

  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }

  if (eocd === -1) throw new Error('No se pudo leer la estructura del Excel.');

  const view = new DataView(bytes.buffer);
  const centralDirectorySize = view.getUint32(eocd + 12, true);
  const centralDirectoryOffset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, { offset: number; compressedSize: number; method: number }>();
  let pointer = centralDirectoryOffset;

  while (pointer < centralDirectoryOffset + centralDirectorySize) {
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const offset = view.getUint32(pointer + 42, true);
    const name = new TextDecoder().decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));

    entries.set(name, { offset, compressedSize, method });
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  const getEntryText = async (name: string) => {
    const entry = entries.get(name);
    return entry ? readZipEntry(bytes, entry) : '';
  };

  return {
    sharedStrings: await getEntryText('xl/sharedStrings.xml'),
    sheet: await getEntryText('xl/worksheets/sheet1.xml'),
  };
};

const parseSharedStrings = (xml: string) => {
  if (!xml) return [];
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(document.getElementsByTagName('si')).map((item) =>
    Array.from(item.getElementsByTagName('t')).map((text) => text.textContent || '').join('')
  );
};

const excelSerialToDateText = (value: string) => {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 20000 || serial > 60000) return value;

  const date = new Date(Date.UTC(1899, 11, 30 + serial));
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const parseConcreteDate = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();

  const dayFirstMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const yearFirstMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yearFirstMatch) {
    const [, year, month, day] = yearFirstMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  return null;
};

const sortEvents = (items: EventItem[]) => {
  return [...items].sort((a, b) => {
    const aDate = parseConcreteDate(a.date);
    const bDate = parseConcreteDate(b.date);

    if (aDate !== null && bDate !== null) return aDate - bDate;
    if (aDate !== null) return -1;
    if (bDate !== null) return 1;
    return a.title.localeCompare(b.title);
  });
};

const parseEventsFromXlsx = async (file: File): Promise<ImportedEvent[]> => {
  const { sharedStrings, sheet } = await readXlsxEntries(file);
  const strings = parseSharedStrings(sharedStrings);
  const document = new DOMParser().parseFromString(sheet, 'application/xml');
  const rows = Array.from(document.getElementsByTagName('row')).map((row) => {
    const values: string[] = [];

    Array.from(row.getElementsByTagName('c')).forEach((cell) => {
      const ref = cell.getAttribute('r') || '';
      const type = cell.getAttribute('t');
      const valueNode = cell.getElementsByTagName('v')[0];
      const inlineNode = cell.getElementsByTagName('t')[0];
      const rawValue = valueNode?.textContent || inlineNode?.textContent || '';
      const value = type === 's' ? strings[Number(rawValue)] || '' : rawValue;
      values[columnIndex(columnFromCellRef(ref))] = value.trim();
    });

    return values;
  }).filter((row) => row.some(Boolean));

  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const titleIndex = headers.findIndex((header) => ['titulo', 'title', 'evento', 'nombre'].includes(header));
  const descriptionIndex = headers.findIndex((header) => ['descripcion', 'description', 'detalle'].includes(header));
  const dateIndex = headers.findIndex((header) => ['fecha', 'momento', 'temporada', 'cuando'].includes(header));
  const typeIndex = headers.findIndex((header) => ['tipo', 'type', 'categoria', 'rubro'].includes(header));

  if (titleIndex === -1) {
    throw new Error('El Excel debe tener una columna Titulo.');
  }

  return rows.slice(1).map((row) => {
    const rawDate = row[dateIndex] || '';
    return {
      title: row[titleIndex] || '',
      description: descriptionIndex >= 0 ? row[descriptionIndex] || undefined : undefined,
      date: dateIndex >= 0 ? excelSerialToDateText(rawDate) : 'Sin fecha definida',
      type: typeIndex >= 0 ? row[typeIndex] || 'General' : 'General',
    };
  }).filter((event) => event.title.trim());
};

export default function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    type: 'General'
  });
  const modal = useModal();

  const loadData = async () => {
    try {
      const eventData = await getEvents();
      setEvents(sortEvents(eventData));
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      type: 'General'
    });
    setEditingEvent(null);
  };

  const openCreateModal = () => {
    resetForm();
    modal.open();
  };

  const openEditModal = (event: EventItem) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      date: event.date || '',
      type: event.type || 'General',
    });
    modal.open();
  };

  const closeModal = () => {
    resetForm();
    modal.close();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        date: formData.date || 'Sin fecha definida',
        type: formData.type
      };

      if (editingEvent) {
        const updated = await updateEvent(editingEvent.id, payload);
        setEvents((prev) => sortEvents(prev.map((item) => item.id === updated.id ? updated : item)));
      } else {
        const created = await createEvent(payload);
        setEvents((prev) => sortEvents([created, ...prev]));
      }

      resetForm();
      modal.close();
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage('');

    try {
      const importedEvents = await parseEventsFromXlsx(file);
      if (importedEvents.length === 0) {
        setImportMessage('No se encontraron eventos para importar.');
        return;
      }

      const created = await Promise.all(importedEvents.map((item) => createEvent(item)));
      setEvents((prev) => sortEvents([...created, ...prev]));
      setImportMessage(`Se importaron ${created.length} eventos desde Excel.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'No se pudo importar el Excel.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((event) => event.id !== id));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            Agenda de Eventos
          </h1>
          <p className="text-on-surface-variant mt-1">Registra eventos, temporadas y fechas estimadas de alta demanda.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="border border-primary text-primary px-6 py-2.5 rounded-lg font-display font-semibold transition-colors hover:bg-surface-container flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <button
            onClick={openCreateModal}
            className="bg-primary text-white px-6 py-2.5 rounded-lg font-display font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Nuevo Evento
          </button>
        </div>
      </section>

      {importMessage && (
        <div className="bg-white border border-outline-variant/30 rounded-xl p-4 text-sm text-on-surface-variant shadow-sm">
          {importMessage}
        </div>
      )}

      <Modal isOpen={modal.isOpen} onClose={closeModal} title={editingEvent ? 'Editar evento' : 'Crear evento'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-1">Titulo</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-on-surface mb-1">Descripcion</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">Fecha estimada o momento</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                placeholder="Ej: Sabados, Julio, 24 al 26 de Junio"
                className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">Tipo</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option>General</option>
                <option>Deportivo</option>
                <option>Religioso</option>
                <option>Cultura y Gastronomia</option>
                <option>Exposicion</option>
                <option>Teatro/Musica</option>
                <option>Mantenimiento</option>
                <option>Precio</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-outline-variant/20">
            <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-outline-variant/30 rounded-lg text-on-surface font-bold hover:bg-surface-container transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all">
              {saving ? 'Guardando...' : editingEvent ? 'Guardar cambios' : 'Guardar evento'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-8 flex gap-6 items-start">
        <div className="p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 shrink-0">
          <Lightbulb className="w-6 h-6 fill-white/20" />
        </div>
        <div>
          <h3 className="font-display font-bold text-primary text-lg mb-2">Eventos y demanda temporal</h3>
          <p className="text-on-surface-variant leading-relaxed text-sm md:text-base max-w-3xl">
            Usa esta agenda para anticipar alta demanda, preparar campanas y recordar eventos que suelen repetirse cada temporada.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-on-surface-variant">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span>El Excel debe incluir columnas Titulo, Descripcion, Fecha y Tipo.</span>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 p-2">
          <Pin className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-primary">Eventos Registrados</h3>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white border border-outline-variant/30 rounded-xl p-8 text-center">
            <p className="text-on-surface-variant">No hay eventos registrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((event) => (
              <div key={event.id} className="bg-white border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:border-primary/40 transition-all group">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-display font-bold text-on-surface group-hover:text-primary transition-colors">{event.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-outline">
                      <span className="flex items-center gap-1.5 text-xs font-medium"><Calendar className="w-3 h-3" />{event.date || 'Sin fecha definida'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(event)}
                      className="p-2 hover:bg-surface-container rounded-lg text-outline hover:text-primary transition-colors"
                      title="Editar evento"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(event.id)} className="p-2 hover:bg-error-container rounded-lg text-outline hover:text-error transition-colors" title="Eliminar evento">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {event.description && (
                  <p className="mt-4 text-sm text-on-surface-variant leading-relaxed">{event.description}</p>
                )}

                <div className="mt-4 pt-4 border-t border-surface-container flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-outline" />
                    <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Tipo</span>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold uppercase', 'bg-primary-container/10 text-primary')}>
                    {event.type || 'General'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
