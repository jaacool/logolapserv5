// Admin configuration - shared across projects
export const ADMIN_EMAILS = [
  'mail@jaa.cool',
];

export const isAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

export const ADMIN_CREDITS = 999999; // Quasi unendlich
