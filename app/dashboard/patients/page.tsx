 'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Loader2, Plus, Phone, FileText, PencilLine, Trash2, X } from 'lucide-react';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

const emptyPatient = {
  doctorId: '',
  doctorIds: [] as string[],
  name: '',
  age: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  allergies: '',
  historySummary: '',
};

function getAssignedDoctorNames(patient: any) {
  const names = new Set<string>();

  if (Array.isArray(patient?.doctorIds)) {
    patient.doctorIds.forEach((doctor: any) => {
      if (typeof doctor === 'string') {
        if (doctor) names.add(doctor);
      } else if (doctor?.name) {
        names.add(doctor.name);
      }
    });
  }

  if (patient?.doctorId) {
    if (typeof patient.doctorId === 'string') {
      names.add(patient.doctorId);
    } else if (patient.doctorId?.name) {
      names.add(patient.doctorId.name);
    }
  }

  return Array.from(names);
}

function resolveDoctorLabels(patient: any, doctors: any[]) {
  if (Array.isArray(patient?.assignedDoctorNames) && patient.assignedDoctorNames.length > 0) {
    return patient.assignedDoctorNames;
  }

  const doctorMap = new Map(doctors.map((doctor) => [doctor._id, doctor.name]));
  return getAssignedDoctorNames(patient).map((doctorIdOrName) => doctorMap.get(doctorIdOrName) || doctorIdOrName);
}

function normalizeDoctorIds(patient: any) {
  const doctorIds = new Set<string>();

  if (patient?.doctorId) {
    if (typeof patient.doctorId === 'string') {
      doctorIds.add(patient.doctorId);
    } else if (patient.doctorId?._id) {
      doctorIds.add(patient.doctorId._id);
    }
  }

  if (Array.isArray(patient?.doctorIds)) {
    patient.doctorIds.forEach((doctor: any) => {
      if (typeof doctor === 'string') {
        if (doctor) doctorIds.add(doctor);
      } else if (doctor?._id) {
        doctorIds.add(doctor._id);
      }
    });
  }

  return Array.from(doctorIds);
}

function getAssignedDoctorCount(patient: any, doctors: any[]) {
  if (typeof patient?.assignedDoctorCount === 'number') {
    return patient.assignedDoctorCount;
  }

  return resolveDoctorLabels(patient, doctors).length;
}

