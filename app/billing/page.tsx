'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeIndianRupee,
  CalendarDays,
  CreditCard,
  Eye,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  Phone,
  Stethoscope,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';

import { getAuthHeaders } from '@/lib/utils/tenant-client';

type Doctor = {
  _id: string;
  name: string;
  specialization?: string;
  consultationFee?: number;
};

type Patient = {
  _id: string;
  name: string;
  phone?: string;
};

type TenantDetails = {
  name?: string;
  logoUrl?: string;
  gstinNumber?: string;
  billingEmail?: string;
  primaryPhone?: string;
  address?: string;
};

type Sale = {
  _id: string;
  invoiceNumber?: string;
  saleDate?: string;
  patientName?: string;
  patientPhone?: string;
  customerName?: string;
  customerPhone?: string;
  doctorName?: string;
  doctorFee?: number;
  paymentMethod?: string;
  notes?: string;
  totalAmount?: number;
  grossAmount?: number;
  items?: Array<{ medicineName?: string; quantity?: number; price?: number; subtotal?: number }>;
  staffName?: string;
  doctorId?: Doctor | string;
};

const formatCurrency = (value: number) => `₹${Number(value || 0).toFixed(2)}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getInvoiceNumber = (sale: Sale) =>
  sale.invoiceNumber || (sale._id ? `INV-${String(sale._id).slice(-6).toUpperCase()}` : 'N/A');

const getPatientName = (sale: Sale) => sale.patientName || sale.customerName || 'N/A';
const getPatientPhone = (sale: Sale) => sale.patientPhone || sale.customerPhone || 'N/A';
const getDoctorName = (sale: Sale) => sale.doctorName || (typeof sale.doctorId === 'object' ? sale.doctorId?.name : '') || 'N/A';
const getDoctorFee = (sale: Sale) =>
  Number(sale.doctorFee ?? sale.totalAmount ?? sale.grossAmount ?? (typeof sale.doctorId === 'object' ? sale.doctorId?.consultationFee : 0) ?? 0);

export default function BillingPage() {
  const router = useRouter();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tenant, setTenant] = useState<TenantDetails | null>(null);

  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctorFee, setDoctorFee] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const [activeField, setActiveField] = useState<'patient' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState('');

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
      setError('');
      const token = localStorage.getItem('token');

      const [doctorsResponse, patientsResponse, salesResponse, tenantResponse] = await Promise.all([
        fetch('/api/doctors', { headers: getAuthHeaders(token) }),
        fetch('/api/patients', { headers: getAuthHeaders(token) }),
        fetch('/api/billing', { headers: getAuthHeaders(token) }),
        fetch('/api/tenant', { headers: getAuthHeaders(token) }),
      ]);

      if (!doctorsResponse.ok || !patientsResponse.ok || !salesResponse.ok) {
        throw new Error('Failed to load billing data');
      }

      setDoctors(await doctorsResponse.json());
      setPatients(await patientsResponse.json());
      setSales(await salesResponse.json());

      if (tenantResponse.ok) {
        const tenantData = await tenantResponse.json();
        setTenant(tenantData.tenant ?? null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setIsLoading(false);
    }
  };

  const patientSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return [...patients, ...sales.map((sale) => ({ _id: sale._id, name: getPatientName(sale), phone: sale.patientPhone }))]
      .filter((entry) => {
        const key = `${entry.name}|${entry.phone || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }, [patients, sales]);

  const filteredPatients = useMemo(() => {
    const query = patientName.trim().toLowerCase();
    if (!query) return patientSuggestions;

    return patientSuggestions.filter((patient) => {
      return patient.name.toLowerCase().includes(query) || (patient.phone || '').toLowerCase().includes(query);
    });
  }, [patientName, patientSuggestions]);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor._id === doctorId) || null, [doctorId, doctors]);

  useEffect(() => {
    if (!selectedDoctor) return;
    setDoctorFee(String(selectedDoctor.consultationFee ?? 0));
  }, [selectedDoctor]);

  const totalAmount = Number(doctorFee || 0);

  const resetForm = () => {
    setPatientName('');
    setPatientPhone('');
    setDoctorId('');
    setDoctorFee('0');
    setPaymentMethod('cash');
    setNotes('');
    setActiveField(null);
  };

  const openInvoicePreview = (sale: Sale) => {
    setSelectedSale(sale);
    setIsInvoiceModalOpen(true);
  };

  const printInvoice = (sale: Sale) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      setError('Please allow pop-ups to print the invoice.');
      return;
    }

    const clinicName = tenant?.name || 'Clinic Invoice';
    const invoiceNumber = getInvoiceNumber(sale);
    const dateLabel = sale.saleDate ? new Date(sale.saleDate).toLocaleString() : 'N/A';
    const doctorLine = getDoctorName(sale);
    const amount = getDoctorFee(sale);

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoiceNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
            .sheet { max-width: 860px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
            .header { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
            .brand { font-size: 24px; font-weight: 700; }
            .muted { color: #64748b; font-size: 13px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 20px 0; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 13px; }
            th { background: #f8fafc; }
            .summary { margin-top: 16px; display: flex; justify-content: flex-end; }
            .summary-box { min-width: 260px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
            .total { font-size: 18px; font-weight: 700; }
            @media print { body { padding: 0; } .sheet { border: 0; border-radius: 0; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <div class="brand">${escapeHtml(clinicName)}</div>
                <div class="muted">Invoice No: ${escapeHtml(invoiceNumber)}</div>
                <div class="muted">Date: ${escapeHtml(dateLabel)}</div>
              </div>
              <div class="muted" style="text-align:right;">
                <div>Doctor: ${escapeHtml(doctorLine)}</div>
                <div>Payment: ${escapeHtml(sale.paymentMethod || 'cash')}</div>
              </div>
            </div>

            <div class="grid">
              <div class="card"><strong>Patient</strong><div>${escapeHtml(getPatientName(sale))}</div><div class="muted">${escapeHtml(getPatientPhone(sale))}</div></div>
              <div class="card"><strong>Doctor Fee</strong><div>${escapeHtml(formatCurrency(amount))}</div><div class="muted">Consultation invoice</div></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>Doctor consultation - ${escapeHtml(doctorLine)}</td>
                  <td>1</td>
                  <td>${escapeHtml(formatCurrency(amount))}</td>
                  <td>${escapeHtml(formatCurrency(amount))}</td>
                </tr>
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-box">
                <div class="row"><span>Total</span><span>${escapeHtml(formatCurrency(amount))}</span></div>
                ${sale.notes ? `<div class="muted" style="margin-top:10px;">Notes: ${escapeHtml(sale.notes)}</div>` : ''}
              </div>
            </div>
          </div>
          <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSubmit = async () => {
    if (!patientName.trim()) {
      setError('Patient name is required');
      return;
    }

    if (!doctorId.trim()) {
      setError('Doctor is required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          doctorId,
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim() || undefined,
          doctorFee: Number(doctorFee || 0),
          doctorName: selectedDoctor?.name,
          paymentMethod,
          notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create invoice');
      }

      const createdSale = await response.json();
      resetForm();
      await fetchData();
      openInvoicePreview(createdSale);
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSale = async (sale: Sale) => {
    if (!window.confirm(`Delete invoice ${getInvoiceNumber(sale)}?`)) {
      return;
    }

    try {
      setDeletingSaleId(sale._id);
      setError('');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/billing/${sale._id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete invoice');
      }

      if (selectedSale?._id === sale._id) {
        setSelectedSale(null);
        setIsInvoiceModalOpen(false);
      }

      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete invoice');
    } finally {
      setDeletingSaleId('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-blue-600" />
          <p className="mt-4 text-sm font-medium text-slate-700">Loading billing module...</p>
          <p className="mt-1 text-xs text-slate-500">Please wait while we prepare your data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-slate-50/60 pb-10">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative bg-linear-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-8 sm:px-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur">
                <ReceiptText className="h-4 w-4" />
                Doctor Consultation Billing
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Billing / Invoices
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Create an invoice with the patient name, select a doctor, and fetch the consultation fee automatically from the doctor record.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:min-w-105">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
                  <Stethoscope className="h-4 w-4" />
                  Doctors
                </div>
                <p className="mt-2 text-2xl font-bold text-white">{doctors.length}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
                  <Users className="h-4 w-4" />
                  Patients
                </div>
                <p className="mt-2 text-2xl font-bold text-white">{patients.length}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
                  <BadgeIndianRupee className="h-4 w-4" />
                  Fee
                </div>
                <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
          <X className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Action required</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-slate-950">New Invoice</p>
              <p className="mt-1 text-sm text-slate-500">Select a doctor and patient, then generate the invoice instantly.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
              <Plus className="h-4 w-4" />
              Consultation
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <User className="h-4 w-4 text-slate-500" />
                Patient Name
              </label>
              <div className="relative">
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  onFocus={() => setActiveField('patient')}
                  onBlur={() => setTimeout(() => setActiveField((current) => (current === 'patient' ? null : current)), 120)}
                  placeholder="Enter patient name"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                {activeField === 'patient' && filteredPatients.length > 0 && (
                  <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                    {filteredPatients.map((patient) => (
                      <button
                        key={`${patient.name}-${patient.phone || ''}`}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setPatientName(patient.name);
                          setPatientPhone(patient.phone || '');
                          setActiveField(null);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{patient.name}</span>
                        <span className="text-xs text-slate-500">{patient.phone || 'No phone'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Phone className="h-4 w-4 text-slate-500" />
                Patient Phone
              </label>
              <input
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Stethoscope className="h-4 w-4 text-slate-500" />
                Doctor
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select a doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {doctor.name} {doctor.specialization ? `- ${doctor.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <BadgeIndianRupee className="h-4 w-4 text-slate-500" />
                Consultation Fee
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={doctorFee}
                onChange={(e) => setDoctorFee(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Auto-filled from the selected doctor. You can adjust it for this invoice if needed.
              </p>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CreditCard className="h-4 w-4 text-slate-500" />
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-800">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional invoice notes"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void handleSubmit()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Generate Invoice'}
            </button>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Invoice total: <span className="font-bold text-slate-950">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-lg font-semibold text-slate-950">Invoice Preview</p>
              <p className="mt-1 text-sm text-slate-500">Patient, doctor, and consultation fee snapshot.</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {selectedDoctor?.name || 'Waiting for input'}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Patient</p>
              <p className="mt-2 text-lg font-bold text-slate-950">{patientName || 'N/A'}</p>
              <p className="mt-1 text-sm text-slate-500">{patientPhone || 'No phone'}</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">Doctor</p>
              <p className="mt-2 text-lg font-bold text-blue-950">{selectedDoctor?.name || 'Select a doctor'}</p>
              <p className="mt-1 text-sm text-blue-700">
                {selectedDoctor?.specialization || 'Specialization will appear here'}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Fee</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">{formatCurrency(totalAmount)}</p>
              <p className="mt-1 text-sm text-emerald-700">This amount is saved on the invoice.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Invoice History</h2>
            <p className="mt-1 text-sm text-slate-500">Recent consultation invoices for the current tenant.</p>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
            <CalendarDays className="h-3.5 w-3.5" />
            {sales.length} invoices
          </span>
        </div>

        {sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Invoice</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Doctor</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Fee</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Payment</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {sales.map((sale) => (
                  <tr key={sale._id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-950">{getInvoiceNumber(sale)}</div>
                      <div className="text-xs text-slate-400">{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A'}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-950">{getPatientName(sale)}</div>
                      <div className="text-xs text-slate-400">{getPatientPhone(sale)}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-950">{getDoctorName(sale)}</div>
                      <div className="text-xs text-slate-400">Consultation bill</div>
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-emerald-700">{formatCurrency(getDoctorFee(sale))}</td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {sale.paymentMethod || 'cash'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openInvoicePreview(sale)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>

                        <button
                          onClick={() => printInvoice(sale)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          <Printer className="h-4 w-4" />
                          Print
                        </button>

                        <button
                          onClick={() => void handleDeleteSale(sale)}
                          disabled={deletingSaleId === sale._id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingSaleId === sale._id ? 'Deleting' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100">
              <ReceiptText className="h-7 w-7 text-slate-400" />
            </div>

            <div>
              <p className="font-semibold text-slate-900">No invoices yet</p>
              <p className="mt-1 text-sm text-slate-500">Create the first consultation invoice from the form above.</p>
            </div>
          </div>
        )}
      </section>

      {isInvoiceModalOpen && selectedSale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsInvoiceModalOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <ReceiptText className="h-3.5 w-3.5" />
                  Invoice Preview
                </p>
                <h3 className="mt-3 text-2xl font-bold text-slate-950">{getInvoiceNumber(selectedSale)}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedSale.saleDate ? new Date(selectedSale.saleDate).toLocaleString() : 'N/A'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => printInvoice(selectedSale)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>

                <button
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Patient</p>
                  <p className="mt-2 text-lg font-bold text-slate-950">{getPatientName(selectedSale)}</p>
                  <p className="mt-1 text-sm text-slate-500">{getPatientPhone(selectedSale)}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Doctor</p>
                  <p className="mt-2 text-lg font-bold text-slate-950">{getDoctorName(selectedSale)}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedSale.paymentMethod || 'cash'}</p>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">Doctor consultation</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{formatCurrency(getDoctorFee(selectedSale))}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">1</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">{formatCurrency(getDoctorFee(selectedSale))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  <p>Staff: {selectedSale.staffName || 'N/A'}</p>
                  {selectedSale.notes && <p className="mt-1">Notes: {selectedSale.notes}</p>}
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Total</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-950">{formatCurrency(getDoctorFee(selectedSale))}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
