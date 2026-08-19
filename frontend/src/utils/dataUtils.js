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

/**
 * Gets currently local date in YYYY-MM-DD format, avoiding UTC shifts.
 */
export const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Standardizes date display to DD/MM/YYYY, ignoring timezone shifts.
 */
export const formatSpanishDate = (dateStr) => {
    if (!dateStr) return '';
    // Extract date part from ISO string
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
};
