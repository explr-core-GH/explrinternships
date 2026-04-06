import { useState, useMemo } from 'react';
import { Shield, Plus, Trash2, School, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { useAutoLoadData } from '@/hooks/useAutoLoadData';
import { normalizeSchoolName } from '@/lib/schoolNameNormalizer';

interface Admin {
  id: string;
  name: string;
  email: string;
}

export default function SettingsPage() {
  useAutoLoadData();

  const { interns, schoolContacts, schoolAliases, addSchoolAlias, removeSchoolAlias } = useAppStore();

  // Admin state (existing)
  const [admins, setAdmins] = useState<Admin[]>(() => {
    const stored = localStorage.getItem('intern-admins');
    return stored ? JSON.parse(stored) : [];
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Alias editor state
  const [aliasFrom, setAliasFrom] = useState('');
  const [aliasTo, setAliasTo] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);

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

  const handleAddAlias = async () => {
    if (!aliasFrom.trim() || !aliasTo.trim()) { toast.error('Both fields required'); return; }
    setAddingAlias(true);
    try {
      await addSchoolAlias(aliasFrom, aliasTo);
      toast.success(`"${aliasFrom.trim()}" will now match to "${aliasTo.trim()}"`);
      setAliasFrom('');
      setAliasTo('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add alias');
    }
    setAddingAlias(false);
  };

  // Find school names from interns that don't match any school contact
  const unmatchedSchools = useMemo(() => {
    const activeInterns = interns.filter(i => i.isNewest);
    const contactNormalized = new Set(schoolContacts.map(c => normalizeSchoolName(c.schoolName)));

    const schoolCounts: Record<string, { display: string; count: number }> = {};
    for (const intern of activeInterns) {
      const school = intern.otherSchool || intern.school;
      if (!school) continue;
      const norm = normalizeSchoolName(school);
      if (contactNormalized.has(norm)) continue;
      if (!schoolCounts[norm]) schoolCounts[norm] = { display: school, count: 0 };
      schoolCounts[norm].count++;
    }

    return Object.values(schoolCounts).sort((a, b) => b.count - a.count);
  }, [interns, schoolContacts]);

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-6">
      <h2 className="text-xl font-bold text-foreground mb-1">Settings</h2>
      <p className="text-xs text-muted-foreground mb-6">Manage administrators, school aliases, and app settings.</p>

      {/* School Alias Editor */}
      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <School className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">School Name Aliases</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Map misspelled or abbreviated school names to their canonical name so contacts match correctly.
        </p>

        <div className="space-y-2 mb-4">
          {schoolAliases.map(a => (
            <div key={a.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm text-foreground truncate">{a.alias}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-primary truncate">{a.canonicalName}</span>
              </div>
              <button onClick={() => { removeSchoolAlias(a.id); toast.success('Alias removed'); }} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {schoolAliases.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">No aliases added yet. School names are matched using built-in normalization.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Input placeholder="Misspelled name" value={aliasFrom} onChange={e => setAliasFrom(e.target.value)} className="h-9 text-sm" />
          <Input placeholder="Correct name" value={aliasTo} onChange={e => setAliasTo(e.target.value)} className="h-9 text-sm" />
          <Button size="sm" onClick={handleAddAlias} disabled={addingAlias} className="shrink-0 gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {unmatchedSchools.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Schools with no contacts ({unmatchedSchools.length})
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              These school names from student records don't match any uploaded contacts. Click one to pre-fill the alias field.
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {unmatchedSchools.map(s => (
                <button
                  key={s.display}
                  onClick={() => setAliasFrom(s.display)}
                  className="w-full text-left flex items-center justify-between p-2 rounded-md hover:bg-accent/30 transition-colors text-xs"
                >
                  <span className="text-foreground">{s.display}</span>
                  <span className="text-muted-foreground shrink-0">{s.count} student{s.count !== 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Administrators */}
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
    </div>
  );
}
