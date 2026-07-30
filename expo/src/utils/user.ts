/**
 * Helper utility to safely extract a user ID from a string, ObjectId, or User object.
 */
export function extractId(target: any): string {
  if (!target) return '';
  if (typeof target === 'string') return target;
  if (typeof target === 'object') {
    if (target._id) return String(target._id);
    if (target.id) return String(target.id);
  }
  return String(target);
}

/**
 * Robustly checks whether two user references (strings, objects, or ObjectIds) represent the same user.
 */
export function isSameUser(userA: any, userB: any): boolean {
  const idA = extractId(userA);
  const idB = extractId(userB);
  return Boolean(idA && idB && idA === idB);
}
