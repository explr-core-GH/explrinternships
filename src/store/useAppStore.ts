import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Intern, Worksite, Assignment, InternStatus } from '@/types/intern';
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
    adminNotes: (row as any).admin_notes || '',
    status: ((row as any).status || 'pending') as InternStatus,
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
  assignments: Assignment[];
  loading: boolean;
  sheetUrl: string;
  lastSynced: string | null;
  syncing: boolean;
  lastUploadSnapshot: any[] | null;
  canUndoUpload: boolean;
  fetchInterns: () => Promise<void>;
  fetchWorksites: () => Promise<void>;
  fetchAssignments: () => Promise<void>;
  addWorksite: (ws: Omit<Worksite, 'id'>) => Promise<void>;
  removeWorksite: (id: string) => Promise<void>;
  assignIntern: (internId: string, worksiteId: string) => Promise<void>;
  unassignIntern: (internId: string) => Promise<void>;
  syncFromSheet: (url: string) => Promise<{ success: boolean; message: string }>;
  loadSyncConfig: () => Promise<void>;
  uploadExcelInterns: (interns: Intern[]) => Promise<void>;
  updateIntern: (id: string, updates: Partial<Record<string, any>>) => Promise<void>;
  updateWorksite: (id: string, updates: Partial<Record<string, any>>) => Promise<void>;
  refreshWorksiteCounts: () => Promise<void>;
  undoLastUpload: () => Promise<boolean>;
}

export const useAppStore = create<AppState>()((set, get) => ({
  interns: [],
  worksites: [],
  assignments: [],
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
      const inserts = DEFAULT_WORKSITES.map(ws => ({
        name: ws.name, category: ws.category, description: ws.description,
        capacity: ws.capacity, filled: ws.filled, contact_name: ws.contactName,
        contact_email: ws.contactEmail, location: ws.location, tags: ws.tags,
      }));
      await supabase.from('worksites').insert(inserts);
      const { data: seeded } = await supabase.from('worksites').select('*').order('name');
      set({ worksites: (seeded || []).map(dbToWorksite) });
    }
  },

  fetchAssignments: async () => {
    const { data } = await supabase.from('placements').select('*');
    if (data) {
      set({
        assignments: data.map((r: any) => ({
          id: r.id,
          internId: r.intern_id,
          worksiteId: r.worksite_id,
          createdAt: r.created_at,
        })),
      });
    }
  },

  addWorksite: async (ws) => {
    const { data } = await supabase.from('worksites').insert({
      name: ws.name, category: ws.category, description: ws.description,
      capacity: ws.capacity, filled: ws.filled, contact_name: ws.contactName,
      contact_email: ws.contactEmail, location: ws.location, tags: ws.tags,
    }).select().single();
    if (data) {
      set(s => ({ worksites: [...s.worksites, dbToWorksite(data)] }));
    }
  },

  removeWorksite: async (id) => {
    await supabase.from('worksites').delete().eq('id', id);
    set(s => ({ worksites: s.worksites.filter(w => w.id !== id) }));
  },

  assignIntern: async (internId, worksiteId) => {
    // Upsert: remove old assignment first
    await supabase.from('placements').delete().eq('intern_id', internId);
    const { data } = await supabase.from('placements').insert({
      intern_id: internId,
      worksite_id: worksiteId,
    }).select().single();
    if (data) {
      set(s => ({
        assignments: [...s.assignments.filter(a => a.internId !== internId), {
          id: data.id,
          internId: data.intern_id,
          worksiteId: data.worksite_id,
          createdAt: data.created_at,
        }],
      }));
      // Update worksite filled counts
      await get().refreshWorksiteCounts();
    }
  },

  unassignIntern: async (internId) => {
    await supabase.from('placements').delete().eq('intern_id', internId);
    set(s => ({ assignments: s.assignments.filter(a => a.internId !== internId) }));
    await get().refreshWorksiteCounts();
  },

  updateWorksite: async (id, updates) => {
    const dbUpdates: Record<string, any> = {};
    const fieldMap: Record<string, string> = {
      contactName: 'contact_name', contactEmail: 'contact_email',
    };
    for (const [key, val] of Object.entries(updates)) {
      const dbKey = fieldMap[key] || key;
      dbUpdates[dbKey] = val;
    }
    await supabase.from('worksites').update(dbUpdates).eq('id', id);
    set(s => ({
      worksites: s.worksites.map(w => w.id === id ? { ...w, ...updates } as Worksite : w),
    }));
  },

  refreshWorksiteCounts: async () => {
    const { data } = await supabase.from('placements').select('worksite_id');
    const counts: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      counts[r.worksite_id] = (counts[r.worksite_id] || 0) + 1;
    });
    set(s => ({
      worksites: s.worksites.map(w => ({ ...w, filled: counts[w.id] || 0 })),
    }));
  },

  updateIntern: async (id, updates) => {
    // Map camelCase to snake_case for DB
    const dbUpdates: Record<string, any> = {};
    const fieldMap: Record<string, string> = {
      firstName: 'first_name', lastName: 'last_name', phone: 'phone',
      parentPhone: 'parent_phone', dob: 'dob', studentEmail: 'student_email',
      school: 'school', otherSchool: 'other_school', grade: 'grade',
      adminNotes: 'admin_notes', specificInterests: 'specific_interests',
      emailSubmission: 'email_submission', status: 'status',
    };
    for (const [key, val] of Object.entries(updates)) {
      const dbKey = fieldMap[key] || key;
      dbUpdates[dbKey] = val;
    }
    await supabase.from('interns').update(dbUpdates).eq('id', id);
    // Update local state
    set(s => ({
      interns: s.interns.map(i => i.id === id ? { ...i, ...updates } as Intern : i),
    }));
  },

  syncFromSheet: async (url) => {
    set({ syncing: true });
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-sheet', {
        body: { sheetUrl: url },
      });
      if (error) { set({ syncing: false }); return { success: false, message: error.message }; }
      if (data?.error) { set({ syncing: false }); return { success: false, message: data.error }; }
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
    if (data) set({ sheetUrl: data.sheet_url, lastSynced: data.last_synced_at });
  },

  uploadExcelInterns: async (parsed: Intern[]) => {
    const inserts = parsed.map(i => ({
      first_name: i.firstName, last_name: i.lastName, email_submission: i.emailSubmission,
      student_email: i.studentEmail, phone: i.phone, parent_phone: i.parentPhone,
      dob: i.dob, school: i.school, other_school: i.otherSchool, grade: i.grade,
      programs: i.programs, it_interests: i.itInterests,
      cleveland_clinic: i.clevelandClinic, construction_mgmt: i.constructionMgmt,
      biomedical: i.biomedical, env_justice: i.envJustice, env_climate: i.envClimate,
      env_field_science: i.envFieldScience, iers_center: i.iersCenter,
      magnet_manufacturing: i.magnetManufacturing, education_internship: i.educationInternship,
      healthcare: i.healthcare, video_games: i.videoGames, cs_course_taken: i.csCourseTaken,
      specific_interests: i.specificInterests, additional_questions: i.additionalQuestions,
      timestamp: i.timestamp, is_duplicate: i.isDuplicate, is_newest: i.isNewest,
      source_sheet_url: 'manual-upload',
    }));
    await supabase.from('interns').delete().eq('source_sheet_url', 'manual-upload');
    await supabase.from('interns').insert(inserts);
    await get().fetchInterns();
  },
}));
