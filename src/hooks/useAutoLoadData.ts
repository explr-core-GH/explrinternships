import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useAutoLoadData() {
  const { fetchInterns, fetchWorksites, fetchAssignments, loadSyncConfig, fetchSchoolContacts } = useAppStore();

  useEffect(() => {
    fetchInterns();
    fetchWorksites();
    fetchAssignments();
    loadSyncConfig();
    fetchSchoolContacts();
  }, []);
}
