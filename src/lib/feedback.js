export function errorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with this email already exists. Please sign in.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Unable to connect. Check your connection and try again.',
    'permission-denied': 'You do not have permission to complete this action.',
    'unavailable': 'The service is temporarily unavailable. Please try again.',
  };
  return messages[error?.code] || error?.message || 'Unable to complete this action. Please try again.';
}
export function reportError(error) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('travelaura-error', { detail: errorMessage(error) }));
}
// For UI event handlers: errors are shown without advancing the success flow.
const submittingForms = new WeakSet();
export const withFeedback = action => async (...args) => {
  const event = args[0];
  const form = event?.type === 'submit' ? event.currentTarget : null;
  if (form && submittingForms.has(form)) { event.preventDefault(); return; }
  const buttons = form ? [...form.querySelectorAll('button[type="submit"], button:not([type])')] : [];
  const disabled = buttons.map(button => button.disabled);
  if (form) { submittingForms.add(form); form.setAttribute('aria-busy', 'true'); buttons.forEach(button => { button.disabled = true; }); }
  try { return await action(...args); } catch (error) { reportError(error); }
  finally {
    if (form) { submittingForms.delete(form); form.removeAttribute('aria-busy'); buttons.forEach((button, index) => { button.disabled = disabled[index]; }); }
  }
};
