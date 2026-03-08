import { useState } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Admin {
  id: string;
  name: string;
  email: string;
}

export default function SettingsPage() {
  const [admins, setAdmins] = useState<Admin[]>(() => {
    const stored = localStorage.getItem('intern-admins');
    return stored ? JSON.parse(stored) : [];
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const addAdmin = () => {
    if (!name.trim() || !email.trim()) { toast.error('Name and email required'); return; }
    const newAdmins = [...admins, { id: `admin-${Date.now()}`, name: name.trim(), email: email.trim() }];
    setAdmins(newAdmins);
    localStorage.setItem('intern-admins', JSON.stringify(newAdmins));
    setName(''); setEmail('');
    toast.success('Admin added');
  };

  const removeAdmin = (id: string) => {
    const newAdmins = admins.filter(a => a.id !== id);
    setAdmins(newAdmins);
    localStorage.setItem('intern-admins', JSON.stringify(newAdmins));
    toast.success('Admin removed');
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h2 className="text-xl font-bold text-foreground mb-1">Settings</h2>
      <p className="text-xs text-muted-foreground mb-6">Manage administrators and app settings.</p>

      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Administrators</h3>
        </div>

        <div className="space-y-2 mb-4">
          {admins.map(admin => (
            <div key={admin.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted">
              <div>
                <p className="text-sm font-medium text-foreground">{admin.name}</p>
                <p className="text-xs text-muted-foreground">{admin.email}</p>
              </div>
              <button onClick={() => removeAdmin(admin.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {admins.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">No administrators added yet.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" />
          <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-sm" />
          <Button size="sm" onClick={addAdmin} className="shrink-0 gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-6 text-center">
        For full authentication and role management, connect Lovable Cloud.
      </p>
    </div>
  );
}
