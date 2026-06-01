export function getTenantHeader() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string>;
  }

  const tenantId = window.localStorage.getItem('activeTenantId');
  const isObjectId = typeof tenantId === 'string' && /^[a-f\d]{24}$/i.test(tenantId);

  if (!tenantId || !isObjectId) {
    return {} as Record<string, string>;
  }

  return { 'x-tenant-id': tenantId };
}

export function getAuthHeaders(token: string | null) {
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    ...headers,
    ...getTenantHeader(),
  };
}
