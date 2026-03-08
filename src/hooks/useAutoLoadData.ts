import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { parseExcelFile } from '@/lib/parseExcel';

/**
 * Auto-loads initial data from public/data/initial-data.xlsx if no interns exist.
 */
export function useAutoLoadData() {
  const { interns, setInterns } = useAppStore();
  const loaded = useRef(false);

  useEffect(() => {
    if (interns.length > 0 || loaded.current) return;
    loaded.current = true;

    fetch('/data/initial-data.xlsx')
      .then(r => r.arrayBuffer())
      .then(buf => {
        const parsed = parseExcelFile(buf);
        if (parsed.length > 0) {
          setInterns(parsed);
        }
      })
      .catch(() => {
        // Silently fail - user can upload manually
      });
  }, [interns.length, setInterns]);
}
