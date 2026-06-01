'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user?.tenantId) {
        localStorage.setItem('activeTenantId', data.user.tenantId);
      } else {
        localStorage.removeItem('activeTenantId');
      }

      if (data.user?.role === 'doctor') {
        router.push('/doctor-dashboard');
        return;
      }

      if (data.user?.role === 'patient') {
        router.push('/patient-dashboard');
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center py-8 ">
      {/* <div className="f  w-full max-w-5xl gap-6 lg:grid-cols-2"> */}
        {/* <div className="hidden rounded-2xl border border-slate-200 bg-linear-to-br from-slate-900 via-blue-900 to-cyan-900 p-8 text-white shadow-sm lg:block">
          <h1 className="text-3xl font-semibold tracking-tight">ClinicManage</h1>
          <p className="mt-3 text-blue-100">Secure and modern clinic operations platform.</p>
          <div className="mt-10 space-y-3 text-sm text-blue-100">
            <p>Track inventory with expiry awareness</p>
            <p>Process sales with customer invoices</p>
            <p>Monitor alerts and daily performance</p>
          </div>
        </div> */}

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome Back</h2>
          <p className="mt-1 text-sm text-slate-600">Sign in to continue managing your clinic.</p>

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="admin@clinic.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <Link href="/login/forgot" className="text-sm text-blue-600 hover:underline">
              Forgot password?
            </Link>
            </div>
             <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Do not have an account?{' '}
              <Link href="/register" className="font-medium text-blue-600 hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    // </div>
  );
}