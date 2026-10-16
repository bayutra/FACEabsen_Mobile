// STEP 5 — web read model + query builder for the employees section.
// Mutations (create/edit/deactivate forms) arrive with the admin flows;
// the list/detail below already prove the BFF data path end to end.

export interface EmployeeListItem {
  id: string;
  employeeNo: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  position?: string | null;
  department?: { id: string; name: string } | null;
}

export interface EmployeeListResponse {
  data: EmployeeListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface EmployeeDetail extends EmployeeListItem {
  phone?: string | null;
  supervisor?: { id: string; name: string; employeeNo: string } | null;
  user?: { id: string; email: string; isActive: boolean } | null;
  roles?: string[];
}

export interface EmployeeQuery {
  page?: number;
  pageSize?: number;
  status?: 'ACTIVE' | 'INACTIVE' | '';
  search?: string;
}

/** Serializes list filters to the BFF query string (drops empties). */
export function toEmployeeQueryString(q: EmployeeQuery): string {
  const params = new URLSearchParams();
  if (q.page && q.page > 1) params.set('page', String(q.page));
  if (q.pageSize && q.pageSize !== 20) params.set('pageSize', String(q.pageSize));
  if (q.status) params.set('status', q.status);
  if (q.search?.trim()) params.set('search', q.search.trim());
  const s = params.toString();
  return s ? `?${s}` : '';
}
