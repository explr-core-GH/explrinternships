import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Intern, Worksite } from '@/types/intern';
import { DEFAULT_WORKSITES } from '@/types/intern';
import type { Tables } from '@/integrations/supabase/types';

type DbIntern = Tables<'interns'>;
type DbWorksite = Tables<'worksites'>;

function dbToIntern(row: DbIntern): Intern {
  return {
    id: row.id,
    timestamp: row.timestamp || '',
    emailSubmission: row.email_submission || '',
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone || '',
    parentPhone: row.parent_phone || '',
    dob: row.dob || '',
    studentEmail: row.student_email || '',
    school: row.school || '',
    otherSchool: row.other_school || '',
    grade: row.grade || '',
    programs: row.programs || [],
    itInterests: row.it_interests || [],
    clevelandClinic: row.cleveland_clinic || '',
    constructionMgmt: row.construction_mgmt || '',
    biomedical: row.biomedical || '',
    envJustice: row.env_justice || '',
    envClimate: row.env_climate || '',
    envFieldScience: row.env_field_science || '',
    iersCenter: row.iers_center || '',
    magnetManufacturing: row.magnet_manufacturing || '',
    educationInternship: row.education_internship || '',
    healthcare: row.healthcare || '',
    videoGames: row.video_games || '',
    csCourseTaken: row.cs_course_taken || '',
    specificInterests: row.specific_interests || '',
    additionalQuestions: row.additional_questions || '',
    isDuplicate: row.is_duplicate || false,
    isNewest: row.is_newest ?? true,
  };
}

function dbToWorksite(row: DbWorksite): Worksite {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    capacity: row.capacity || 6,
    filled: row.filled || 0,
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    location: row.location || '',
    tags: row.tags || [],
  };
}

interface AppState {
  interns: Intern[];
  worksites: Worksite[];
  loading: boolean;
  sheetUrl: string;
  lastSynced: string | null;
  syncing: boolean;
  fetchInterns: () => Promise<void>;
  fetchWorksites: () => Promise<void>;
  addWorksite: (ws: Omit<Worksite, 'id'>) => Promise<void>;
  removeWorksite: (id: string) => Promise<void>;
  syncFromSheet: (url: string) => Promise<{ success: boolean; message: string }>;
  loadSyncConfig: () => Promise<void>;
  uploadExcelInterns: (interns: Intern[]) => Promise<void>;
}

export const useAppStore = create<AppState>()((set, get) => ({
  interns: [],
  worksites: [],
  loading: false,
  sheetUrl: '',
  lastSynced: null,
  syncing: false,

  fetchInterns: async () => {
    set({ loading: true });
    const { data } = await supabase.from('interns').select('*').order('last_name');
    set({ interns: (data || []).map(dbToIntern), loading: false });
  },

  fetchWorksites: async () => {
    const { data } = await supabase.from('worksites').select('*').order('name');
    if (data && data.length > 0) {
      set({ worksites: data.map(dbToWorksite) });
    } else {
      // Seed default worksites
      const inserts = DEFAULT_WORKSITES.map(ws => ({
        name: ws.name,
        category: ws.category,
        description: ws.description,
        capacity: ws.capacity,
        filled: ws.filled,
        contact_name: ws.contactName,
        contact_email: ws.contactEmail,
        location: ws.location,
        tags: ws.tags,
      }));
      await supabase.from('worksites').insert(inserts);
      const { data: seeded } = await supabase.from('worksites').select('*').order('name');
      set({ worksites: (seeded || []).map(dbToWorksite) });
    }
  },

  addWorksite: async (ws) => {
    const { data } = await supabase.from('worksites').insert({
      name: ws.name,
      category: ws.category,
      description: ws.description,
      capacity: ws.capacity,
      filled: ws.filled,
      contact_name: ws.contactName,
      contact_email: ws.contactEmail,
      location: ws.location,
      tags: ws.tags,
    }).select().single();
    if (data) {
      set(s => ({ worksites: [...s.worksites, dbToWorksite(data)] }));
    }
  },

  removeWorksite: async (id) => {
    await supabase.from('worksites').delete().eq('id', id);
    set(s => ({ worksites: s.worksites.filter(w => w.id !== id) }));
  },

  syncFromSheet: async (url) => {
    set({ syncing: true });
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-sheet', {
        body: { sheetUrl: url },
      });
      if (error) {
        set({ syncing: false });
        return { success: false, message: error.message };
      }
      if (data?.error) {
        set({ syncing: false });
        return { success: false, message: data.error };
      }
      // Refresh data
      await get().fetchInterns();
      set({ syncing: false, sheetUrl: url, lastSynced: new Date().toISOString() });
      return { success: true, message: data.message || `Synced ${data.count} interns` };
    } catch (err: any) {
      set({ syncing: false });
      return { success: false, message: err.message || 'Sync failed' };
    }
  },

  loadSyncConfig: async () => {
    const { data } = await supabase.from('sync_config').select('*').limit(1).single();
    if (data) {
      set({ sheetUrl: data.sheet_url, lastSynced: data.last_synced_at });
    }
  },

  uploadExcelInterns: async (parsed: Intern[]) => {
    // Insert parsed interns into DB
    const inserts = parsed.map(i => ({
      first_name: i.firstName,
      last_name: i.lastName,
      email_submission: i.emailSubmission,
      student_email: i.studentEmail,
      phone: i.phone,
      parent_phone: i.parentPhone,
      dob: i.dob,
      school: i.school,
      other_school: i.otherSchool,
      grade: i.grade,
      programs: i.programs,
      it_interests: i.itInterests,
      cleveland_clinic: i.clevelandClinic,
      construction_mgmt: i.constructionMgmt,
      biomedical: i.biomedical,
      env_justice: i.envJustice,
      env_climate: i.envClimate,
      env_field_science: i.envFieldScience,
      iers_center: i.iersCenter,
      magnet_manufacturing: i.magnetManufacturing,
      education_internship: i.educationInternship,
      healthcare: i.healthcare,
      video_games: i.videoGames,
      cs_course_taken: i.csCourseTaken,
      specific_interests: i.specificInterests,
      additional_questions: i.additionalQuestions,
      timestamp: i.timestamp,
      is_duplicate: i.isDuplicate,
      is_newest: i.isNewest,
      source_sheet_url: 'manual-upload',
    }));

    await supabase.from('interns').delete().eq('source_sheet_url', 'manual-upload');
    await supabase.from('interns').insert(inserts);
    await get().fetchInterns();
  },
}));
