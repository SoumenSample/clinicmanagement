 'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2, CalendarDays, FileText, UploadCloud, Plus, Search, Pill, BadgeCheck, Trash2, X } from 'lucide-react';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

const statusConfig: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Draft', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  reviewed: { label: 'Reviewed', chip: 'border-blue-200 bg-blue-50 text-blue-700' },
  linked: { label: 'Linked', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  closed: { label: 'Closed', chip: 'border-slate-200 bg-slate-100 text-slate-600' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft;
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${cfg.chip}`}>{cfg.label}</span>;
}

const emptyManual = {
  doctorId: '',
  patientId: '',
  medicinesGiven: '',
  rawText: '',
  notes: '',
  issuedAt: '',
  expiryAt: '',
  source: 'walk-in',
};

export default function DashboardPrescriptionsPage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [manualForm, setManualForm] = useState<any>(emptyManual);
  const [savingManual, setSavingManual] = useState(false);

  const [medicines, setMedicines] = useState<any[]>([]);
  const [prescriptionDraft, setPrescriptionDraft] = useState<any | null>(null);
  const [viewingPrescription, setViewingPrescription] = useState<any | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [medicineEntries, setMedicineEntries] = useState<Array<{ name: string; quantity: string; time: string }>>([]);
  const [newMedicineEntry, setNewMedicineEntry] = useState<{ name: string; quantity: string; time: string }>({ name: '', quantity: '', time: '' });
  const [medicineSuggestions, setMedicineSuggestions] = useState<any[]>([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [selectedMedicineIds, setSelectedMedicineIds] = useState<string[]>([]);
  const [isWritingPrescription, setIsWritingPrescription] = useState(false);
  const [savingPrescription, setSavingPrescription] = useState(false);

  const [uploadForm, setUploadForm] = useState({ doctorId: '', patientId: '', rawText: '', notes: '', file: null as File | null });
  const [savingUpload, setSavingUpload] = useState(false);

  const inputCls =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

  const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    void fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [presRes, docRes, patRes, medRes] = await Promise.all([
        fetch('/api/prescriptions', { headers: getAuthHeaders(token) }),
        fetch('/api/doctors', { headers: getAuthHeaders(token) }),
        fetch('/api/patients', { headers: getAuthHeaders(token) }),
        fetch('/api/medicines', { headers: getAuthHeaders(token) }),
      ]);

      if (!presRes.ok || !docRes.ok || !patRes.ok || !medRes.ok) throw new Error('Failed to load data');

      setPrescriptions(await presRes.json());
      setDoctors(await docRes.json());
      setPatients(await patRes.json());
      setMedicines(await medRes.json());
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingManual(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({
          doctorId: manualForm.doctorId,
          patientId: manualForm.patientId,
          medicinesGiven: manualForm.medicinesGiven,
          rawText: manualForm.rawText,
          notes: manualForm.notes,
          issuedAt: manualForm.issuedAt || undefined,
          expiryAt: manualForm.expiryAt || undefined,
          source: manualForm.source,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create prescription');

      setManualForm(emptyManual);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingManual(false);
    }
  };

  const createEmptyPrescriptionDraft = () => ({
    doctorId: '',
    patientId: '',
    prescriptionType: 'manual',
    source: 'walk-in',
    fileUrl: '',
    fileName: '',
    mimeType: '',
    previousHistory: '',
    investigationsGiven: '',
    medicinesGiven: '',
    rawText: '',
    status: 'draft',
    notes: '',
    issuedAt: new Date().toISOString().slice(0, 10),
    expiryAt: '',
  });

  const openPrescriptionWriter = () => {
    setPrescriptionDraft(createEmptyPrescriptionDraft());
    setSelectedMedicineIds([]);
    setMedicineEntries([]);
    setNewMedicineEntry({ name: '', quantity: '', time: '' });
    setIsWritingPrescription(true);
  };

  const closePrescriptionWriter = () => {
    setIsWritingPrescription(false);
    setSelectedMedicineIds([]);
    setMedicineEntries([]);
    setNewMedicineEntry({ name: '', quantity: '', time: '' });
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
    setPrescriptionDraft(null);
  };

  const viewPrescription = (presc: any) => {
    setViewingPrescription(presc);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setViewingPrescription(null);
  };

  const printPrescription = (presc: any) => {
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Prescription</title><style>body{font-family:Inter, Arial, sans-serif;padding:24px;color:#0f172a} h1{font-size:20px;margin-bottom:6px} .muted{color:#6b7280} pre{white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;background:#f8fafc;border-radius:6px;padding:12px}</style></head><body>` +
        `<h1>Prescription</h1>` +
        `<div><strong>Patient:</strong> ${presc.patientId?.name || ''}</div>` +
        `<div><strong>Doctor:</strong> ${presc.doctorId?.name || ''}</div>` +
        `<div class="muted"><strong>Date:</strong> ${new Date(presc.issuedAt).toLocaleString()}</div><hr/>` +
        (presc.medicinesGiven ? `<h3>Medicines</h3><pre>${presc.medicinesGiven}</pre>` : (presc.rawText ? `<h3>Prescription Text</h3><pre>${presc.rawText}</pre>` : '')) +
        `<hr/><div><strong>Notes:</strong> ${presc.notes || ''}</div>` +
        `</body></html>`;

      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      // Give browser a moment to render then print
      setTimeout(() => {
        try {
          w.print();
        } catch (e) {
          // ignore
        }
      }, 300);
    } catch (err) {
      // ignore
    }
  };

  const addMedicineEntry = () => {
    if (!newMedicineEntry.name.trim()) return;

    setMedicineEntries([...medicineEntries, { ...newMedicineEntry }]);
    setNewMedicineEntry({ name: '', quantity: '', time: '' });
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
  };

  const removeMedicineEntry = (index: number) => {
    setMedicineEntries(medicineEntries.filter((_, i) => i !== index));
  };

  const handleMedicineNameChange = (value: string) => {
    setNewMedicineEntry({ ...newMedicineEntry, name: value });

    if (value.trim()) {
      setMedicineSuggestions(
        medicines.filter(
          (m) => m.name.toLowerCase().includes(value.toLowerCase()) || (m.brand && m.brand.toLowerCase().includes(value.toLowerCase()))
        )
      );
      setShowMedicineSuggestions(true);
    } else {
      setMedicineSuggestions([]);
      setShowMedicineSuggestions(false);
    }
  };

  const selectMedicineSuggestion = (medicine: any) => {
    setNewMedicineEntry({ ...newMedicineEntry, name: medicine.name });
    setShowMedicineSuggestions(false);
    setMedicineSuggestions([]);
  };

  const selectedMedicines = selectedMedicineIds.map((id) => medicines.find((m) => m._id === id)).filter(Boolean) as any[];

  const handleManualPrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrescription(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const allMedicines = [
        ...medicineEntries,
        ...selectedMedicines.map((m) => ({ name: m.name, quantity: '', time: '' })),
      ].filter((m) => m.name.trim());

      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          doctorId: prescriptionDraft?.doctorId,
          patientId: prescriptionDraft?.patientId,
          previousHistory: prescriptionDraft?.previousHistory,
          investigationsGiven: prescriptionDraft?.investigationsGiven,
          medicinesGiven: allMedicines.map((e) => `${e.name}|${e.quantity}|${e.time}`).join('\n'),
          rawText: prescriptionDraft?.rawText,
          notes: prescriptionDraft?.notes,
          issuedAt: prescriptionDraft?.issuedAt || undefined,
          expiryAt: prescriptionDraft?.expiryAt || undefined,
          source: prescriptionDraft?.source,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create prescription');

      setPrescriptionDraft(createEmptyPrescriptionDraft());
      setSelectedMedicineIds([]);
      setMedicineEntries([]);
      setNewMedicineEntry({ name: '', quantity: '', time: '' });
      setIsWritingPrescription(false);

      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPrescription(false);
    }
  };

  const handleUploadPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUpload(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('doctorId', uploadForm.doctorId);
      formData.append('patientId', uploadForm.patientId);
      formData.append('rawText', uploadForm.rawText);
      formData.append('notes', uploadForm.notes);
      if (uploadForm.file) formData.append('file', uploadForm.file);

      const res = await fetch('/api/prescriptions/upload', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: formData,
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to upload prescription');

      setUploadForm({ doctorId: '', patientId: '', rawText: '', notes: '', file: null });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingUpload(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center bg-slate-50">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading prescriptions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Clinic</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Prescriptions</h1>
              <p className="mt-2 text-sm text-slate-500">Recent prescription records and creation tools.</p>
            </div>

            <div>
              <button onClick={openPrescriptionWriter} className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm">
                <Plus className="h-4 w-4" />
                New Prescription
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleManualSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-900 text-white">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">Manual Prescription</h2>
                <p className="mt-0.5 text-sm text-slate-500">Compose a structured prescription manually.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Doctor *</label>
                <select className={inputCls} value={manualForm.doctorId} onChange={(e) => setManualForm({ ...manualForm, doctorId: e.target.value })} required>
                  <option value="">Select doctor</option>
                  {doctors.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Patient *</label>
                <select className={inputCls} value={manualForm.patientId} onChange={(e) => setManualForm({ ...manualForm, patientId: e.target.value })} required>
                  <option value="">Select patient</option>
                  {patients.map((p) => (<option key={p._id} value={p._id}>{p.name}</option>))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Medicines Given</label>
              <textarea className={`${inputCls} font-mono text-xs`} rows={4} placeholder={'Aspirin|500mg|Morning\nParacetamol|250mg|Evening'} value={manualForm.medicinesGiven} onChange={(e) => setManualForm({ ...manualForm, medicinesGiven: e.target.value })} />
              <p className="mt-2 text-xs text-slate-400">Format: Name|Qty|Time, one medicine per line.</p>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Notes</label>
              <textarea className={inputCls} rows={3} value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} />
            </div>

            <div className="mt-5">
              <button disabled={savingManual} type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
                {savingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} {savingManual ? 'Saving' : 'Save Prescription'}
              </button>
            </div>
          </form>

          <div>
            <form onSubmit={handleUploadPrescription} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-900 text-white">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-950">Upload Prescription</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Attach image or PDF prescription files.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className={labelCls}>Doctor *</label>
                  <select className={inputCls} value={uploadForm.doctorId} onChange={(e) => setUploadForm({ ...uploadForm, doctorId: e.target.value })} required>
                    <option value="">Select doctor</option>
                    {doctors.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Patient *</label>
                  <select className={inputCls} value={uploadForm.patientId} onChange={(e) => setUploadForm({ ...uploadForm, patientId: e.target.value })} required>
                    <option value="">Select patient</option>
                    {patients.map((p) => (<option key={p._id} value={p._id}>{p.name}</option>))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>File</label>
                  <input type="file" accept="image/*,.pdf" className={inputCls} onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })} />
                </div>

                <div>
                  <label className={labelCls}>OCR / Extracted Text</label>
                  <textarea className={inputCls} rows={4} placeholder="Paste extracted prescription text" value={uploadForm.rawText} onChange={(e) => setUploadForm({ ...uploadForm, rawText: e.target.value })} />
                </div>

                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea className={inputCls} rows={2} placeholder="Notes" value={uploadForm.notes} onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })} />
                </div>
              </div>

              <div className="mt-5">
                <button disabled={savingUpload} className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
                  {savingUpload ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} {savingUpload ? 'Uploading' : 'Upload Prescription'}
                </button>
              </div>
            </form>

          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Recent Prescriptions</h2>
              <p className="mt-1 text-sm text-slate-500">Latest prescription records and status.</p>
            </div>

            <button onClick={() => router.push('/dashboard/prescriptions')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700">
              <Plus className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {prescriptions.length > 0 ? (
              prescriptions.map((p) => (
                <div key={p._id} className="group cursor-pointer px-6 py-5 transition hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-950">{p.patientId?.name || 'Patient'}</p>
                      <p className="mt-1 text-sm text-slate-500">{p.doctorId?.name || 'Doctor'}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <StatusBadge status={p.status} />
                        <span className="text-xs text-slate-400">{new Date(p.issuedAt).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <button onClick={() => viewPrescription(p)} className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">View</button>
                      <button onClick={() => printPrescription(p)} className="rounded-2xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">Print</button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">No prescriptions found.</div>
            )}
          </div>
        </section>
        {isWritingPrescription && prescriptionDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div onClick={closePrescriptionWriter} className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Write Prescription</h3>
                  <p className="text-sm text-slate-500">Compose a prescription with medicine suggestions.</p>
                </div>
                <button onClick={closePrescriptionWriter} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleManualPrescriptionSubmit} className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelCls}>Doctor</label>
                    <select className={inputCls} value={prescriptionDraft.doctorId} onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, doctorId: e.target.value })} required>
                      <option value="">Select doctor</option>
                      {doctors.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Patient</label>
                    <select className={inputCls} value={prescriptionDraft.patientId} onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, patientId: e.target.value })} required>
                      <option value="">Select patient</option>
                      {patients.map((p) => (<option key={p._id} value={p._id}>{p.name}</option>))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Previous History</label>
                  <textarea className={inputCls} rows={2} value={prescriptionDraft.previousHistory} onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, previousHistory: e.target.value })} />
                </div>

                <div>
                  <label className={labelCls}>Investigations</label>
                  <textarea className={inputCls} rows={2} value={prescriptionDraft.investigationsGiven} onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, investigationsGiven: e.target.value })} />
                </div>

                <div>
                  <label className={labelCls}>Medicines</label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedMedicines.map((m) => (
                        <div key={m._id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                          <span>{m.name}</span>
                          <button type="button" onClick={() => setSelectedMedicineIds(selectedMedicineIds.filter((id) => id !== m._id))} className="text-slate-400 hover:text-slate-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>

                    {medicineEntries.map((me, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1 rounded-2xl border px-3 py-2">{me.name} <span className="text-xs text-slate-400">{me.quantity} {me.time}</span></div>
                        <button type="button" onClick={() => removeMedicineEntry(idx)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}

                    <div className="grid gap-2 md:grid-cols-3">
                      <div>
                        <input value={newMedicineEntry.name} onChange={(e) => handleMedicineNameChange(e.target.value)} placeholder="Medicine name" className={inputCls} />
                        {showMedicineSuggestions && medicineSuggestions.length > 0 && (
                          <div className="mt-1 max-h-40 overflow-auto rounded-md border bg-white shadow-sm">
                            {medicineSuggestions.map((s) => (
                              <button key={s._id} type="button" onClick={() => selectMedicineSuggestion(s)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                                <Search className="h-4 w-4 text-slate-400" />
                                <div>
                                  <div className="font-medium">{s.name}</div>
                                  {s.brand && <div className="text-xs text-slate-400">{s.brand}</div>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <input value={newMedicineEntry.quantity} onChange={(e) => setNewMedicineEntry({ ...newMedicineEntry, quantity: e.target.value })} placeholder="Qty" className={inputCls} />
                      </div>

                      <div>
                        <div className="flex gap-2">
                          <input value={newMedicineEntry.time} onChange={(e) => setNewMedicineEntry({ ...newMedicineEntry, time: e.target.value })} placeholder="Time" className={inputCls} />
                          <button type="button" onClick={addMedicineEntry} className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={closePrescriptionWriter} className="rounded-2xl px-4 py-2 text-sm font-semibold">Cancel</button>
                  <button disabled={savingPrescription} type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2 text-sm font-bold text-white">
                    {savingPrescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} {savingPrescription ? 'Saving' : 'Save Prescription'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showViewModal && viewingPrescription && (
          <div className="fixed inset-0 z-60 flex items-center justify-center">
            <div onClick={closeViewModal} className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Prescription Details</h3>
                  <p className="text-sm text-slate-500">View printable prescription details.</p>
                </div>
                <button onClick={closeViewModal} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">Close</button>
              </div>

              <div className="mt-4 space-y-3">
                <div><strong>Patient:</strong> {viewingPrescription.patientId?.name}</div>
                <div><strong>Doctor:</strong> {viewingPrescription.doctorId?.name}</div>
                <div className="text-xs text-slate-400">{new Date(viewingPrescription.issuedAt).toLocaleString()}</div>

                {viewingPrescription.medicinesGiven ? (
                  <div>
                    <h4 className="mt-2 font-semibold">Medicines</h4>
                    <pre className="mt-1 rounded-md border bg-slate-50 p-3 text-sm">{viewingPrescription.medicinesGiven}</pre>
                  </div>
                ) : viewingPrescription.rawText ? (
                  <div>
                    <h4 className="mt-2 font-semibold">Prescription Text</h4>
                    <pre className="mt-1 rounded-md border bg-slate-50 p-3 text-sm">{viewingPrescription.rawText}</pre>
                  </div>
                ) : null}

                {viewingPrescription.notes && (
                  <div>
                    <h4 className="mt-2 font-semibold">Notes</h4>
                    <div className="mt-1 text-sm">{viewingPrescription.notes}</div>
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeViewModal} className="rounded-2xl px-4 py-2 text-sm font-semibold">Close</button>
                  <button onClick={() => printPrescription(viewingPrescription)} className="rounded-2xl bg-teal-600 px-4 py-2 text-sm font-bold text-white">Print</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
