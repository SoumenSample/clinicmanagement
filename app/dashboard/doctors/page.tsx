'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  UploadCloud,
  User,
  Users,
  X,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

type Doctor = {
  _id: string;
  name: string;
  specialization: string;
  consultationFee?: number;
  degree?: string;
  registrationNumber?: string;
  clinicName?: string;
  clinicAddress?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

type Patient = {
  _id: string;
  doctorId?: string;
  name: string;
  age?: number;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  allergies?: string[];
  historySummary?: string;
  lastVisitAt?: string;
};

type Medicine = {
  _id: string;
  name: string;
  brand: string;
  dosage?: string;
  category?: string;
  quantity?: number;
  price?: number;
};

type Prescription = {
  _id: string;
  prescriptionType: 'image' | 'pdf' | 'manual';
  source: 'clinic' | 'walk-in' | 'upload';
  status: 'draft' | 'reviewed' | 'linked' | 'closed';
  previousHistory?: string;
  investigationsGiven?: string;
  medicinesGiven?: string;
  rawText?: string;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  notes?: string;
  expiryAt?: string;
  issuedAt: string;
  linkedSaleId?: { _id: string; invoiceNumber?: string; totalAmount?: number } | string;
  suggestedMedicines: string[];
  doctorId: Doctor;
  patientId: Patient;
};

type Analytics = {
  totalDoctors: number;
  totalPatients: number;
  totalPrescriptions: number;
  linkedPrescriptions: number;
  byStatus: Record<string, number>;
  byDoctor: Array<{ doctorId: string; doctorName: string; prescriptions: number }>;
  latest: Array<{ label: string; value: number }>;
};

type MedicineEntry = {
  name: string;
  quantity: string;
  time: string;
};

type PrescriptionFormState = {
  doctorId: string;
  patientId: string;
  prescriptionType: 'image' | 'pdf' | 'manual';
  source: 'clinic' | 'walk-in' | 'upload';
  fileUrl: string;
  fileName: string;
  mimeType: string;
  previousHistory: string;
  investigationsGiven: string;
  medicinesGiven: string;
  rawText: string;
  status: 'draft' | 'reviewed' | 'linked' | 'closed';
  notes: string;
  issuedAt: string;
  expiryAt: string;
};

const emptyDoctor = {
  name: '',
  specialization: '',
  consultationFee: '',
  degree: '',
  clinicName: '',
  clinicAddress: '',
  phone: '',
  email: '',
  registrationNumber: '',
  notes: '',
};

const emptyPatient = {
  doctorId: '',
  name: '',
  age: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  allergies: '',
  historySummary: '',
};

const createPrescriptionForm = (prescription?: Partial<Prescription>): PrescriptionFormState => ({
  doctorId: typeof prescription?.doctorId === 'string' ? prescription.doctorId : prescription?.doctorId?._id || '',
  patientId: typeof prescription?.patientId === 'string' ? prescription.patientId : prescription?.patientId?._id || '',
  prescriptionType: prescription?.prescriptionType || 'manual',
  source: prescription?.source || 'walk-in',
  fileUrl: prescription?.fileUrl || '',
  fileName: prescription?.fileName || '',
  mimeType: prescription?.mimeType || '',
  previousHistory: prescription?.previousHistory || '',
  investigationsGiven: prescription?.investigationsGiven || '',
  medicinesGiven: prescription?.medicinesGiven || '',
  rawText: prescription?.rawText || '',
  status: prescription?.status || 'draft',
  notes: prescription?.notes || '',
  issuedAt: prescription?.issuedAt ? new Date(prescription.issuedAt).toISOString().slice(0, 10) : '',
  expiryAt: prescription?.expiryAt ? new Date(prescription.expiryAt).toISOString().slice(0, 10) : '',
});

const createEmptyPrescriptionDraft = (): PrescriptionFormState => ({
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

function parseMedicineEntries(value?: string): MedicineEntry[] {
  if (!value) return [];

  return value
    .split(/\r?\n/)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());

      if (parts.length >= 3) return { name: parts[0], quantity: parts[1], time: parts[2] };
      if (parts.length === 2) return { name: parts[0], quantity: parts[1], time: '' };
      if (parts[0]) return { name: parts[0], quantity: '', time: '' };

      return null;
    })
    .filter((e): e is MedicineEntry => e !== null);
}

function formatMedicineEntries(entries: MedicineEntry[]): string {
  return entries
    .filter((e) => e.name.trim())
    .map((e) => `${e.name}|${e.quantity}|${e.time}`)
    .join('\n');
}

const statusConfig: Record<
  string,
  {
    label: string;
    chip: string;
    dot: string;
  }
