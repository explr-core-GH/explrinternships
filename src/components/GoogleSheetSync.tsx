import { useState, useEffect } from 'react';
import { RefreshCw, Link2, Check, AlertCircle, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function GoogleSheetSync() {
  const { sheetUrl, lastSynced, syncing, syncFromSheet, loadSyncConfig } = useAppStore();
  const [url, setUrl] = useState(sheetUrl);
  const [initialized, setInitialized] = useState(false);
  const handleSync = async () => {
    if (!url.trim()) {
      toast.error('Please enter a Google Sheets URL');
      return;
    }
    if (!url.includes('docs.google.com/spreadsheets')) {
      toast.error('Please enter a valid Google Sheets URL');
      return;
    }
    const result = await syncFromSheet(url.trim());
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  // Initialize URL from config
  useState(() => {
    if (!sheetUrl) loadSyncConfig();
  });

  // Keep local state in sync
  if (sheetUrl && !url) setUrl(sheetUrl);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-card-foreground">Google Sheet Sync</h3>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Paste your Google Sheet URL below. The sheet must be publicly accessible (anyone with the link can view).
      </p>

      <div className="flex gap-2 mb-3">
        <Input
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-9 text-sm"
        />
        <Button
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="shrink-0 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {lastSynced && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last synced: {new Date(lastSynced).toLocaleString()}
        </div>
      )}
    </div>
  );
}
