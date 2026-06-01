'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Upload,
  Save,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

type TenantForm = {
  name: string;
  logoUrl: string;
  gstinNumber: string;
  billingEmail: string;
  primaryPhone: string;
  address: string;
  serviceAreas: string;
};

type StoredUser = {
  role?: string;
} | null;

let cachedUserRaw = '';
let cachedUserSnapshot: StoredUser = null;

const EMPTY_FORM: TenantForm = {
  name: '',
  logoUrl: '',
  gstinNumber: '',
  billingEmail: '',
  primaryPhone: '',
  address: '',
  serviceAreas: '',
};

function splitServiceAreas(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCloudinaryConfig() {
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  };
}

function getStoredUserSnapshot(): StoredUser {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawUser = window.localStorage.getItem('user');
  if (!rawUser) {
    cachedUserRaw = '';
    cachedUserSnapshot = null;
    return null;
  }

  if (rawUser === cachedUserRaw) {
    return cachedUserSnapshot;
  }

  try {
    cachedUserRaw = rawUser;
    cachedUserSnapshot = JSON.parse(rawUser) as StoredUser;
    return cachedUserSnapshot;
  } catch {
    cachedUserRaw = '';
    cachedUserSnapshot = null;
    return null;
  }
}

function subscribeToStoredUser(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<TenantForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const storedUser = useSyncExternalStore(subscribeToStoredUser, getStoredUserSnapshot, () => null);
  const role = storedUser?.role ?? null;

  const uploadLogoToCloudinary = useCallback(async (file: File) => {
    const { cloudName } = getCloudinaryConfig();

    if (!cloudName) {
      throw new Error('Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.');
    }

    const token = localStorage.getItem('token');
    const signatureResponse = await fetch('/api/cloudinary/signature', {
      headers: getAuthHeaders(token),
    });

    const signatureData: {
      cloudName?: string;
      apiKey?: string;
      folder?: string;
      timestamp?: string;
      signature?: string;
      error?: string;
    } = await signatureResponse.json();

    if (!signatureResponse.ok) {
      throw new Error(signatureData.error || 'Failed to prepare Cloudinary upload');
    }

    if (!signatureData.apiKey || !signatureData.folder || !signatureData.timestamp || !signatureData.signature) {
      throw new Error('Cloudinary signing response is incomplete');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signatureData.apiKey);
    formData.append('folder', signatureData.folder);
    formData.append('timestamp', signatureData.timestamp);
    formData.append('signature', signatureData.signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const result: { secure_url?: string; error?: { message?: string } } = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || 'Failed to upload logo');
    }

    if (!result.secure_url) {
      throw new Error('Cloudinary did not return an image URL');
    }

    return result.secure_url;
  }, []);

  const fetchTenant = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/tenant', {
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error('Failed to load clinic details');
      }

      const data: { tenant?: { name?: string; logoUrl?: string; gstinNumber?: string; billingEmail?: string; primaryPhone?: string; address?: string; serviceAreas?: string[] } } = await response.json();
      const tenant = data.tenant ?? {};

      setForm({
        name: tenant.name ?? '',
        logoUrl: tenant.logoUrl ?? '',
        gstinNumber: tenant.gstinNumber ?? '',
        billingEmail: tenant.billingEmail ?? '',
        primaryPhone: tenant.primaryPhone ?? '',
        address: tenant.address ?? '',
        serviceAreas: Array.isArray(tenant.serviceAreas) ? tenant.serviceAreas.join(', ') : '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTenant();
  }, [fetchTenant]);

  const handleChange = (field: keyof TenantForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setUploadingLogo(true);
    setError('');
    setMessage('');

    try {
      const uploadedUrl = await uploadLogoToCloudinary(file);
      setForm((current) => ({ ...current, logoUrl: uploadedUrl }));
      setMessage('Logo uploaded successfully. Save changes to apply it to the clinic profile.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tenant', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          name: form.name,
          logoUrl: form.logoUrl,
          gstinNumber: form.gstinNumber,
          billingEmail: form.billingEmail,
          primaryPhone: form.primaryPhone,
          address: form.address,
          serviceAreas: splitServiceAreas(form.serviceAreas),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save clinic details');
      }

      setMessage(result.message || 'Clinic details saved');
      if (result.tenant) {
        setForm({
          name: result.tenant.name ?? '',
          logoUrl: result.tenant.logoUrl ?? '',
          gstinNumber: result.tenant.gstinNumber ?? '',
          billingEmail: result.tenant.billingEmail ?? '',
          primaryPhone: result.tenant.primaryPhone ?? '',
          address: result.tenant.address ?? '',
          serviceAreas: Array.isArray(result.tenant.serviceAreas)
            ? result.tenant.serviceAreas.join(', ')
            : '',
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-700">Loading clinic settings...</p>
        </div>
      </div>
    );
  }

  const isEditable = role === 'admin' || role === 'owner' || role === 'super_admin';

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.35),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.2),_transparent_30%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Edit  details.
            </h1>
         
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 backdrop-blur">
            <p className="font-medium text-white">Editable by</p>
            <p className="mt-1 text-slate-300">{isEditable ? 'Admin / Owner' : 'View only for staff'}</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Clinic details</h2>
            <p className="mt-1 text-sm text-slate-500">Keep the main identity fields current for receipts, branding, and contact info.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Clinic name</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-300 focus-within:bg-white">
                <Building2 className="h-4 w-4 text-slate-400" />
                <input
                  value={form.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                  placeholder="Enter clinic name"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Logo image</span>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 transition hover:border-blue-300 hover:bg-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      {form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.logoUrl} alt="Selected logo" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Upload a clinic logo</p>
                      
                     
                    </div>
                  </div>

                  <label className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${isEditable && !uploadingLogo ? 'cursor-pointer bg-slate-900 text-white hover:bg-slate-800' : 'cursor-not-allowed bg-slate-200 text-slate-500'}`}>
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingLogo ? 'Uploading...' : form.logoUrl ? 'Change logo' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={!isEditable || uploadingLogo}
                      className="hidden"
                    />
                  </label>
                </div>

                
              </div>
          
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">GSTIN number</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-300 focus-within:bg-white">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">GSTIN</span>
                <input
                  value={form.gstinNumber}
                  onChange={(event) => handleChange('gstinNumber', event.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                  placeholder="Enter GSTIN number"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Billing email</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-300 focus-within:bg-white">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={form.billingEmail}
                  onChange={(event) => handleChange('billingEmail', event.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                  placeholder="billing@clinic.com"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Primary phone</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-300 focus-within:bg-white">
                <Phone className="h-4 w-4 text-slate-400" />
                <input
                  value={form.primaryPhone}
                  onChange={(event) => handleChange('primaryPhone', event.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                  placeholder="+91 ..."
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Address</span>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-300 focus-within:bg-white">
                <MapPin className="mt-1 h-4 w-4 text-slate-400" />
                <textarea
                  value={form.address}
                  onChange={(event) => handleChange('address', event.target.value)}
                  disabled={!isEditable}
                  rows={3}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                  placeholder="Shop number, street, city, state"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Service areas</span>
              <textarea
                value={form.serviceAreas}
                onChange={(event) => handleChange('serviceAreas', event.target.value)}
                disabled={!isEditable}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
                placeholder="Area 1, Area 2, Area 3"
              />
            
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={fetchTenant}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!isEditable || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </div>
        </form>

        <aside className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Preview</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {form.logoUrl ? (
                      <Image
                      src={form.logoUrl}
                      alt="Clinic logo preview"
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-7 w-7 text-slate-300" />
                  )}
                </div>
                <div>
              
                  <p className="text-xl font-semibold text-slate-950">{form.name || 'Clinic name'}</p>
                  <p className="text-sm text-slate-500">{form.billingEmail || 'billing@email.com'}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-600">
                <p><span className="font-medium text-slate-900">Phone:</span> {form.primaryPhone || 'Not set'}</p>
                <p><span className="font-medium text-slate-900">Address:</span> {form.address || 'Not set'}</p>
                <p><span className="font-medium text-slate-900">Service areas:</span> {form.serviceAreas || 'Not set'}</p>
              </div>
            </div>
          </div>

          
        </aside>
      </div>
    </div>
  );
}