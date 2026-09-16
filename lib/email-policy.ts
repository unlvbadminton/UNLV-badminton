export const DEFAULT_ADMIN_EMAIL = 'unlvbadminton@unlv.edu';
export function allowedEmail(email: string, domain: string, admins: string[]): boolean {
 const normalized = email.trim().toLowerCase();
 if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) return false;
 return normalized.split('@')[1] === domain.trim().toLowerCase() || admins.some(admin => admin.trim().toLowerCase() === normalized);
}
