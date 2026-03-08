import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useAutoLoadData() {
  const { interns, fetchInterns, fetchWorksites, loadSyncConfig } = useAppStore();

  useEffect(() => {
    fetchInterns();
    fetchWorksites();
    loadSyncConfig();
  }, []);
}
