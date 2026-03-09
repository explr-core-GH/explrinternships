import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, BarChart3, Upload, Settings, LogOut } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/roster', label: 'Roster', icon: Users },
  { to: '/worksites', label: 'Worksites', icon: Building2 },
  { to: '/demographics', label: 'Demographics', icon: BarChart3 },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const internCount = useAppStore((s) => s.interns.filter(i => i.isNewest).length);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b bg-card flex items-center px-4 sm:px-6 gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">EX</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-none">EXPLR INTERNSHIPS</h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              Internship Matching Tool
            </p>
          </div>
        </div>

        {internCount > 0 && (
          <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
            {internCount} active interns
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="w-14 sm:w-48 border-r bg-card shrink-0 flex flex-col py-2">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 surface-sunken">
          {children}
        </main>
      </div>
    </div>
  );
}
