/**
 * Check if an intern will be 16 years old by June 5th of the current program year.
 * Handles common DOB formats: MM/DD/YYYY, YYYY-MM-DD, M/D/YYYY, etc.
 */
export function isEligibleForPreApprenticeship(dob: string): boolean {
  if (!dob) return false;

  let date: Date | null = null;

  // Try MM/DD/YYYY or M/D/YYYY
  const slashMatch = dob.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    date = new Date(Number(slashMatch[3]), Number(slashMatch[1]) - 1, Number(slashMatch[2]));
  }

  // Try YYYY-MM-DD
  if (!date) {
    const isoMatch = dob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }
  }

  if (!date || isNaN(date.getTime())) return false;

  // Cutoff: June 5 of 2026 (current program year)
  const cutoff = new Date(2026, 5, 5); // June 5, 2026
  const age = cutoff.getFullYear() - date.getFullYear();
  const birthdayBeforeCutoff =
    date.getMonth() < cutoff.getMonth() ||
    (date.getMonth() === cutoff.getMonth() && date.getDate() <= cutoff.getDate());

  return birthdayBeforeCutoff ? age >= 16 : age - 1 >= 16;
}
