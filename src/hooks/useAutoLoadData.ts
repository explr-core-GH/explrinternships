import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useAutoLoadData() {
  const { fetchInterns, fetchWorksites, fetchAssignments, loadSyncConfig } = useAppStore();

  useEffect(() => {
    fetchInterns();
    fetchWorksites();
    fetchAssignments();
    loadSyncConfig();
  }, []);
}
