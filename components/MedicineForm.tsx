'use client';

import { useEffect, useState } from 'react';

interface MedicineFormProps {
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  isLoading?: boolean;
  shelves: Array<{ _id: string; code: string; label: string; locationType: string }>;
  categories: Array<{ _id: string; name: string; gstPercentage: number }>;
}

interface MedicineFormData {
  name: string;
  brand: string;
  batchNumber: string;
  barcode: string;
  quantity: number;
  mrp: number;
  expiryDate: string;
  dosage: string;
  category: string;
  shelfId: string;
  minimumStock: number;
}

const createEmptyFormData = (): MedicineFormData => ({
  name: '',
  brand: '',
  batchNumber: '',
  barcode: '',
  quantity: 0,
  mrp: 0,
  expiryDate: '',
  dosage: '',
  category: '',
  shelfId: '',
  minimumStock: 10,
});

function normalizeShelfId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && '_id' in value) {
    return String((value as { _id: string })._id);
  }
  return '';
}

function normalizeExpiryDate(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.includes('T') ? value.slice(0, 10) : value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return '';
}

function generateBarcodeValue() {
  const timestamp = Date.now().toString().slice(-8);
  const randomPart = Math.floor(Math.random() * 9000 + 1000).toString();
  return `MED-${timestamp}-${randomPart}`;
}

export default function MedicineForm({
  onSubmit,
  initialData,
  isLoading = false,
  shelves,
  categories,
}: MedicineFormProps) {
  const [formData, setFormData] = useState<MedicineFormData>(() => {
    if (!initialData) {
      return createEmptyFormData();
    }

    return {
      ...createEmptyFormData(),
      ...initialData,
      shelfId: normalizeShelfId(initialData.shelfId),
      expiryDate: normalizeExpiryDate(initialData.expiryDate),
        mrp: Number(initialData.mrp ?? initialData.price ?? 0),
    };
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...createEmptyFormData(),
        ...initialData,
        shelfId: normalizeShelfId(initialData.shelfId),
        expiryDate: normalizeExpiryDate(initialData.expiryDate),
        barcode: initialData.barcode || '',
        mrp: Number(initialData.mrp ?? initialData.price ?? 0),
      });
    } else {
      setFormData(createEmptyFormData());
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: MedicineFormData) => ({
      ...prev,
      [name]: name === 'quantity' || name === 'mrp' || name === 'minimumStock' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await onSubmit(formData);
      if (!initialData) {
        setFormData(createEmptyFormData());
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-slate-900">
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Medicine Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., Aspirin"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Brand *</label>
          <input
            type="text"
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., Bayer"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Batch Number *</label>
          <input
            type="text"
            name="batchNumber"
            value={formData.batchNumber}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., BATCH123"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Barcode</label>
          <div className="flex gap-2">
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              placeholder="Scan or enter barcode"
            />
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, barcode: generateBarcodeValue() }))}
              className="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Generate
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Quantity *</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            min="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">MRP *</label>
          <input
            type="number"
            name="mrp"
            value={formData.mrp}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
            placeholder="MRP inclusive of GST"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Expiry Date *</label>
          <input
            type="date"
            name="expiryDate"
            value={formData.expiryDate}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Dosage *</label>
          <input
            type="text"
            name="dosage"
            value={formData.dosage}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., 500mg"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Category *</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select Category</option>
            {categories.length === 0 ? (
              <option value="" disabled>
                Add categories first
              </option>
            ) : null}
            {categories.map((category) => (
              <option key={category._id} value={category.name}>
                {category.name} - GST {category.gstPercentage.toFixed(2)}%
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Create or edit GST slabs from the Categories screen.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Shelf</label>
          <select
            name="shelfId"
            value={formData.shelfId ?? ''}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">Unassigned</option>
            {shelves.map((shelf) => (
              <option key={shelf._id} value={shelf._id}>
                {shelf.code} · {shelf.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Minimum Stock Level</label>
          <input
            type="number"
            name="minimumStock"
            value={formData.minimumStock}
            onChange={handleChange}
            min="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Saving...' : initialData ? 'Update Medicine' : 'Add Medicine'}
      </button>
    </form>
  );
}
