export function reportError(error) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('travelaura-error', { detail: error.message || 'Unable to complete this action. Please try again.' }));
}
// For UI event handlers: errors are shown without advancing the success flow.
export const withFeedback = action => async (...args) => {
  try { return await action(...args); } catch (error) { reportError(error); }
};
