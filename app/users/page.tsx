'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'super_admin' | 'owner' | 'doctor' | 'patient';
  isVerified?: boolean;
  createdAt?: string;
}

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: 'staff' | 'admin' | 'doctor' | 'patient';
};

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [newUser, setNewUser] = useState<UserForm>({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState<UserForm>({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      router.push('/login');
      return;
    }

    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      if (!['admin', 'owner', 'super_admin'].includes(parsedUser.role)) {
        router.push('/dashboard');
        return;
      }

      fetchUsers(token);
    }

    setIsLoading(false);
  }, [router]);

  const fetchUsers = async (token: string | null) => {
    try {
      setIsFetchingUsers(true);

      const response = await fetch('/api/users', {
        headers: getAuthHeaders(token),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsRegistering(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(localStorage.getItem('token')),
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register user');
      }

      await fetchUsers(localStorage.getItem('token'));

      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'staff',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const openEditUser = (item: User) => {
    setEditingUser(item);
    setEditUserForm({
      name: item.name,
      email: item.email,
      password: '',
      role: item.role === 'super_admin' ? 'admin' : (item.role as UserForm['role']),
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSavingUser(true);
    setError('');

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(localStorage.getItem('token')),
        },
        body: JSON.stringify({
          name: editUserForm.name,
          email: editUserForm.email,
          role: editUserForm.role,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      await fetchUsers(localStorage.getItem('token'));
      setEditingUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    setError('');

    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(localStorage.getItem('token')),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      await fetchUsers(localStorage.getItem('token'));
      setUserToDelete(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  if (isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading user settings...</div>;
  }

  if (!['admin', 'owner', 'super_admin'].includes(user?.role)) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-red-700">Access denied. Admin only.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">User Management</h1>
        <p className="mt-2 text-sm text-slate-600">Create and manage staff, doctor, and patient accounts for this clinic.</p>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-900">Register New User</h2>

          <form onSubmit={handleRegisterUser} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="user@clinic.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserForm['role'] })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="doctor">Doctor</option>
                <option value="patient">Patient</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isRegistering ? 'Registering...' : 'Register User'}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-xl font-semibold text-slate-900">Current Users</h2>

          <div className="mt-5 space-y-3">
            {users.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                    <p className="text-sm text-slate-600">{item.email}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.isVerified ? 'Verified' : 'Not verified'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{item.role}</span>
                    <button
                      type="button"
                      onClick={() => openEditUser(item)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    {item.id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete(item)}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {!isFetchingUsers && users.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No users found.
              </p>
            )}

            {isFetchingUsers && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Loading users...
              </p>
            )}
          </div>
        </section>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900">Edit User</h3>
            <form onSubmit={handleUpdateUser} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as UserForm['role'] })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="patient">Patient</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
                >
                  {isSavingUser ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900">Delete User</h3>
            <p className="mt-3 text-sm text-slate-600">Delete {userToDelete.name}? This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}