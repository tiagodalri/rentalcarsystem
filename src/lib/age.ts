export function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export const YOUNG_DRIVER_MIN_AGE = 21;
export const YOUNG_DRIVER_MAX_AGE = 25;
export const YOUNG_DRIVER_SURCHARGE = 0.08;

export function isBlockedAge(age: number): boolean {
  return age < YOUNG_DRIVER_MIN_AGE;
}

export function isYoungDriver(age: number): boolean {
  return age >= YOUNG_DRIVER_MIN_AGE && age <= YOUNG_DRIVER_MAX_AGE;
}
