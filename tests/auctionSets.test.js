import test from 'node:test';
import assert from 'node:assert/strict';
import { IPL_PLAYERS } from '../src/data/players.js';
import {
  getCurrentOrderIndex,
  getUpcomingPlayerSets,
  insertUnsoldPlayersAfterCurrent,
  movePlayerSetToEnd,
} from '../src/lib/auctionSets.js';

test('getCurrentOrderIndex uses the active occurrence for returned players', () => {
  const playerIndex = 0;
  const order = [playerIndex, 1, playerIndex];

  assert.equal(
    getCurrentOrderIndex(order, {
      playerId: IPL_PLAYERS[playerIndex].id,
      playerOrderIndex: 2,
    }),
    2,
  );
  assert.equal(getCurrentOrderIndex(order, { playerId: IPL_PLAYERS[1].id }), 1);
});

test('getUpcomingPlayerSets counts remaining entries by set', () => {
  const order = [0, 1, 2, 3];
  const currentIndex = 0;
  const expected = new Map();
  order.slice(currentIndex + 1).forEach((index) => {
    const setName = IPL_PLAYERS[index].set;
    expected.set(setName, (expected.get(setName) || 0) + 1);
  });

  assert.deepEqual(
    getUpcomingPlayerSets(order, currentIndex),
    [...expected].map(([name, count]) => ({ name, count })),
  );
});

test('returned players are grouped under the Unsold Set label', () => {
  const returnedPlayerId = IPL_PLAYERS[2].id;

  assert.deepEqual(
    getUpcomingPlayerSets([2], -1, [returnedPlayerId]),
    [{ name: 'Unsold Set', count: 1 }],
  );
  assert.deepEqual(
    movePlayerSetToEnd([2, 3], -1, 'Unsold Set', [returnedPlayerId]),
    { order: [3, 2], movedCount: 1 },
  );
});

test('movePlayerSetToEnd preserves the current player and postpones only upcoming members', () => {
  const order = [0, 1, 2, 3, 4, 5];
  const targetSet = IPL_PLAYERS[2].set;
  const result = movePlayerSetToEnd(order, 0, targetSet);
  const expectedMoved = order.slice(1).filter((index) => IPL_PLAYERS[index].set === targetSet);

  assert.equal(result.movedCount, expectedMoved.length);
  assert.deepEqual(result.order.slice(0, 1), [order[0]]);
  assert.deepEqual(result.order.slice(-expectedMoved.length), expectedMoved);
  assert.deepEqual(
    result.order.slice(1, -expectedMoved.length || undefined),
    order.slice(1).filter((index) => IPL_PLAYERS[index].set !== targetSet),
  );
});

test('insertUnsoldPlayersAfterCurrent inserts known players once after the current entry', () => {
  const order = [0, 1, 2, 3];
  const unsoldIds = [IPL_PLAYERS[4].id, IPL_PLAYERS[5].id, IPL_PLAYERS[4].id];
  const result = insertUnsoldPlayersAfterCurrent(order, 1, unsoldIds);

  assert.deepEqual(result.order, [0, 1, 4, 5, 2, 3]);
  assert.deepEqual(result.insertedIndices, [4, 5]);
});
