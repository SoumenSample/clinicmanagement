'use client';

import { useEffect, useState } from 'react';
import Barcode from 'react-barcode';

interface Medicine {
  _id: string;
  name: string;
  brand: string;
  batchNumber: string;
  barcode?: string | null;
  quantity: number;
  mrp?: number;
  price?: number;
  expiryDate: string;
  dosage: string;
  category: string;
  shelfLabel?: string;
  minimumStock: number;
}

interface MedicineListProps {
  medicines: Medicine[];
  onEdit: (medicine: Medicine) => void;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function MedicineList({
  medicines,
  onEdit,
  onDelete,
  isLoading = false,
}: MedicineListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // close any open action menu when clicking outside
    const onDocClick = () => {};
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this medicine?')) {
      setDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handlePrintBarcode = (medicine: Medicine) => {
    if (!medicine.barcode) {
      alert('Add a barcode before printing this medicine label.');
      return;
    }

    openPrintWindow([medicine]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => ({ ...s, [id]: !s[id] }));
  };

  const selectAll = (checked: boolean) => {
    if (checked) {
      const all: Record<string, boolean> = {};
      medicines.forEach((m) => (all[m._id] = true));
      setSelectedIds(all);
    } else {
      setSelectedIds({});
    }
  };

  const getSelectedMedicines = () => medicines.filter((m) => selectedIds[m._id]);

  const openPrintWindow = (items: Medicine[]) => {
    if (!items || items.length === 0) return;

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      alert('Popup blocked. Allow popups to print labels.');
      return;
    }

    const escapeHtml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const labelsHtml = `
      <div class="labels-grid">
        ${items
          .map((m, idx) => {
            const id = `barcode-svg-${idx}`;
            return `
            <div class="label" data-index="${idx}">
              <div class="label-meta">${escapeHtml(m.name)}</div>
              <div class="label-brand">${escapeHtml(m.brand)}</div>
              <div class="label-barcode"><svg id="${id}" class="barcode-svg"></svg></div>
              <div class="label-code">${escapeHtml(m.barcode || '')}</div>
            </div>`;
          })
          .join('\n')}
      </div>`;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print barcodes</title>
          <style>
            @page { size: A4; margin: 5mm; }
            body{font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial; margin:0; padding:6mm}
            .labels-grid{display:flex; flex-wrap:wrap; gap:6mm; align-items:flex-start}
            .label{width:70mm; height:36mm; border:1px solid #e6edf3; border-radius:6px; padding:6px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#fff}
            .label-meta{font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:2px}
            .label-brand{font-size:10px; color:#153243; margin-bottom:4px}
            .label-barcode{width:100%; display:flex; justify-content:center}
            .label-code{font-family:monospace; font-size:10px; margin-top:3px}
            @media print{ body{padding:0} .label{page-break-inside:avoid} }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          ${labelsHtml}
          <script>
            (function(){
              const codes = ${JSON.stringify(items.map((m) => m.barcode))};
              codes.forEach((code, i) => {
                const id = 'barcode-svg-' + i;
                const svg = document.getElementById(id);
                if(svg && code){
                  JsBarcode(svg, code, {format: 'CODE128', displayValue: false, width: 1, height: 28, margin:0});
                }
              });
              // small delay to ensure barcode renders
              setTimeout(()=>{ window.print(); }, 250);
            })();
          </script>
        </body>
      </html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const isExpired = (expiryDate: string) => new Date(expiryDate) < new Date();
  const isExpiringSoon = (expiryDate: string) => {
    const date = new Date(expiryDate);
    const thirtyDaysLater = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
    return date < thirtyDaysLater && date > new Date();
  };
  const isLowStock = (quantity: number, minimumStock: number) => quantity < minimumStock;

  if (medicines.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No medicines found</div>;
  }

  return (
    <>
    <div className="mb-4 flex items-center justify-end gap-3">
      {Object.values(selectedIds).some(Boolean) ? (
        <button
          onClick={() => openPrintWindow(getSelectedMedicines())}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Print selected ({Object.values(selectedIds).filter(Boolean).length})
        </button>
      ) : null}
    </div>

    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm print:hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <input
                type="checkbox"
                checked={medicines.length > 0 && medicines.every((m) => selectedIds[m._id])}
                onChange={(e) => selectAll(e.target.checked)}
                className="h-4 w-4"
              />
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Brand</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Batch</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Barcode</th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
            <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">MRP</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Dosage</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Shelf</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expiry</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {medicines.map((medicine) => (
            <tr key={medicine._id} className="hover:bg-slate-50/80">
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={!!selectedIds[medicine._id]}
                  onChange={() => toggleSelect(medicine._id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4"
                />
              </td>
              <td className="px-3 py-3 text-sm font-medium text-slate-900">{medicine.name}</td>
              <td className="px-3 py-3 text-sm text-slate-800">{medicine.brand}</td>
              <td className="px-3 py-3 text-sm text-slate-600">{medicine.batchNumber}</td>
              <td className="px-3 py-3 text-sm text-slate-600">
                {medicine.barcode ? (
                  <div className="inline-flex max-w-55 overflow-hidden rounded-lg border border-slate-200 bg-white px-2 py-1">
                    <Barcode
                      value={medicine.barcode}
                      format="CODE128"
                      width={1.2}
                      height={32}
                      margin={0}
                      displayValue={false}
                      background="#ffffff"
                      lineColor="#111827"
                    />
                  </div>
                ) : (
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    No barcode
                  </span>
                )}
              </td>
              <td
                className={`px-3 py-3 text-center text-sm font-semibold ${
                  isLowStock(medicine.quantity, medicine.minimumStock)
                    ? 'text-amber-700'
                    : 'text-slate-800'
                }`}
              >
                {medicine.quantity}
              </td>
              <td className="px-3 py-3 text-right text-sm text-slate-800">
                ₹{Number(medicine.mrp ?? medicine.price ?? 0).toFixed(2)}
              </td>
              <td className="px-3 py-3 text-sm text-slate-800">{medicine.dosage}</td>
              <td className="px-3 py-3 text-sm text-slate-800">{medicine.category}</td>
              <td className="px-3 py-3 text-sm text-slate-700">{medicine.shelfLabel || 'Unassigned'}</td>
              <td className="px-3 py-3 text-sm text-slate-600">
                {new Date(medicine.expiryDate).toLocaleDateString()}
              </td>
              <td className="px-3 py-3">
                {isExpired(medicine.expiryDate) && (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                    Expired
                  </span>
                )}
                {isExpiringSoon(medicine.expiryDate) && (
                  <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
                    Expiring Soon
                  </span>
                )}
                {isLowStock(medicine.quantity, medicine.minimumStock) && (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                    Low Stock
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(medicine)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintBarcode(medicine)}
                    disabled={!medicine.barcode}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleDelete(medicine._id);
                    }}
                    disabled={deletingId === medicine._id}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === medicine._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* old in-page print block removed - printing handled via popup for selected items */}
    </>
  );
}
