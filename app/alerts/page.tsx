'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

interface Alert {
  _id: string;
  medicineName: string;
  alertType: 'low_stock' | 'expiry_soon' | 'expired';
  message: string;
  isResolved: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchAlerts();
  }, [router]);

  useEffect(() => {
    if (filter === 'unresolved') {
      setFilteredAlerts(alerts.filter((alert) => !alert.isResolved));
    } else {
      setFilteredAlerts(alerts);
    }
  }, [filter, alerts]);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/alerts', {
        headers: getAuthHeaders(token),
      });

      if (!response.ok) throw new Error('Failed to fetch alerts');

      const data = await response.json();
      setAlerts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/alerts?id=${alertId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) throw new Error('Failed to resolve alert');

      await fetchAlerts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getAlertTone = (alertType: string) => {
    switch (alertType) {
      case 'expired':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'expiry_soon':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'low_stock':
        return 'border-orange-200 bg-orange-50 text-orange-800';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-800';
    }
  };

  const getAlertLabel = (alertType: string) => {
    switch (alertType) {
      case 'expired':
        return 'Expired';
      case 'expiry_soon':
        return 'Expiry Soon';
      case 'low_stock':
        return 'Low Stock';
      default:
        return 'Alert';
    }
  };

  if (isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading alerts...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Alerts Center</h1>
        <p className="mt-2 text-sm text-slate-600">Review unresolved inventory issues and mark them as resolved when handled.</p>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

      <section className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          onClick={() => setFilter('unresolved')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            filter === 'unresolved'
              ? 'bg-red-600 text-white'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Unresolved ({alerts.filter((a) => !a.isResolved).length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          All ({alerts.length})
        </button>
      </section>

      {filteredAlerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {filter === 'unresolved' ? 'No unresolved alerts. Everything looks good.' : 'No alerts found.'}
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredAlerts.map((alert) => (
            <div key={alert._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getAlertTone(alert.alertType)}`}>
                    {getAlertLabel(alert.alertType)}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">{alert.medicineName}</h3>
                  <p className="mt-1 text-sm text-slate-700">{alert.message}</p>
                  <p className="mt-3 text-xs text-slate-500">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>

                {!alert.isResolved ? (
                  <button
                    onClick={() => handleResolveAlert(alert._id)}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Mark Resolved
                  </button>
                ) : (
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    Resolved
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}