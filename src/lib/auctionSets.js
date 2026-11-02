import { IPL_PLAYERS } from '../data/players.js';

export function getCurrentOrderIndex(order, live) {
  const liveIndex = live?.playerOrderIndex;
  if (
    Number.isInteger(liveIndex) &&
    liveIndex >= 0 &&
    liveIndex < order.length &&
    IPL_PLAYERS[order[liveIndex]]?.id === live?.playerId
  ) {
    return liveIndex;
  }
  return order.findIndex((playerIndex) => IPL_PLAYERS[playerIndex]?.id === live?.playerId);
}

function getAuctionSetName(playerIndex, unsoldReturnPlayerIds) {
  const player = IPL_PLAYERS[playerIndex];
  if (!player) return null;
  return unsoldReturnPlayerIds?.includes(player.id) ? 'Unsold Set' : player.set;
}

export function getUpcomingPlayerSets(order, currentIndex, unsoldReturnPlayerIds = []) {
  const sets = new Map();
  order.slice(Math.max(currentIndex + 1, 0)).forEach((playerIndex) => {
    const setName = getAuctionSetName(playerIndex, unsoldReturnPlayerIds);
    if (!setName) return;
    sets.set(setName, (sets.get(setName) || 0) + 1);
  });
  return [...sets].map(([name, count]) => ({ name, count }));
}

export function movePlayerSetToEnd(order, currentIndex, setName, unsoldReturnPlayerIds = []) {
  const boundary = Math.max(currentIndex + 1, 0);
  const prefix = order.slice(0, boundary);
  const upcoming = order.slice(boundary);
  const moved = [];
  const remaining = [];

  upcoming.forEach((playerIndex) => {
    if (getAuctionSetName(playerIndex, unsoldReturnPlayerIds) === setName) moved.push(playerIndex);
    else remaining.push(playerIndex);
  });

  return {
    order: [...prefix, ...remaining, ...moved],
    movedCount: moved.length,
  };
}

export function insertUnsoldPlayersAfterCurrent(order, currentIndex, playerIds) {
  const boundary = Math.max(currentIndex + 1, 0);
  const prefix = order.slice(0, boundary);
  const upcoming = order.slice(boundary);
  const alreadyUpcoming = new Set(
    upcoming.map((playerIndex) => IPL_PLAYERS[playerIndex]?.id).filter(Boolean),
  );
  const unsoldIndices = [];
  const seen = new Set();

  playerIds.forEach((playerId) => {
    if (seen.has(playerId) || alreadyUpcoming.has(playerId)) return;
    seen.add(playerId);
    const playerIndex = IPL_PLAYERS.findIndex((player) => player.id === playerId);
    if (playerIndex !== -1) unsoldIndices.push(playerIndex);
  });

  return {
    order: [...prefix, ...unsoldIndices, ...upcoming],
    insertedIndices: unsoldIndices,
  };
}
