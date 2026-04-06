import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useAutoLoadData() {
  const { fetchInterns, fetchWorksites, fetchAssignments, loadSyncConfig, fetchSchoolContacts, fetchSchoolAliases } = useAppStore();

  useEffect(() => {
    fetchSchoolAliases(); // load aliases before contacts so normalization works
    fetchInterns();
    fetchWorksites();
    fetchAssignments();
    loadSyncConfig();
    fetchSchoolContacts();
  }, []);
}
