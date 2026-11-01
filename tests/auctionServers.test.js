import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUCTION_SERVERS,
  DEFAULT_AUCTION_SERVER,
  getAuctionServer,
  getServerFromSearch,
  getServerMeta,
  normalizeServer,
  withServerParam,
} from '../src/lib/auctionServers.js';

test('normalizeServer accepts known ids and falls back safely', () => {
  assert.equal(normalizeServer('primary'), 'primary');
  assert.equal(normalizeServer('secondary'), 'secondary');
  assert.equal(normalizeServer('local'), 'local');
  assert.equal(normalizeServer('nope'), DEFAULT_AUCTION_SERVER);
  assert.equal(normalizeServer(undefined), DEFAULT_AUCTION_SERVER);
  assert.equal(normalizeServer('nope', null), null);
});

test('getAuctionServer maps legacy cloud servers to Supabase', () => {
  assert.equal(getAuctionServer({ server: 'secondary' }), 'primary');
  assert.equal(
    getAuctionServer({ settings: { server: 'secondary' } }),
    'primary',
  );
  assert.equal(getAuctionServer({ settings: {} }), 'primary');
  assert.equal(getAuctionServer(null), 'primary');
});

test('legacy server values do not split rooms across separate databases', () => {
  assert.equal(
    getAuctionServer({
      server: 'primary',
      settings: { server: 'secondary' },
    }),
    'primary',
  );
});

test('getServerFromSearch maps legacy server links to Supabase', () => {
  assert.equal(getServerFromSearch('?server=secondary'), 'primary');
  assert.equal(getServerFromSearch('?server=local'), 'local');
  assert.equal(getServerFromSearch('?foo=1&server=primary'), 'primary');
  assert.equal(getServerFromSearch('?server=bogus'), null);
  assert.equal(getServerFromSearch(''), null);
});

test('withServerParam preserves existing query strings and hashes', () => {
  assert.equal(
    withServerParam('/lobby/K7M2QX', 'secondary'),
    '/lobby/K7M2QX?server=secondary',
  );
  assert.equal(
    withServerParam('/lobby/K7M2QX?foo=1#team', 'primary'),
    '/lobby/K7M2QX?foo=1&server=primary#team',
  );
});

test('server metadata is stable and always has a fallback', () => {
  assert.equal(getServerMeta('secondary').label, 'Supabase');
  assert.equal(getServerMeta('unknown').id, AUCTION_SERVERS[0].id);
});