export default function DashboardPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [createdPatientAccount, setCreatedPatientAccount] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [isViewingPatient, setIsViewingPatient] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  const [patientForm, setPatientForm] = useState<any>(emptyPatient);
  const [savingPatient, setSavingPatient] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState('');

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
      const [patientsRes, doctorsRes, prescriptionsRes] = await Promise.all([
        fetch('/api/patients', { headers: getAuthHeaders(token) }),
        fetch('/api/doctors', { headers: getAuthHeaders(token) }),
        fetch('/api/prescriptions', { headers: getAuthHeaders(token) }),
      ]);

      if (!patientsRes.ok || !doctorsRes.ok || !prescriptionsRes.ok) throw new Error('Failed to load data');

      setPatients(await patientsRes.json());
      setDoctors(await doctorsRes.json());
      setPrescriptions(await prescriptionsRes.json());
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPatient(true);
    setError('');
    setCreatedPatientAccount(null);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...patientForm,
        age: patientForm.age ? Number(patientForm.age) : undefined,
        doctorId: patientForm.doctorIds?.[0] || patientForm.doctorId || undefined,
        doctorIds: [
          ...(patientForm.doctorId ? [patientForm.doctorId] : []),
          ...(patientForm.doctorIds || []),
        ].filter(Boolean),
        allergies: patientForm.allergies
          ? (patientForm.allergies as string).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
      };

      const res = await fetch(editingPatientId ? `/api/patients/${editingPatientId}` : '/api/patients', {
        method: editingPatientId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create patient');

      if (data.temporaryPassword && patientForm.email) {
        setCreatedPatientAccount({
          email: patientForm.email,
          temporaryPassword: data.temporaryPassword,
        });
      }

      setPatientForm(emptyPatient);
      setEditingPatientId(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPatient(false);
    }
  };

  const handleEditPatient = (patient: any) => {
    setEditingPatientId(patient._id);
    setPatientForm({
      doctorId: patient.doctorId?._id || patient.doctorId || '',
      doctorIds: normalizeDoctorIds(patient),
      name: patient.name || '',
      age: patient.age !== undefined && patient.age !== null ? String(patient.age) : '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      allergies: Array.isArray(patient.allergies) ? patient.allergies.join(', ') : '',
      historySummary: patient.historySummary || '',
    });
    setCreatedPatientAccount(null);
    setSelectedPatient(null);
    setIsViewingPatient(false);
  };

  const handleDeletePatient = async (patient: any) => {
    if (!confirm(`Delete patient ${patient.name}?`)) {
      return;
    }

    try {
      setDeletingPatientId(patient._id);
      setError('');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/patients/${patient._id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete patient');
      }

      if (editingPatientId === patient._id) {
        setEditingPatientId(null);
        setPatientForm(emptyPatient);
      }

      if (selectedPatient?._id === patient._id) {
        setSelectedPatient(null);
        setIsViewingPatient(false);
      }

      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete patient');
    } finally {
      setDeletingPatientId('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center bg-slate-50">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading patients</p>
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
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Patients</h1>
              <p className="mt-2 text-sm text-slate-500">List of registered patients and quick registration form.</p>
            </div>

            <div>
              <button
                onClick={() => router.push('/register')}
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Patient (Register)
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handlePatientSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-900 text-white">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  {editingPatientId ? 'Edit Patient' : 'Add Patient'}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">Register patient details and medical history.</p>
              </div>
            </div>

            {createdPatientAccount && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold">Patient portal account created</p>
                <p className="mt-1">Email: {createdPatientAccount.email}</p>
                <p className="mt-1 break-all">Temporary password: {createdPatientAccount.temporaryPassword}</p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label className={labelCls}>Assign Doctors</label>
                <select
                  multiple
                  size={Math.min(Math.max(doctors.length, 3), 6)}
                  className={inputCls}
                  value={patientForm.doctorIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((option) => option.value);
                    setPatientForm({ ...patientForm, doctorIds: selected });
                  }}
                >
                  {doctors.length === 0 && <option value="">No doctors available</option>}
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} — {d.specialization}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">Hold Ctrl / Cmd to select one or more doctors.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Patient Name *</label>
                  <input className={inputCls} placeholder="Sita Devi" value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} required />
                </div>

                <div>
                  <label className={labelCls}>Age</label>
                  <input type="number" className={inputCls} placeholder="35" value={patientForm.age} onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })} />
                </div>

                <div>
                  <label className={labelCls}>Gender</label>
                  <select className={inputCls} value={patientForm.gender} onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} placeholder="+91..." value={patientForm.phone} onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })} />
                </div>

                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" className={inputCls} placeholder="patient@email.com" value={patientForm.email} onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} required />
                  <p className="mt-1 text-[11px] text-slate-400">This email will be used for the patient portal login.</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>Address</label>
                <input className={inputCls} placeholder="Address" value={patientForm.address} onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })} />
              </div>

              <div>
                <label className={labelCls}>Allergies</label>
                <input className={inputCls} placeholder="Penicillin, Aspirin" value={patientForm.allergies} onChange={(e) => setPatientForm({ ...patientForm, allergies: e.target.value })} />
              </div>

              <div>
                <label className={labelCls}>History Summary</label>
                <textarea className={inputCls} rows={3} placeholder="Past medical history" value={patientForm.historySummary} onChange={(e) => setPatientForm({ ...patientForm, historySummary: e.target.value })} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button disabled={savingPatient} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60">
                {savingPatient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {savingPatient ? 'Saving' : editingPatientId ? 'Update Patient' : 'Save Patient'}
              </button>

              {editingPatientId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPatientId(null);
                    setPatientForm(emptyPatient);
                    setCreatedPatientAccount(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-950">Registered Patients</h2>
              <p className="mt-1 text-sm text-slate-500">Patients currently in your records.</p>
            </div>

            <div className="divide-y divide-slate-100">
              {patients.length > 0 ? (
                patients.map((p) => (
                  <div key={p._id} className="group flex items-start gap-4 px-6 py-5 transition hover:bg-slate-50">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                        <User className="h-5 w-5" />
                      </div>

                      <button
                        type="button"
                        onClick={() => { setSelectedPatient(p); setIsViewingPatient(true); }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="font-bold text-slate-950">{p.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">Age {p.age ?? 'N/A'}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">{p.gender || 'N/A'}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">Doctors {getAssignedDoctorCount(p, doctors)}</span>
                          {p.phone && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                              <Phone className="h-3.5 w-3.5" />
                              {p.phone}
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-xs text-slate-400">Last visit: {p.lastVisitAt ? new Date(p.lastVisitAt).toLocaleDateString('en-IN') : 'N/A'}</p>
                      </button>

                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => handleEditPatient(p)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeletePatient(p)}
                          disabled={deletingPatientId === p._id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingPatientId === p._id ? 'Deleting' : 'Delete'}
                        </button>
                      </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500">No patients found.</div>
              )}
            </div>
          </section>
        </section>
        {isViewingPatient && selectedPatient && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div onClick={() => setIsViewingPatient(false)} className="absolute inset-0 bg-black/40" />
            <div className="relative z-50 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-lg max-h-[90vh] overflow-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{selectedPatient.name}</h3>
                  <p className="text-sm text-slate-500">Patient record and prescription history</p>
                </div>
                <button onClick={() => setIsViewingPatient(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">Contact</p>
                  <div className="mt-2 text-sm text-slate-700">Phone: {selectedPatient.phone || 'N/A'}</div>
                  <div className="mt-1 text-sm text-slate-700">Email: {selectedPatient.email || 'N/A'}</div>
                  <div className="mt-1 text-sm text-slate-700">Address: {selectedPatient.address || 'N/A'}</div>
                </div>

                <div>
                  <p className="text-sm font-semibold">Summary</p>
                  <div className="mt-2 text-sm text-slate-700">{selectedPatient.historySummary || 'No summary available.'}</div>
                  <div className="mt-3 text-sm text-slate-700">
                    Assigned doctors: {resolveDoctorLabels(selectedPatient, doctors).length > 0 ? resolveDoctorLabels(selectedPatient, doctors).join(', ') : 'None'}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-md font-semibold">Prescriptions</h4>
                <div className="mt-3 space-y-3 max-h-[60vh] overflow-auto">
                  {prescriptions.filter((pr) => (pr.patientId?._id === selectedPatient._id) || (pr.patientId === selectedPatient._id)).length > 0 ? (
                    prescriptions
                      .filter((pr) => (pr.patientId?._id === selectedPatient._id) || (pr.patientId === selectedPatient._id))
                      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
                      .map((pr) => (
                        <div key={pr._id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{pr.doctorId?.name || 'Doctor'}</div>
                              <div className="text-xs text-slate-500">{new Date(pr.issuedAt).toLocaleString('en-IN')}</div>
                            </div>
                            <div className="text-sm text-slate-500">{pr.status}</div>
                          </div>

                          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{pr.medicinesGiven || pr.rawText || 'No medicines recorded.'}</div>
                        </div>
                      ))
                  ) : (
                    <div className="text-sm text-slate-500">No prescriptions for this patient.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
