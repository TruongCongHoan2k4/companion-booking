export const AUTH_CHANGE_EVENT = 'companion-booking-auth';

export function notifyAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
  }
}
