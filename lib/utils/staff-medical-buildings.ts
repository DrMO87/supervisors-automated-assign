import { supabase } from '@/lib/supabase/client';
import type { Staff } from '@/types/database.types';

export const DEFAULT_MEDICAL_BUILDINGS = ['M', 'P'];

export interface CampusBuildingOption {
  code: string;
  label: string;
  name: string;
  zone: 'Zone 1' | 'Zone 2' | 'Other';
}

export const ALL_CAMPUS_BUILDINGS: CampusBuildingOption[] = [
  { code: 'M', label: 'M (Medicine)', name: 'Faculty of Medicine', zone: 'Zone 1' },
  { code: 'P', label: 'P (Pharmacy)', name: 'Faculty of Pharmacy', zone: 'Zone 1' },
  { code: 'E', label: 'E (Engineering)', name: 'Faculty of Engineering', zone: 'Zone 1' },
  { code: 'S', label: 'S (Sciences)', name: 'Faculty of Science', zone: 'Zone 2' },
  { code: 'F', label: 'F (Fine Arts)', name: 'Faculty of Fine Arts and Design', zone: 'Zone 2' },
  { code: 'A', label: 'A (Al Alsun)', name: 'Faculty of Al Alsun and Translation', zone: 'Zone 2' },
  { code: 'B', label: 'B (Business)', name: 'Faculty of Business', zone: 'Zone 2' },
  { code: 'H', label: 'H (Hospital)', name: 'Hospital / Clinical Center', zone: 'Zone 2' },
];

/**
 * Returns allowed buildings for a staff member.
 * If not has_health_issue, returns empty array.
 * If has_health_issue, returns their configured allowed_buildings or defaults to ['M', 'P'].
 */
export function getStaffAllowedBuildings(staff: Partial<Staff>): string[] {
  if (!staff.has_health_issue) return [];
  if (staff.allowed_buildings && staff.allowed_buildings.length > 0) {
    return staff.allowed_buildings.map(b => b.trim().toUpperCase());
  }
  return [...DEFAULT_MEDICAL_BUILDINGS];
}

/**
 * Fetches the staff allowed buildings map from system_settings.
 */
export async function fetchStaffAllowedBuildingsMap(): Promise<Record<string, string[]>> {
  if (!supabase) return {};
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'staff_allowed_buildings')
      .maybeSingle();
    return (data?.setting_value as Record<string, string[]>) || {};
  } catch (err) {
    console.error('Error fetching staff_allowed_buildings:', err);
    return {};
  }
}

/**
 * Saves allowed buildings for a staff member to system_settings (and optionally updates the staff column if present).
 */
export async function saveStaffAllowedBuildings(staffId: string, buildings: string[]) {
  if (!supabase || !staffId) return;
  try {
    // 1. Update system_settings mapping
    const currentMap = await fetchStaffAllowedBuildingsMap();
    const updatedMap = {
      ...currentMap,
      [staffId]: buildings,
    };
    await supabase.from('system_settings').upsert({
      setting_key: 'staff_allowed_buildings',
      setting_value: updatedMap,
    }, { onConflict: 'setting_key' });

    // 2. Also try updating staff table column directly (in case migration 030 has been applied)
    try {
      await supabase.from('staff').update({ allowed_buildings: buildings } as any).eq('id', staffId);
    } catch {
      // Column might not exist yet; safe to ignore
    }
  } catch (err) {
    console.error('Error saving staff_allowed_buildings:', err);
  }
}

/**
 * Enriches a list of staff members with their allowed buildings from system_settings if not already present on the record.
 */
export function enrichStaffWithAllowedBuildings(
  staffList: Staff[],
  buildingsMap?: Record<string, string[]>
): Staff[] {
  if (!buildingsMap || Object.keys(buildingsMap).length === 0) {
    return staffList.map(s => {
      if (s.has_health_issue && (!s.allowed_buildings || s.allowed_buildings.length === 0)) {
        return { ...s, allowed_buildings: [...DEFAULT_MEDICAL_BUILDINGS] };
      }
      return s;
    });
  }

  return staffList.map(s => {
    const fromMap = buildingsMap[s.id];
    const allowed = (s.allowed_buildings && s.allowed_buildings.length > 0)
      ? s.allowed_buildings.map(b => b.trim().toUpperCase())
      : (fromMap && fromMap.length > 0)
      ? fromMap.map(b => b.trim().toUpperCase())
      : (s.has_health_issue ? [...DEFAULT_MEDICAL_BUILDINGS] : []);

    return {
      ...s,
      allowed_buildings: allowed,
    };
  });
}
