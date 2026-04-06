import { useState, useMemo } from 'react';
import { ChevronRight, School, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Intern, Worksite } from '@/types/intern';
import InternCard from '@/components/InternCard';

interface SchoolGroupedRosterProps {
  interns: Intern[];
  worksites: Worksite[];
}

export default function SchoolGroupedRoster({ interns, worksites }: SchoolGroupedRosterProps) {
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());

  const schoolGroups = useMemo(() => {
    const groups: Record<string, Intern[]> = {};
    interns.forEach(intern => {
      const school = intern.otherSchool || intern.school || 'Unknown';
      if (!groups[school]) groups[school] = [];
      groups[school].push(intern);
    });
    // Sort schools alphabetically, sort students by last name within each
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([school, students]) => ({
        school,
        students: students.sort((a, b) => a.lastName.localeCompare(b.lastName)),
      }));
  }, [interns]);

  const toggleSchool = (school: string) => {
    setExpandedSchools(prev => {
      const next = new Set(prev);
      next.has(school) ? next.delete(school) : next.add(school);
      return next;
    });
  };

  const expandAll = () => {
    if (expandedSchools.size === schoolGroups.length) {
      setExpandedSchools(new Set());
    } else {
      setExpandedSchools(new Set(schoolGroups.map(g => g.school)));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {schoolGroups.length} schools · {interns.length} interns
        </p>
        <button
          onClick={expandAll}
          className="text-xs text-primary hover:underline"
        >
          {expandedSchools.size === schoolGroups.length ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {schoolGroups.map(({ school, students }) => {
        const isExpanded = expandedSchools.has(school);
        return (
          <div key={school} className="rounded-lg border bg-card shadow-card overflow-hidden">
            <button
              onClick={() => toggleSchool(school)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <School className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-card-foreground truncate">{school}</h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{students.length}</span>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2 border-t pt-3">
                    {students.map(intern => (
                      <InternCard
                        key={intern.id}
                        intern={intern}
                        worksites={worksites}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
