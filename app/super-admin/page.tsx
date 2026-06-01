'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, Plus, ShieldCheck, Edit, Trash2, Users, X, Save, AlertCircle } from 'lucide-react';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

type TenantItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  planKey: string;
  createdAt: string;
  logoUrl?: string;
  gstinNumber?: string;
  billingEmail?: string;
  primaryPhone?: string;
  address?: string;
  adminCount?: number;
};

type TenantUser = {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'doctor' | 'patient';
  isVerified: boolean;
  createdAt: string;
};

type EditUserForm = {
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'doctor' | 'patient';
};

type NewTenantForm = {
  tenantName: string;
  billingEmail: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

type EditTenantForm = {
  name: string;
  logoUrl: string;
  gstinNumber: string;
  status: 'active' | 'suspended' | 'closed';
  planKey: string;
  billingEmail: string;
  primaryPhone: string;
  address: string;
};

const emptyForm: NewTenantForm = {
  tenantName: '',
  billingEmail: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [form, setForm] = useState<NewTenantForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Edit tenant modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [editForm, setEditForm] = useState<EditTenantForm | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Manage admins modal state
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [selectedTenantForAdmins, setSelectedTenantForAdmins] = useState<TenantItem | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersMessage, setUsersMessage] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Create user form state
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'owner' | 'admin' | 'staff' | 'doctor' | 'patient',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Edit user modal state
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserForm | null>(null);
  const [isEditUserSaving, setIsEditUserSaving] = useState(false);

  // Delete user confirmation state
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<TenantUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<TenantItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser?.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }

    void loadTenants(token);
  }, [router]);

  const loadTenants = async (token: string) => {
    try {
      setError('');
      const response = await fetch('/api/tenants', {
        headers: getAuthHeaders(token),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load tenants');
      }

      setTenants(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof NewTenantForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditChange = (field: keyof EditTenantForm, value: string) => {
    if (editForm) {
      setEditForm((current) => current ? { ...current, [field]: value } : null);
    }
  };

  const openEditUserModal = (user: TenantUser) => {
    setSelectedUser(user);
    setEditUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setShowEditUserModal(true);
  };

  const handleEditUserChange = (field: keyof EditUserForm, value: string) => {
    if (editUserForm) {
      setEditUserForm((current) => (current ? { ...current, [field]: value } : null));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tenant');
      }

      setMessage(data.message || 'Tenant created successfully');
      setForm(emptyForm);
      if (token) {
        await loadTenants(token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create tenant');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (tenant: TenantItem) => {
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name,
      logoUrl: tenant.logoUrl || '',
      gstinNumber: tenant.gstinNumber || '',
      status: tenant.status as 'active' | 'suspended' | 'closed',
      planKey: tenant.planKey,
      billingEmail: tenant.billingEmail || '',
      primaryPhone: tenant.primaryPhone || '',
      address: tenant.address || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedTenant || !editForm) return;

    setIsEditSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tenants/${selectedTenant.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tenant');
      }

      setMessage('Tenant updated successfully');
      setShowEditModal(false);
      if (token) {
        await loadTenants(token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update tenant');
    } finally {
      setIsEditSaving(false);
    }
  };

  const openAdminsModal = async (tenant: TenantItem) => {
    setSelectedTenantForAdmins(tenant);
    setShowAdminsModal(true);
    setIsLoadingUsers(true);
    setUsersError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tenants/${tenant.id}/users`, {
        headers: getAuthHeaders(token),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load users');
      }

      setTenantUsers(data.users || []);
    } catch (err: any) {
      setUsersError(err.message || 'Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'owner' | 'admin' | 'staff' | 'doctor' | 'patient') => {
    if (!selectedTenantForAdmins) return;

    setUpdatingUserId(userId);
    setUsersError('');
    setUsersMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tenants/${selectedTenantForAdmins.id}/users`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user role');
      }

      setUsersMessage('User role updated successfully');
      // Update local state
      setTenantUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
      if (token) {
        await loadTenants(token);
      }
    } catch (err: any) {
      setUsersError(err.message || 'Failed to update user role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForAdmins) return;

    setIsCreatingUser(true);
    setUsersError('');
    setUsersMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tenants/${selectedTenantForAdmins.id}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify(newUserForm),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setUsersMessage('User created successfully');
      setNewUserForm({ name: '', email: '', password: '', role: 'staff' });
      setShowCreateUserForm(false);

      // Reload users list
      const usersResponse = await fetch(`/api/tenants/${selectedTenantForAdmins.id}/users`, {
        headers: getAuthHeaders(token),
      });

      const usersData = await usersResponse.json();
      if (usersResponse.ok) {
        setTenantUsers(usersData.users || []);
      }
      if (token) {
        await loadTenants(token);
      }
    } catch (err: any) {
      setUsersError(err.message || 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedTenantForAdmins || !editUserForm) return;

    setIsEditUserSaving(true);
    setUsersError('');
    setUsersMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tenants/${selectedTenantForAdmins.id}/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          name: editUserForm.name,
          email: editUserForm.email,
          role: editUserForm.role,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setUsersMessage('User updated successfully');
      setShowEditUserModal(false);
      setSelectedUser(null);
      setEditUserForm(null);

      if (token) {
        const usersResponse = await fetch(`/api/tenants/${selectedTenantForAdmins.id}/users`, {
          headers: getAuthHeaders(token),
        });

        const usersData = await usersResponse.json();
        if (usersResponse.ok) {
          setTenantUsers(usersData.users || []);
        }

        await loadTenants(token);
      }
    } catch (err: any) {
      setUsersError(err.message || 'Failed to update user');
    } finally {
      setIsEditUserSaving(false);
    }
  };

  const openDeleteUserConfirm = (user: TenantUser) => {
    setUserToDelete(user);
    setShowDeleteUserConfirm(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedTenantForAdmins || !userToDelete) return;

    setIsDeletingUser(true);
    setUsersError('');
    setUsersMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tenants/${selectedTenantForAdmins.id}/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsersMessage('User deleted successfully');
      setShowDeleteUserConfirm(false);
      setUserToDelete(null);

      if (token) {
        const usersResponse = await fetch(`/api/tenants/${selectedTenantForAdmins.id}/users`, {
          headers: getAuthHeaders(token),
        });

        const usersData = await usersResponse.json();
        if (usersResponse.ok) {
          setTenantUsers(usersData.users || []);
        }

        await loadTenants(token);
      }
    } catch (err: any) {
      setUsersError(err.message || 'Failed to delete user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const openDeleteConfirm = (tenant: TenantItem) => {
    setTenantToDelete(tenant);
    setShowDeleteConfirm(true);
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tenants/${tenantToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete tenant');
      }

      setMessage('Tenant deleted successfully');
      setShowDeleteConfirm(false);
      if (token) {
        await loadTenants(token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete tenant');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedTenants = useMemo(() => {
    return tenants.map((tenant) => ({
      ...tenant,
      createdLabel: tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A',
    }));
  }, [tenants]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Loading tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Super Admin</p>
              <h1 className="mt-1 text-3xl font-semibold">Business & Admin Control</h1>
              <p className="mt-2 text-sm text-blue-100">
                Create new businesses, assign admins, and manage cross-store access.
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Unable to continue</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <p className="font-semibold">{message}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Create Business</h2>
              <p className="text-sm text-slate-500">Assign a primary admin to the new tenant.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business Name</label>
              <input
                type="text"
                value={form.tenantName}
                onChange={(event) => handleChange('tenantName', event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                placeholder="Apollo Clinic"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Billing Email</label>
              <input
                type="email"
                value={form.billingEmail}
                onChange={(event) => handleChange('billingEmail', event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                placeholder="billing@clinic.com"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Admin Name</label>
                <input
                  type="text"
                  value={form.adminName}
                  onChange={(event) => handleChange('adminName', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="Priya Nair"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Admin Email</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => handleChange('adminEmail', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="admin@clinic.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Password</label>
              <input
                type="password"
                value={form.adminPassword}
                onChange={(event) => handleChange('adminPassword', event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                placeholder="Minimum 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" />
              {isSaving ? 'Creating...' : 'Create Business'}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
          <h2 className="text-lg font-semibold text-slate-950">Registered Businesses</h2>
          <p className="mt-1 text-sm text-slate-500">Edit, delete, or manage admins for each business.</p>

          <div className="mt-5 max-h-[70vh] overflow-y-auto overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-190 w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Clinic ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Admins</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {formattedTenants.map((tenant) => (
                  <tr key={tenant.id} className="bg-white">
                    <td className="px-4 py-3 font-medium text-slate-900">{tenant.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{tenant.id}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {typeof tenant.adminCount === 'number' ? tenant.adminCount : 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(tenant)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => openAdminsModal(tenant)}
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100"
                        >
                          <Users className="h-3 w-3" />
                          Admins
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(tenant)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {formattedTenants.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                No tenants created yet.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Edit Tenant Modal */}
      {showEditModal && selectedTenant && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Edit Business</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedTenant.name}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleEditSubmit();
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Business Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => handleEditChange('status', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Plan</label>
                  <input
                    type="text"
                    value={editForm.planKey}
                    onChange={(e) => handleEditChange('planKey', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Billing Email</label>
                <input
                  type="email"
                  value={editForm.billingEmail}
                  onChange={(e) => handleEditChange('billingEmail', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                  <input
                    type="tel"
                    value={editForm.primaryPhone}
                    onChange={(e) => handleEditChange('primaryPhone', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">GSTIN</label>
                  <input
                    type="text"
                    value={editForm.gstinNumber}
                    onChange={(e) => handleEditChange('gstinNumber', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => handleEditChange('address', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSaving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  {isEditSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Admins Modal */}
      {showAdminsModal && selectedTenantForAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Manage Admins & Users</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedTenantForAdmins.name}</p>
                <p className="mt-1 text-xs text-slate-500">Clinic ID: {selectedTenantForAdmins.id}</p>
              </div>
              <button
                onClick={() => setShowAdminsModal(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            {usersError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                <p className="text-sm">{usersError}</p>
              </div>
            )}

            {usersMessage && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <p className="text-sm">{usersMessage}</p>
              </div>
            )}

            {/* Create User Form */}
            {!showCreateUserForm ? (
              <button
                onClick={() => setShowCreateUserForm(true)}
                className="mb-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create New User
              </button>
            ) : (
              <form onSubmit={handleCreateUser} className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Create New User</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateUserForm(false)}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                    <input
                      type="text"
                      value={newUserForm.name}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                    <input
                      type="email"
                      value={newUserForm.email}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                    <input
                      type="password"
                      value={newUserForm.password}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                    <select
                      value={newUserForm.role}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({
                          ...prev,
                          role: e.target.value as 'owner' | 'admin' | 'staff' | 'doctor' | 'patient',
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                      <option value="doctor">Doctor</option>
                      <option value="patient">Patient</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateUserForm(false)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreatingUser ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            )}

            {isLoadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {tenantUsers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No users found for this business.
                  </div>
                ) : (
                  tenantUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-600">{user.email}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Clinic ID: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{user.tenantId || selectedTenantForAdmins.id}</code>
                        </p>
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {user.role}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            void handleUpdateUserRole(
                              user.id,
                              e.target.value as 'owner' | 'admin' | 'staff' | 'doctor' | 'patient'
                            )
                          }
                          disabled={updatingUserId === user.id}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:bg-slate-200"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                          <option value="doctor">Doctor</option>
                          <option value="patient">Patient</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openEditUserModal(user)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteUserConfirm(user)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && selectedUser && editUserForm && selectedTenantForAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Edit User</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedTenantForAdmins.name}</p>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={editUserForm.name}
                  onChange={(e) => handleEditUserChange('name', e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => handleEditUserChange('email', e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={editUserForm.role}
                  onChange={(e) => handleEditUserChange('role', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="doctor">Doctor</option>
                  <option value="patient">Patient</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditUserSaving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  {isEditUserSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteUserConfirm && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-950">Delete User?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This will permanently delete {userToDelete.name} from {selectedTenantForAdmins?.name}.
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteUserConfirm(false)}
                disabled={isDeletingUser}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteUser()}
                disabled={isDeletingUser}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingUser ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && tenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-950">Delete Business?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This will permanently delete "{tenantToDelete.name}" and all associated users.
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteTenant()}
                disabled={isDeleting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