> = {
  draft: {
    label: 'Draft',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  reviewed: {
    label: 'Reviewed',
    chip: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
  },
  linked: {
    label: 'Linked',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  closed: {
    label: 'Closed',
    chip: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

function PrescriptionPrintView({
  prescription,
}: {
  prescription: Prescription;
  medicines: Medicine[];
}) {
  const doctor = prescription.doctorId;
  const patient = prescription.patientId;
  const medicineEntries = parseMedicineEntries(prescription.medicinesGiven);
  const suggested = prescription.suggestedMedicines || [];

  const issuedDate = new Date(prescription.issuedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const expiryDate = prescription.expiryAt
    ? new Date(prescription.expiryAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-slate-950 px-7 py-6 text-white">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950">
              <Stethoscope className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xl font-bold tracking-tight">{doctor?.name || 'Doctor'}</p>
              <p className="mt-1 text-sm text-slate-300">
                {[doctor?.degree, doctor?.specialization].filter(Boolean).join(' · ') || 'Medical Practitioner'}
              </p>

              {doctor?.registrationNumber && (
                <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
                  Reg. No: {doctor.registrationNumber}
                </p>
              )}
            </div>
          </div>

          <div className="text-sm text-slate-300 md:text-right">
            {doctor?.clinicName && <p className="font-semibold text-white">{doctor.clinicName}</p>}

            <div className="mt-2 space-y-1">
              {doctor?.phone && (
                <p className="inline-flex items-center gap-2 md:justify-end">
                  <Phone className="h-3.5 w-3.5" />
                  {doctor.phone}
                </p>
              )}

              {doctor?.email && (
                <p className="inline-flex items-center gap-2 md:justify-end">
                  <Mail className="h-3.5 w-3.5" />
                  {doctor.email}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-7 py-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-4">
            <InfoItem label="Patient" value={patient?.name || 'N/A'} />
            <InfoItem label="Age" value={patient?.age !== undefined ? `${patient.age} yrs` : 'N/A'} />
            <InfoItem label="Gender" value={patient?.gender || 'N/A'} />
            <InfoItem label="Phone" value={patient?.phone || 'N/A'} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Issued Date</p>
            <p className="mt-1 font-semibold text-slate-900">{issuedDate}</p>
            {expiryDate && <p className="mt-1 text-xs text-slate-500">Valid until {expiryDate}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-6 px-7 py-6">
        {prescription.previousHistory && (
          <PrescriptionSection title="History">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prescription.previousHistory}</p>
          </PrescriptionSection>
        )}

        {prescription.investigationsGiven && (
          <PrescriptionSection title="Investigations">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prescription.investigationsGiven}</p>
          </PrescriptionSection>
        )}

        <PrescriptionSection
          title="Medicines Prescribed"
          icon={<Pill className="h-4 w-4" />}
        >
          {medicineEntries.length > 0 ? (
            <div className="space-y-3">
              {medicineEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-xs font-bold text-white">
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950">{entry.name}</p>

                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      {entry.quantity && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                          Qty: {entry.quantity}
                        </span>
                      )}

                      {entry.time && (
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-700">
                          Time: {entry.time}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No medicines listed.
            </p>
          )}
        </PrescriptionSection>

        {suggested.length > 0 && (
          <PrescriptionSection title="Suggested Medicines">
            <div className="flex flex-wrap gap-2">
              {suggested.map((name, i) => (
                <span
                  key={i}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  {name}
                </span>
              ))}
            </div>
          </PrescriptionSection>
        )}

        {prescription.notes && (
          <PrescriptionSection title="Clinical Notes">
            <p className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              {prescription.notes}
            </p>
          </PrescriptionSection>
        )}

        {prescription.rawText && (
          <PrescriptionSection title="Raw Prescription Text">
            <p className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-slate-500">
              {prescription.rawText}
            </p>
          </PrescriptionSection>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 px-7 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={prescription.status} />
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium capitalize text-slate-600">
            Source: {prescription.source}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium capitalize text-slate-600">
            Type: {prescription.prescriptionType}
          </span>
        </div>

        <div className="text-right">
          <div className="ml-auto mb-1 h-px w-36 bg-slate-400" />
          <p className="text-xs font-semibold text-slate-800">{doctor?.name || 'Doctor Signature'}</p>
          <p className="text-[10px] text-slate-500">{doctor?.degree || ''}</p>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{value}</p>
    </div>
  );
}

function PrescriptionSection({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      {children}
    </section>
  );
}

export default function DoctorsDashboardPage() {
  const router = useRouter();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'doctors' | 'patients' | 'prescriptions'>('doctors');

  const [doctorForm, setDoctorForm] = useState(emptyDoctor);
  const [patientForm, setPatientForm] = useState(emptyPatient as any);
  const [prescriptionDraft, setPrescriptionDraft] = useState<PrescriptionFormState>(createEmptyPrescriptionDraft());

  const [medicineEntries, setMedicineEntries] = useState<MedicineEntry[]>([]);
  const [newMedicineEntry, setNewMedicineEntry] = useState<MedicineEntry>({
    name: '',
    quantity: '',
    time: '',
  });
  const [medicineSuggestions, setMedicineSuggestions] = useState<Medicine[]>([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    doctorId: '',
    patientId: '',
    rawText: '',
    notes: '',
    file: null as File | null,
  });

  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isEditingPrescription, setIsEditingPrescription] = useState(false);
  const [editPrescriptionForm, setEditPrescriptionForm] = useState<PrescriptionFormState | null>(null);

  const [isWritingPrescription, setIsWritingPrescription] = useState(false);
  const [selectedMedicineIds, setSelectedMedicineIds] = useState<string[]>([]);

  const [savingDoctor, setSavingDoctor] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [savingPrescriptionUpdate, setSavingPrescriptionUpdate] = useState(false);
  const [createdDoctorAccount, setCreatedDoctorAccount] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const inputCls =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

  const labelCls =
    'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500';

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

      const [doctorsRes, patientsRes, medicinesRes, prescriptionsRes, analyticsRes] = await Promise.all([
        fetch('/api/doctors', {
          headers: getAuthHeaders(token),
        }),
        fetch('/api/patients', {
          headers: getAuthHeaders(token),
        }),
        fetch('/api/medicines', {
          headers: getAuthHeaders(token),
        }),
        fetch('/api/prescriptions', {
          headers: getAuthHeaders(token),
        }),
        fetch('/api/analytics/prescriptions', {
          headers: getAuthHeaders(token),
        }),
      ]);

      if (!doctorsRes.ok || !patientsRes.ok || !medicinesRes.ok || !prescriptionsRes.ok || !analyticsRes.ok) {
        throw new Error('Failed to load clinic data');
      }

      setDoctors(await doctorsRes.json());
      setPatients(await patientsRes.json());
      setMedicines(await medicinesRes.json());
      setPrescriptions(await prescriptionsRes.json());
      setAnalytics(await analyticsRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const analyticsBars = useMemo(() => {
    if (!analytics?.byDoctor?.length) return [];

    const max = Math.max(...analytics.byDoctor.map((item) => item.prescriptions), 1);

    return analytics.byDoctor.map((item) => ({
      ...item,
      width: `${Math.max(10, (item.prescriptions / max) * 100)}%`,
    }));
  }, [analytics]);

  const selectedPrescriptionDoctor = useMemo(
    () => doctors.find((d) => d._id === prescriptionDraft.doctorId) || null,
    [doctors, prescriptionDraft.doctorId]
  );

  const selectedPrescriptionPatient = useMemo(
    () => patients.find((p) => p._id === prescriptionDraft.patientId) || null,
    [patients, prescriptionDraft.patientId]
  );

  const selectedMedicines = useMemo(
    () => selectedMedicineIds.map((id) => medicines.find((m) => m._id === id)).filter(Boolean) as Medicine[],
    [medicines, selectedMedicineIds]
  );

 const handleDoctorSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSavingDoctor(true);
  setError('');
  setCreatedDoctorAccount(null);

  try {
    const token = localStorage.getItem('token');
    const payload = {
      name: doctorForm.name.trim(),
      specialization: doctorForm.specialization.trim(),
      consultationFee: doctorForm.consultationFee ? Number(doctorForm.consultationFee) : 0,
      degree: doctorForm.degree.trim() || undefined,
      clinicName: doctorForm.clinicName.trim() || undefined,
      clinicAddress: doctorForm.clinicAddress.trim() || undefined,
      phone: doctorForm.phone.trim() || undefined,
      // ✅ email is optional — send undefined if blank so no portal account is created
      email: doctorForm.email.trim() || undefined,
      registrationNumber: doctorForm.registrationNumber.trim() || undefined,
      notes: doctorForm.notes.trim() || undefined,
    };

    const res = await fetch('/api/doctors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    });

    // ✅ Fix: res.json() directly — no text() + manual parse fragility
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      throw new Error(res.statusText || 'Unexpected server response');
    }

    if (!res.ok) {
      const validationMessage = data?.issues
        ? Object.values(data.issues.fieldErrors || {})
            .flat()
            .filter(Boolean)
            .join(', ')
        : '';
      throw new Error(data.error || validationMessage || 'Failed to create doctor');
    }

    if (data.temporaryPassword && doctorForm.email.trim()) {
      setCreatedDoctorAccount({
        email: doctorForm.email.trim(),
        temporaryPassword: data.temporaryPassword,
      });
    } else {
      setCreatedDoctorAccount(null);
    }

    setDoctorForm(emptyDoctor);
    await fetchData();
  } catch (err: any) {
    setError(err.message);
  } finally {
    setSavingDoctor(false);
  }
};


  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPatient(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          ...patientForm,
          age: patientForm.age ? Number(patientForm.age) : undefined,
          allergies: patientForm.allergies
            ? (patientForm.allergies as string)
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create patient');

      setPatientForm(emptyPatient);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPatient(false);
    }
  };

  const handleManualPrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrescription(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const allMedicines = [
        ...medicineEntries,
        ...selectedMedicines.map((m) => ({
          name: m.name,
          quantity: '',
          time: '',
        })),
      ].filter((m) => m.name.trim());

      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          doctorId: prescriptionDraft.doctorId,
          patientId: prescriptionDraft.patientId,
          previousHistory: prescriptionDraft.previousHistory,
          investigationsGiven: prescriptionDraft.investigationsGiven,
          medicinesGiven: formatMedicineEntries(allMedicines),
          rawText: prescriptionDraft.rawText,
          notes: prescriptionDraft.notes,
          issuedAt: prescriptionDraft.issuedAt || undefined,
          expiryAt: prescriptionDraft.expiryAt || undefined,
          source: prescriptionDraft.source,
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
    setSavingPrescription(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const formData = new FormData();
      formData.append('doctorId', uploadForm.doctorId);
      formData.append('patientId', uploadForm.patientId);
      formData.append('rawText', uploadForm.rawText);
      formData.append('notes', uploadForm.notes);
      formData.append('source', 'upload');

      if (uploadForm.file) formData.append('file', uploadForm.file);

      const res = await fetch('/api/prescriptions/upload', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token),
        },
        body: formData,
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to upload prescription');

      setUploadForm({
        doctorId: '',
        patientId: '',
        rawText: '',
        notes: '',
        file: null,
      });

      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPrescription(false);
    }
  };

  const openPrescriptionModal = (prescription: Prescription, mode: 'view' | 'edit' = 'view') => {
    setSelectedPrescription(prescription);
    setIsPrescriptionModalOpen(true);
    setIsEditingPrescription(mode === 'edit');
    setEditPrescriptionForm(createPrescriptionForm(prescription));
  };

  const closePrescriptionModal = () => {
    setIsPrescriptionModalOpen(false);
    setSelectedPrescription(null);
    setIsEditingPrescription(false);
    setEditPrescriptionForm(null);
  };

  const openPrescriptionWriter = () => {
    setPrescriptionDraft(createEmptyPrescriptionDraft());
    setSelectedMedicineIds([]);
    setMedicineEntries([]);
    setNewMedicineEntry({
      name: '',
      quantity: '',
      time: '',
    });
    setIsWritingPrescription(true);
  };

  const closePrescriptionWriter = () => {
    setIsWritingPrescription(false);
    setSelectedMedicineIds([]);
    setMedicineEntries([]);
    setNewMedicineEntry({
      name: '',
      quantity: '',
      time: '',
    });
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
  };

  const addMedicineEntry = () => {
    if (!newMedicineEntry.name.trim()) return;

    setMedicineEntries([...medicineEntries, { ...newMedicineEntry }]);
    setNewMedicineEntry({
      name: '',
      quantity: '',
      time: '',
    });
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
  };

  const removeMedicineEntry = (index: number) => {
    setMedicineEntries(medicineEntries.filter((_, i) => i !== index));
  };

  const handleMedicineNameChange = (value: string) => {
    setNewMedicineEntry({
      ...newMedicineEntry,
      name: value,
    });

    if (value.trim()) {
      setMedicineSuggestions(
        medicines.filter(
          (m) =>
            m.name.toLowerCase().includes(value.toLowerCase()) ||
            (m.brand && m.brand.toLowerCase().includes(value.toLowerCase()))
        )
      );
      setShowMedicineSuggestions(true);
    } else {
      setMedicineSuggestions([]);
      setShowMedicineSuggestions(false);
    }
  };

  const selectMedicineSuggestion = (medicine: Medicine) => {
    setNewMedicineEntry({
      ...newMedicineEntry,
      name: medicine.name,
    });
    setShowMedicineSuggestions(false);
    setMedicineSuggestions([]);
  };

  const handlePrescriptionUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPrescription || !editPrescriptionForm) return;

    setSavingPrescriptionUpdate(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`/api/prescriptions/${selectedPrescription._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          ...editPrescriptionForm,
          issuedAt: editPrescriptionForm.issuedAt || undefined,
          expiryAt: editPrescriptionForm.expiryAt || undefined,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update prescription');

      closePrescriptionModal();
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPrescriptionUpdate(false);
    }
  };

  const handlePrescriptionDelete = async () => {
    if (!selectedPrescription || !window.confirm('Delete this prescription? This cannot be undone.')) return;

    setSavingPrescriptionUpdate(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`/api/prescriptions/${selectedPrescription._id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(token),
        },
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete prescription');

      closePrescriptionModal();
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPrescriptionUpdate(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center bg-slate-50">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading clinic dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-slate-950 px-6 py-7 text-white sm:px-8">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
            <div className="absolute -bottom-20 left-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  <Activity className="h-3.5 w-3.5" />
                  Clinic Management
                </div>

                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Doctors & Prescriptions
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Manage doctors, patients, prescriptions, and uploads from one clean workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/10 p-1.5 backdrop-blur">
                {(['doctors', 'patients', 'prescriptions'] as const).map((tab) => {
                  const Icon = tab === 'doctors' ? Stethoscope : tab === 'patients' ? Users : ClipboardList;

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold capitalize transition ${
                        activeTab === tab
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Doctors',
              value: analytics?.totalDoctors || doctors.length,
              icon: Stethoscope,
              accent: 'bg-blue-600',
            },
            {
              label: 'Patients',
              value: analytics?.totalPatients || patients.length,
              icon: Users,
              accent: 'bg-violet-600',
            },
            {
              label: 'Prescriptions',
              value: analytics?.totalPrescriptions || prescriptions.length,
              icon: ClipboardList,
              accent: 'bg-teal-600',
            },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
                </div>

                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              icon={Activity}
              title="Prescription Activity by Doctor"
              description="Prescription volume grouped by registered doctors."
            />

            <div className="mt-6 space-y-5">
              {analyticsBars.length > 0 ? (
                analyticsBars.map((item) => (
                  <div key={item.doctorId}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">{item.doctorName}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {item.prescriptions}
                      </span>
                    </div>

                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div
                        className="h-2.5 rounded-full bg-linear-to-r from-teal-600 to-emerald-500 transition-all"
                        style={{ width: item.width }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="Prescription analytics will appear once doctors start issuing prescriptions."
                />
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              icon={BadgeCheck}
              title="Status Breakdown"
              description="Current prescription workflow status."
            />

            <div className="mt-6 space-y-3">
              {Object.entries(analytics?.byStatus || {}).length > 0 ? (
                Object.entries(analytics?.byStatus || {}).map(([status, count]) => {
                  const cfg = statusConfig[status] || statusConfig.draft;

                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold capitalize text-slate-700">
                        <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                        {status}
                      </span>

                      <span className="text-sm font-bold text-slate-950">{count}</span>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={BadgeCheck}
                  title="No status data"
                  description="Status breakdown will be available after prescriptions are created."
                />
              )}
            </div>

          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
          <div className="space-y-6">
            <form
              onSubmit={handleDoctorSubmit}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <SectionTitle
                icon={Stethoscope}
                title="Add Doctor"
                description="Create a professional doctor profile."
              />

              {createdDoctorAccount && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">Doctor portal account created</p>
                  <p className="mt-1">Email: {createdDoctorAccount.email}</p>
                  <p className="mt-1 break-all">Temporary password: {createdDoctorAccount.temporaryPassword}</p>
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Name *</label>
                  <input
                    className={inputCls}
                    placeholder="Dr. Ramesh Sharma"
                    value={doctorForm.name}
                    onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Specialization *</label>
                  <input
                    className={inputCls}
                    placeholder="Cardiologist"
                    value={doctorForm.specialization}
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Consultation Fee *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    placeholder="500"
                    value={doctorForm.consultationFee}
                    onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Degree</label>
                  <input
                    className={inputCls}
                    placeholder="MBBS, MD"
                    value={doctorForm.degree}
                    onChange={(e) => setDoctorForm({ ...doctorForm, degree: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Registration Number</label>
                  <input
                    className={inputCls}
                    placeholder="MCI-123456"
                    value={doctorForm.registrationNumber}
                    onChange={(e) => setDoctorForm({ ...doctorForm, registrationNumber: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Clinic Name</label>
                  <input
                    className={inputCls}
                    placeholder="City Heart Clinic"
                    value={doctorForm.clinicName}
                    onChange={(e) => setDoctorForm({ ...doctorForm, clinicName: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Clinic Address</label>
                  <input
                    className={inputCls}
                    placeholder="123 MG Road"
                    value={doctorForm.clinicAddress}
                    onChange={(e) => setDoctorForm({ ...doctorForm, clinicAddress: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    className={inputCls}
                    placeholder="+91 98765 43210"
                    value={doctorForm.phone}
                    onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="doctor@clinic.com"
                    value={doctorForm.email}
                    onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-400">This email will be used for the doctor portal login.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea
                    className={inputCls}
                    rows={3}
                    placeholder="Additional notes"
                    value={doctorForm.notes}
                    onChange={(e) => setDoctorForm({ ...doctorForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-5">
                <button
                  disabled={savingDoctor}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingDoctor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {savingDoctor ? 'Saving' : 'Save Doctor'}
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle icon={User} title="Patient Management" description="Manage patients from their dedicated page." />

              <div className="mt-6">
                <p className="text-sm text-slate-600">Patient registration and prescription tools moved to the Patients and Prescriptions dashboards.</p>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => router.push('/dashboard/patients')} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm">Open Patients</button>
                  <button onClick={() => router.push('/dashboard/prescriptions')} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">Open Prescriptions</button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {activeTab === 'prescriptions' ? (
              <>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <SectionTitle
                      icon={Edit3}
                      title="Manual Prescription"
                      description="Compose a structured prescription."
                    />

                    <button
                      type="button"
                      onClick={openPrescriptionWriter}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700"
                    >
                      <Edit3 className="h-4 w-4" />
                      Write Prescription
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={handleUploadPrescription}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <SectionTitle
                    icon={UploadCloud}
                    title="Upload Prescription"
                    description="Attach image or PDF prescription files."
                  />

                  <div className="mt-6 space-y-4">
                    <div>
                      <label className={labelCls}>Doctor *</label>
                      <select
                        className={inputCls}
                        value={uploadForm.doctorId}
                        onChange={(e) => setUploadForm({ ...uploadForm, doctorId: e.target.value })}
                        required
                      >
                        <option value="">Select doctor</option>
                        {doctors.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Patient *</label>
                      <select
                        className={inputCls}
                        value={uploadForm.patientId}
                        onChange={(e) => setUploadForm({ ...uploadForm, patientId: e.target.value })}
                        required
                      >
                        <option value="">Select patient</option>
                        {patients.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>File</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className={inputCls}
                        onChange={(e) =>
                          setUploadForm({
                            ...uploadForm,
                            file: e.target.files?.[0] || null,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className={labelCls}>OCR / Extracted Text</label>
                      <textarea
                        className={inputCls}
                        rows={4}
                        placeholder="Paste extracted prescription text"
                        value={uploadForm.rawText}
                        onChange={(e) => setUploadForm({ ...uploadForm, rawText: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Notes</label>
                      <textarea
                        className={inputCls}
                        rows={2}
                        placeholder="Notes"
                        value={uploadForm.notes}
                        onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      disabled={savingPrescription}
                      className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
                    >
                      {savingPrescription ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      {savingPrescription ? 'Uploading' : 'Upload Prescription'}
                    </button>
                  </div>
                </form>

              </>
            ) : activeTab === 'doctors' ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-5">
                  <SectionTitle
                    icon={Stethoscope}
                    title="Registered Doctors"
                    description="Doctors currently available in your clinic records."
                  />
                </div>

                <div className="divide-y divide-slate-100">
                  {doctors.length > 0 ? (
                    doctors.map((doctor) => (
                      <div
                        key={doctor._id}
                        className="flex flex-col gap-4 px-6 py-5 transition hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                            <Stethoscope className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="font-bold text-slate-950">{doctor.name}</p>
                            <p className="mt-1 text-sm font-medium text-slate-600">{doctor.specialization}</p>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              {doctor.degree && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                                  {doctor.degree}
                                </span>
                              )}

                              {doctor.registrationNumber && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                                  Reg: {doctor.registrationNumber}
                                </span>
                              )}

                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                                Fee: ₹{Number(doctor.consultationFee || 0).toFixed(2)}
                              </span>
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-slate-500">
                              {doctor.clinicName && (
                                <p className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {doctor.clinicName}
                                </p>
                              )}

                              {doctor.phone && (
                                <p className="flex items-center gap-2">
                                  <Phone className="h-3.5 w-3.5" />
                                  {doctor.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setActiveTab('patients');
                            setPatientForm({
                              ...emptyPatient,
                              doctorId: doctor._id,
                            } as any);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Plus className="h-4 w-4" />
                          Patient
                        </button>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Stethoscope}
                      title="No doctors added"
                      description="Add your first doctor profile using the form on the left."
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-5">
                  <SectionTitle
                    icon={Users}
                    title="Registered Patients"
                    description="Patients currently available in your records."
                  />
                </div>

                <div className="divide-y divide-slate-100">
                  {patients.length > 0 ? (
                    patients.map((patient) => (
                      <div
                        key={patient._id}
                        className="flex items-start gap-4 px-6 py-5 transition hover:bg-slate-50"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                          <User className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-950">{patient.name}</p>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                              Age {patient.age ?? 'N/A'}
                            </span>

                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium capitalize">
                              {patient.gender || 'Gender N/A'}
                            </span>

                            {patient.phone && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                                <Phone className="h-3.5 w-3.5" />
                                {patient.phone}
                              </span>
                            )}
                          </div>

                          <p className="mt-3 text-xs text-slate-400">
                            Last visit:{' '}
                            {patient.lastVisitAt ? new Date(patient.lastVisitAt).toLocaleDateString('en-IN') : 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="No patients added"
                      description="Register your first patient using the form on the left."
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <SectionTitle
              icon={ClipboardList}
              title="Recent Prescriptions"
              description="Latest prescription records and status."
            />

            <button
              type="button"
              onClick={() => {
                setActiveTab('prescriptions');
                openPrescriptionWriter();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              New Prescription
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {prescriptions.length > 0 ? (
              prescriptions.map((prescription) => (
                <div
                  key={prescription._id}
                  className="group cursor-pointer px-6 py-5 transition hover:bg-slate-50"
                  role="button"
                  tabIndex={0}
                  onClick={() => openPrescriptionModal(prescription)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openPrescriptionModal(prescription);
                    }
                  }}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="font-bold text-slate-950">{prescription.patientId?.name || 'Patient'}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {prescription.doctorId?.name || 'Doctor'}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge status={prescription.status} />

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                            {prescription.source}
                          </span>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                            {prescription.prescriptionType}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <div className="mr-2 text-left text-xs text-slate-500 lg:text-right">
                        <p className="inline-flex items-center gap-1 font-semibold text-slate-700 lg:justify-end">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(prescription.issuedAt).toLocaleDateString('en-IN')}
                        </p>

                        <p className="mt-1">
                          {typeof prescription.linkedSaleId === 'string'
                            ? prescription.linkedSaleId
                            : prescription.linkedSaleId?.invoiceNumber || 'Not linked'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPrescriptionModal(prescription, 'view');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPrescriptionModal(prescription, 'edit');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 transition hover:bg-teal-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <ChevronRight className="hidden h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No prescriptions recorded"
                description="Create a new prescription to start building patient treatment history."
              />
            )}
          </div>
        </section>

        {isPrescriptionModalOpen && selectedPrescription && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-4xl bg-white shadow-2xl">
              <div className="sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-950">{selectedPrescription.patientId?.name}</h3>
                    <p className="text-xs text-slate-500">by {selectedPrescription.doctorId?.name}</p>
                  </div>

                  <StatusBadge status={selectedPrescription.status} />
                </div>

                <div className="flex items-center gap-2">
                  {!isEditingPrescription && (
                    <button
                      onClick={() => setIsEditingPrescription(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 transition hover:bg-teal-100"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}

                  <button
                    onClick={closePrescriptionModal}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    Close
                  </button>
                </div>
              </div>

              {isEditingPrescription && editPrescriptionForm ? (
                <form onSubmit={handlePrescriptionUpdate} className="space-y-5 px-6 py-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>Doctor</label>
                      <select
                        className={inputCls}
                        value={editPrescriptionForm.doctorId}
                        onChange={(e) =>
                          setEditPrescriptionForm({
                            ...editPrescriptionForm,
                            doctorId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Select doctor</option>
                        {doctors.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Patient</label>
                      <select
                        className={inputCls}
                        value={editPrescriptionForm.patientId}
                        onChange={(e) =>
                          setEditPrescriptionForm({
                            ...editPrescriptionForm,
                            patientId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Select patient</option>
                        {patients.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className={labelCls}>Type</label>
                      <select
                        className={inputCls}
                        value={editPrescriptionForm.prescriptionType}
                        onChange={(e) =>
                          setEditPrescriptionForm({
                            ...editPrescriptionForm,
                            prescriptionType: e.target.value as any,
                          })
                        }
                      >
                        <option value="manual">Manual</option>
                        <option value="image">Image</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Source</label>
                      <select
                        className={inputCls}
                        value={editPrescriptionForm.source}
                        onChange={(e) =>
                          setEditPrescriptionForm({
                            ...editPrescriptionForm,
                            source: e.target.value as any,
                          })
                        }
                      >
                        <option value="walk-in">Walk-in</option>
                        <option value="clinic">Clinic</option>
                        <option value="upload">Upload</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Status</label>
                      <select
                        className={inputCls}
                        value={editPrescriptionForm.status}
                        onChange={(e) =>
                          setEditPrescriptionForm({
                            ...editPrescriptionForm,
                            status: e.target.value as any,
                          })
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="linked">Linked</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>Issued Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={editPrescriptionForm.issuedAt}
                        onChange={(e) =>
                          setEditPrescriptionForm({
                            ...editPrescriptionForm,
                            issuedAt: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Expiry Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={editPrescriptionForm.expiryAt}
                        onChange={(e) =>
                          setEditPrescriptionForm({
                            ...editPrescriptionForm,
                            expiryAt: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Previous History</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder="Previous history"
                      value={editPrescriptionForm.previousHistory}
                      onChange={(e) =>
                        setEditPrescriptionForm({
                          ...editPrescriptionForm,
                          previousHistory: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Investigations Given</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder="Investigations"
                      value={editPrescriptionForm.investigationsGiven}
                      onChange={(e) =>
                        setEditPrescriptionForm({
                          ...editPrescriptionForm,
                          investigationsGiven: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Medicines Given</label>
                    <textarea
                      className={`${inputCls} font-mono text-xs`}
                      rows={6}
                      placeholder={'Aspirin|500mg|Morning\nParacetamol|250mg|Evening'}
                      value={editPrescriptionForm.medicinesGiven}
                      onChange={(e) =>
                        setEditPrescriptionForm({
                          ...editPrescriptionForm,
                          medicinesGiven: e.target.value,
                        })
                      }
                    />
                    <p className="mt-2 text-xs text-slate-400">Format: Name|Qty|Time, one medicine per line.</p>
                  </div>

                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder="Notes"
                      value={editPrescriptionForm.notes}
                      onChange={(e) =>
                        setEditPrescriptionForm({
                          ...editPrescriptionForm,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Raw Prescription Text</label>
                    <textarea
                      className={inputCls}
                      rows={4}
                      placeholder="Raw text"
                      value={editPrescriptionForm.rawText}
                      onChange={(e) =>
                        setEditPrescriptionForm({
                          ...editPrescriptionForm,
                          rawText: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setIsEditingPrescription(false)}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePrescriptionDelete}
                        disabled={savingPrescriptionUpdate}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>

                      <button
                        type="submit"
                        disabled={savingPrescriptionUpdate}
                        className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
                      >
                        {savingPrescriptionUpdate ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BadgeCheck className="h-4 w-4" />
                        )}
                        {savingPrescriptionUpdate ? 'Saving' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="space-y-5 px-6 py-6">
                  <PrescriptionPrintView prescription={selectedPrescription} medicines={medicines} />

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      onClick={closePrescriptionModal}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Close
                    </button>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingPrescription(true)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-100"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Prescription
                      </button>

                      <button
                        type="button"
                        onClick={handlePrescriptionDelete}
                        disabled={savingPrescriptionUpdate}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isWritingPrescription && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-4xl bg-white shadow-2xl">
              <div className="sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <SectionTitle
                  icon={Edit3}
                  title="Prescription Writer"
                  description="Create a new structured prescription."
                />

                <button
                  onClick={closePrescriptionWriter}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              </div>

              <form onSubmit={handleManualPrescriptionSubmit} className="space-y-6 px-6 py-6">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className={labelCls}>Doctor *</label>
                      <select
                        className={inputCls}
                        value={prescriptionDraft.doctorId}
                        onChange={(e) =>
                          setPrescriptionDraft({
                            ...prescriptionDraft,
                            doctorId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Select doctor</option>
                        {doctors.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Patient *</label>
                      <select
                        className={inputCls}
                        value={prescriptionDraft.patientId}
                        onChange={(e) =>
                          setPrescriptionDraft({
                            ...prescriptionDraft,
                            patientId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Select patient</option>
                        {patients.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Issue Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={prescriptionDraft.issuedAt}
                        onChange={(e) =>
                          setPrescriptionDraft({
                            ...prescriptionDraft,
                            issuedAt: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {(selectedPrescriptionDoctor || selectedPrescriptionPatient) && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {selectedPrescriptionPatient && (
                        <>
                          <Detail label="Patient" value={selectedPrescriptionPatient.name} />
                          <Detail
                            label="Age / Gender"
                            value={`${selectedPrescriptionPatient.age ?? 'N/A'} · ${
                              selectedPrescriptionPatient.gender || 'N/A'
                            }`}
                          />
                        </>
                      )}

                      {selectedPrescriptionDoctor && (
                        <>
                          <Detail label="Doctor" value={selectedPrescriptionDoctor.name} />
                          <Detail
                            label="Degree / Reg"
                            value={`${selectedPrescriptionDoctor.degree || '—'} · ${
                              selectedPrescriptionDoctor.registrationNumber || '—'
                            }`}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className={labelCls}>Previous History</label>
                    <textarea
                      className={inputCls}
                      rows={4}
                      placeholder="Past conditions, surgeries"
                      value={prescriptionDraft.previousHistory}
                      onChange={(e) =>
                        setPrescriptionDraft({
                          ...prescriptionDraft,
                          previousHistory: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Investigations Given</label>
                    <textarea
                      className={inputCls}
                      rows={4}
                      placeholder="Blood tests, X-ray, MRI"
                      value={prescriptionDraft.investigationsGiven}
                      onChange={(e) =>
                        setPrescriptionDraft({
                          ...prescriptionDraft,
                          investigationsGiven: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-teal-100 bg-teal-50 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Pill className="h-5 w-5 text-teal-700" />
                    <p className="text-sm font-bold text-teal-900">Add Medicines</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="relative">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Medicine name"
                          className={`${inputCls} pl-10`}
                          value={newMedicineEntry.name}
                          onChange={(e) => handleMedicineNameChange(e.target.value)}
                          onFocus={() => newMedicineEntry.name && setShowMedicineSuggestions(true)}
                        />
                      </div>

                      {showMedicineSuggestions && medicineSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                          {medicineSuggestions.map((m) => (
                            <button
                              key={m._id}
                              type="button"
                              onClick={() => selectMedicineSuggestion(m)}
                              className="w-full px-4 py-3 text-left text-sm transition hover:bg-teal-50"
                            >
                              <div className="font-bold text-slate-950">{m.name}</div>
                              {m.brand && (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  {m.brand}
                                  {m.dosage ? ` · ${m.dosage}` : ''}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Quantity e.g. 500mg"
                      className={inputCls}
                      value={newMedicineEntry.quantity}
                      onChange={(e) =>
                        setNewMedicineEntry({
                          ...newMedicineEntry,
                          quantity: e.target.value,
                        })
                      }
                    />

                    <input
                      type="text"
                      placeholder="Time e.g. Morning"
                      className={inputCls}
                      value={newMedicineEntry.time}
                      onChange={(e) =>
                        setNewMedicineEntry({
                          ...newMedicineEntry,
                          time: e.target.value,
                        })
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addMedicineEntry}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Medicine
                  </button>

                  {medicineEntries.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {medicineEntries.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-white px-4 py-3 shadow-sm"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-xs font-bold text-white">
                            {idx + 1}
                          </span>

                          <div className="min-w-0 flex-1 text-sm">
                            <span className="font-bold text-slate-950">{entry.name}</span>
                            {entry.quantity && <span className="ml-2 text-slate-500">{entry.quantity}</span>}
                            {entry.time && <span className="ml-2 text-slate-400">· {entry.time}</span>}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeMedicineEntry(idx)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-500 transition hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder="Additional notes"
                      value={prescriptionDraft.notes}
                      onChange={(e) =>
                        setPrescriptionDraft({
                          ...prescriptionDraft,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Full Prescription Text</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder="Optional full prescription text"
                      value={prescriptionDraft.rawText}
                      onChange={(e) =>
                        setPrescriptionDraft({
                          ...prescriptionDraft,
                          rawText: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-5 border-t border-slate-100 pt-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Source</label>
                      <select
                        className={inputCls}
                        value={prescriptionDraft.source}
                        onChange={(e) =>
                          setPrescriptionDraft({
                            ...prescriptionDraft,
                            source: e.target.value as any,
                          })
                        }
                      >
                        <option value="walk-in">Walk-in</option>
                        <option value="clinic">Clinic</option>
                        <option value="upload">Upload</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Expiry Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={prescriptionDraft.expiryAt}
                        onChange={(e) =>
                          setPrescriptionDraft({
                            ...prescriptionDraft,
                            expiryAt: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={closePrescriptionWriter}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <button
                      disabled={savingPrescription}
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
                    >
                      {savingPrescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                      {savingPrescription ? 'Saving' : 'Save Prescription'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

