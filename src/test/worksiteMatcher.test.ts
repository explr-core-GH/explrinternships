import { describe, it, expect } from 'vitest';
import { rankInternsForWorksite, scoreInternWorksite } from '@/lib/worksiteMatcher';
import type { Intern, Worksite, Assignment } from '@/types/intern';

function mkIntern(over: Partial<Intern> = {}): Intern {
  return {
    id: 'i1', timestamp: '', emailSubmission: '',
    firstName: 'Test', lastName: 'Student', phone: '', parentPhone: '', dob: '',
    studentEmail: '', school: '', otherSchool: '', grade: '11', gender: '',
    programs: [], itInterests: [],
    clevelandClinic: 'No', constructionMgmt: 'No', biomedical: 'No',
    envJustice: 'No', envClimate: 'No', envFieldScience: 'No',
    iersCenter: 'No', magnetManufacturing: 'No', educationInternship: 'No',
    healthcare: 'No', videoGames: 'No',
    journalism: 'No', bikeProgram: 'No', itCertification: 'No',
    csCourseTaken: '', specificInterests: '', additionalQuestions: '',
    isDuplicate: false, isNewest: true, adminNotes: '',
    status: 'pending', intakeDate: '', intakeTime: '', intakeLocation: '',
    raceEthnicity: '', parentGuardianEmail: '', parentGuardianPhone: '',
    isEll: false, isCmsd: false,
    ...over,
  };
}

function mkWs(over: Partial<Worksite> = {}): Worksite {
  return {
    id: 'w1', name: 'Test Worksite', category: 'Other',
    description: '', capacity: 10, filled: 0,
    contactName: '', contactEmail: '', location: '',
    tags: [], status: 'open', labels: [],
    interestFieldKeys: [],
    ...over,
  };
}

describe('worksiteMatcher (data-driven)', () => {
  it('scores Yes on a declared interest field as a strong match', () => {
    const intern = mkIntern({ healthcare: 'Yes' });
    const ws = mkWs({ name: 'Healthcare Careers', interestFieldKeys: ['healthcare'] });
    const r = scoreInternWorksite(intern, ws, { enforceCapacity: false });
    expect(r.score).toBeGreaterThanOrEqual(6);
    expect(r.reasons[0]).toContain('Healthcare Careers');
  });

  it('does NOT score a Yes when worksite has no matching interest key', () => {
    const intern = mkIntern({ healthcare: 'Yes' });
    const ws = mkWs({ name: 'Healthcare Careers', interestFieldKeys: [] });
    const r = scoreInternWorksite(intern, ws, { enforceCapacity: false });
    expect(r.score).toBe(0);
  });

  it('IERS->NASA repurposing: same form column drives a renamed worksite without code edits', () => {
    // Student responded Yes to what is now the "NASA Internship" question
    // (column still named iers_center on the form/DB)
    const intern = mkIntern({ iersCenter: 'Yes' });
    // Admin renames the worksite to NASA and keeps the iersCenter key pointing to it
    const nasaWs = mkWs({
      name: 'NASA / CSU Internship',
      category: 'Research',
      interestFieldKeys: ['iersCenter'],
    });
    const r = scoreInternWorksite(intern, nasaWs, { enforceCapacity: false });
    expect(r.score).toBeGreaterThanOrEqual(6);
    // Reason text reflects the *current* worksite name, not the legacy field name
    expect(r.reasons.join(' ')).toContain('NASA');
    expect(r.reasons.join(' ')).not.toContain('IERS');
  });

  it('multiple interest keys: any single Yes is enough', () => {
    const intern = mkIntern({ clevelandClinic: 'Yes', healthcare: 'No' });
    const ws = mkWs({ interestFieldKeys: ['clevelandClinic', 'healthcare'] });
    const r = scoreInternWorksite(intern, ws, { enforceCapacity: false });
    expect(r.score).toBeGreaterThanOrEqual(6);
  });

  it('Maybe is weaker than Yes', () => {
    const yesIntern = mkIntern({ biomedical: 'Yes' });
    const maybeIntern = mkIntern({ biomedical: 'Maybe' });
    const ws = mkWs({ interestFieldKeys: ['biomedical'] });
    const yScore = scoreInternWorksite(yesIntern, ws, { enforceCapacity: false }).score;
    const mScore = scoreInternWorksite(maybeIntern, ws, { enforceCapacity: false }).score;
    expect(yScore).toBeGreaterThan(mScore);
    expect(mScore).toBeGreaterThan(0);
  });

  it('rankInternsForWorksite sorts highest score first and excludes assigned', () => {
    const a = mkIntern({ id: 'a', lastName: 'Alice', healthcare: 'Yes' });
    const b = mkIntern({ id: 'b', lastName: 'Bob', healthcare: 'Maybe' });
    const c = mkIntern({ id: 'c', lastName: 'Cara', healthcare: 'Yes' });
    const ws = mkWs({ id: 'w1', interestFieldKeys: ['healthcare'] });
    const assignments: Assignment[] = [
      { id: 'as1', internId: 'c', worksiteId: 'w-other', createdAt: '' },
    ];
    const ranked = rankInternsForWorksite(ws, [a, b, c], assignments);
    // c is assigned elsewhere -> excluded by default
    expect(ranked.map(m => m.intern.id)).toEqual(['a', 'b']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('honors specificInterests text -> tag substring matching', () => {
    const intern = mkIntern({ specificInterests: 'I love welding and metal fabrication' });
    const ws = mkWs({ tags: ['welding', 'manufacturing'], interestFieldKeys: [] });
    const r = scoreInternWorksite(intern, ws, { enforceCapacity: false });
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons.some(rs => rs.includes('welding'))).toBe(true);
  });
});
