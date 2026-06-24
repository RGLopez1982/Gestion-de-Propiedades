import { createProperty, updateProperty, getBnaRate, Property } from '../../services/api';
import { parseMoneyInput } from '../../lib/money';
import { normalizeTextInput } from '../../lib/text';
import React, { useState, useEffect } from 'react';

interface PropertyFormProps {
  onSuccess: (property: Property) => void;
  onCancel: () => void;
  property?: Property | null;
}

const getImageList = (property?: Property | null) => {
  if (!property) return [];
  if (Array.isArray(property.images)) return property.images;
  if (typeof property.images === 'string') {
    try {
      const parsed = JSON.parse(property.images);
      return Array.isArray(parsed) ? parsed : [property.images];
    } catch {
      return [property.images];
    }
  }
  return property.image ? [property.image] : [];
};

export function PropertyForm({ onSuccess, onCancel, property }: PropertyFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bnaRate, setBnaRate] = useState<number | null>(null);
  const initialImages = getImageList(property);
  const [formData, setFormData] = useState({
    name: property?.name || '',
    department: property?.department || property?.location || '',
    nightlyRate: String(property?.nightlyRate ?? property?.monthlyRate ?? ''),
    capacity: String(property?.capacity || 1),
    images: initialImages.filter((image) => !image.startsWith('data:')).join('\n'),
    status: property?.status || 'Disponible'
  });
  const [uploadedImages, setUploadedImages] = useState<string[]>(
    initialImages.filter((image) => image.startsWith('data:'))
  );

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const rateData = await getBnaRate();
        setBnaRate(rateData.rate);
        if (property) {
          const storedRate = property.nightlyRate ?? property.monthlyRate ?? 0;
          if (storedRate > 10000) {
            setFormData(prev => ({
              ...prev,
              nightlyRate: String(Math.round(storedRate / rateData.rate))
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching BNA rate in form:', err);
      }
    };
    fetchRate();
  }, [property]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: normalizeTextInput(name, value)
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    if (uploadedImages.length + files.length > 12) {
      setError('Podes cargar hasta 12 imagenes por propiedad.');
      e.target.value = '';
      return;
    }
    const oversized = files.find((file) => file.size > 2 * 1024 * 1024);
    if (oversized) {
      setError(`La imagen ${oversized.name} supera los 2 MB.`);
      e.target.value = '';
      return;
    }

    const readers = files.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer una imagen'));
      reader.readAsDataURL(file);
    }));

    try {
      const images = await Promise.all(readers);
      setUploadedImages((prev) => [...prev, ...images]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar imagenes');
    } finally {
      e.target.value = '';
    }
  };

  const removeUploadedImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const images = formData.images
        .split('\n')
        .map((url) => url.trim())
        .filter(Boolean)
        .concat(uploadedImages);

      const rate = bnaRate || 1;
      const nightlyRate = parseMoneyInput(formData.nightlyRate) * rate;

      const payload = {
        name: formData.name,
        location: formData.department,
        department: formData.department,
        monthlyRate: nightlyRate,
        nightlyRate: nightlyRate,
        capacity: parseInt(formData.capacity) || 1,
        image: images[0],
        images,
        status: formData.status
      };
      const savedProperty = property?.id
        ? await updateProperty(property.id, payload)
        : await createProperty(payload);
      onSuccess(savedProperty);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear propiedad');
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
          Nombre de la propiedad
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Ej: Temporario Centro"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Departamento
        </label>
        <input
          type="text"
          name="department"
          value={formData.department}
          onChange={handleChange}
          required
          placeholder="Ej: Departamento 4A"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Precio por noche (USD)
        </label>
        <input
          type="text"
          inputMode="numeric"
          name="nightlyRate"
          value={formData.nightlyRate}
          onChange={handleChange}
          required
          placeholder="e.g. 50"
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {bnaRate && formData.nightlyRate && !isNaN(Number(formData.nightlyRate)) && (
          <p className="text-xs text-on-surface-variant mt-1">
            Equivalente en Pesos: <strong>${Math.round(Number(formData.nightlyRate) * bnaRate).toLocaleString('es-AR')} ARS</strong> (Venta BNA: ${bnaRate.toFixed(2)})
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Capacidad maxima
        </label>
        <select
          name="capacity"
          value={formData.capacity}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="1">1 persona</option>
          <option value="2">2 personas</option>
          <option value="3">3 personas</option>
          <option value="4">4 personas</option>
        </select>
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
          <option value="Disponible">Disponible</option>
          <option value="Ocupado">Ocupado</option>
          <option value="Mantenimiento">Mantenimiento</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          Subir fotos desde el dispositivo
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {uploadedImages.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {uploadedImages.map((image, index) => (
              <div key={`${image.slice(0, 24)}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/30">
                <img src={image} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeUploadedImage(index)}
                  className="absolute top-1 right-1 rounded bg-black/60 px-2 py-0.5 text-xs font-bold text-white"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface mb-1">
          URLs de imagenes externas (una por linea)
        </label>
        <textarea
          name="images"
          value={formData.images}
          onChange={handleChange}
          rows={4}
          placeholder={'https://...\nhttps://...'}
          className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          {loading ? 'Guardando...' : property ? 'Guardar cambios' : 'Crear propiedad'}
        </button>
      </div>
    </form>
  );
}
