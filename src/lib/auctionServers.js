/**
 * Auction server registry and small, dependency-free helpers.
 *
 * Cloud room state uses one Supabase database. The secondary id is retained
 * only to resolve links and records created before the database migration.
 * Keep this module dependency-free so it can be unit-tested with node:test.
 */

export const PRIMARY_SERVER = 'primary';
export const SECONDARY_SERVER = 'secondary';
export const LOCAL_SERVER = 'local';
export const DEFAULT_AUCTION_SERVER = PRIMARY_SERVER;

export const AUCTION_SERVERS = Object.freeze([
  {
    id: PRIMARY_SERVER,
    label: 'Supabase',
    shortLabel: 'DB',
    description: 'Supabase PostgreSQL and Realtime',
  },
  {
    id: LOCAL_SERVER,
    label: 'Offline / Hotspot',
    shortLabel: 'Local',
    description: 'Hotspot / LAN',
  },
]);

const SERVER_IDS = new Set([
  ...AUCTION_SERVERS.map((server) => server.id),
  SECONDARY_SERVER,
]);
const PREFERRED_SERVER_KEY = 'ipl-auction:preferred-server';

/** True when the value is one of the known server ids. */
export function isValidServer(value) {
  return typeof value === 'string' && SERVER_IDS.has(value);
}

/**
 * Normalise a server value. Unknown/empty values fall back to `fallback`.
 * Pass `null` as the fallback when the caller needs to detect an invalid value.
 */
export function normalizeServer(value, fallback = DEFAULT_AUCTION_SERVER) {
  if (isValidServer(value)) return value;
  return fallback;
}

/** Metadata for a server id. Unknown ids return the primary server metadata. */
export function getServerMeta(value) {
  const id = normalizeServer(value);
  return (
    AUCTION_SERVERS.find((server) => server.id === id) || AUCTION_SERVERS[0]
  );
}

/**
 * Read the server from a Supabase auction row.
 *
 * `settings.server` is the deployable fallback used until the optional
 * top-level `server` column is added. Existing rows have neither and therefore
 * correctly default to Server 1.
 */
export function getAuctionServer(record) {
  if (!record) return DEFAULT_AUCTION_SERVER;
  return DEFAULT_AUCTION_SERVER;
}

/** Read the server hint from a query string. Invalid/missing hints return null. */
export function getServerFromSearch(search = '') {
  try {
    const value = new URLSearchParams(search).get('server');
    return isValidServer(value)
      ? value === SECONDARY_SERVER ? PRIMARY_SERVER : value
      : null;
  } catch {
    return null;
  }
}

/**
 * Append `?server=` to a room path without destroying an existing query string
 * or hash. Used for invite links, lobby cards, and in-app navigation.
 */
export function withServerParam(path, server) {
  const value = normalizeServer(server);
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const base = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}server=${encodeURIComponent(value)}${hash}`;
}

/** Persisted server selection for the landing page. */
export function getPreferredServer() {
  if (typeof window === 'undefined') return DEFAULT_AUCTION_SERVER;
  try {
    return normalizeServer(window.localStorage.getItem(PREFERRED_SERVER_KEY));
  } catch {
    return DEFAULT_AUCTION_SERVER;
  }
}

export function setPreferredServer(server) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PREFERRED_SERVER_KEY,
      normalizeServer(server) === SECONDARY_SERVER
        ? PRIMARY_SERVER
        : normalizeServer(server),
    );
  } catch {
    // Private-mode/storage-disabled browsers can still use the in-memory state.
  }
}
