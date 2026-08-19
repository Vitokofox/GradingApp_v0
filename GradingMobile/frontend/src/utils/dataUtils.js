/**
 * Normalizes any input into a guaranteed Array.
 * - If input is an Array, returns it as is.
 * - If input is an Object (and not null), returns Object.values(input).
 * - If input is null, undefined, string, number, or boolean, returns an empty Array [].
 * 
 * @param {any} value - The value to normalize
 * @returns {Array} - Always returns an array
 */
export const normalizeArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return Object.values(value);
    // Fallback for primitives that might be passed erroneously
    return [];
};
