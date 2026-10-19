/**
 * Reverse geocoding via the OpenStreetMap Nominatim service.
 *
 * Converts map coordinates into a readable address string so the reporting
 * form can pre-fill the location field.
 */

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

// Nominatim's usage policy asks for at most 1 request per second. Serialise
// lookups through a single in-flight request and a minimum gap between calls.
const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestAt = 0;
let queue = Promise.resolve();

const throttle = (task) => {
  const run = async () => {
    const waitFor = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (waitFor > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitFor));
    }
    lastRequestAt = Date.now();
    return task();
  };

  queue = queue.then(run, run);
  return queue;
};

/**
 * Build a readable address from a Nominatim response, preferring the most
 * specific human-readable parts and dropping anything empty or duplicated.
 */
const formatAddress = (result) => {
  if (!result || typeof result !== 'object') return '';

  // Ordered most specific -> least. `quarter` is what OpenStreetMap uses for a
  // Philippine barangay, so it is included ahead of the city.
  const parts = [
    result.road,
    result.quarter,
    result.suburb,
    result.city_district,
    result.city || result.town || result.village || result.municipality,
    result.state,
    result.country,
  ].filter(Boolean);

  const seen = new Set();
  const unique = parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.join(', ');
};

/**
 * Look up a readable address for the given coordinates.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<string>} The formatted address, or '' when unavailable.
 */
export const reverseGeocode = async (lat, lng, options = {}) => {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '';
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return '';
  }

  return throttle(async () => {
    const url = `${NOMINATIM_REVERSE}?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    const response = await fetch(url, {
      signal: options.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Address lookup failed (HTTP ${response.status}).`);
    }

    const data = await response.json();

    if (data?.error) {
      return '';
    }

    const formatted = formatAddress(data?.address);
    return formatted || data?.display_name || '';
  });
};