// Shared read model for the Master Data section (facilities, departments,
// shifts). Facilities are provisioned out-of-band; admins only pick them.

export interface HospitalOption {
  id: string;
  code: string;
  name: string;
}

export interface DepartmentRow {
  id: string;
  name: string;
  createdAt: string;
  hospital?: HospitalOption | null;
}

/** Reads `/hospitals` for the picker; [] when the API is unreachable. */
export async function loadHospitals(baseUrl: string, token: string): Promise<HospitalOption[]> {
  const res = await fetch(`${baseUrl}/hospitals`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json()) as HospitalOption[];
}