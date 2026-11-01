import { supabase } from './supabase';
import { IPL_PLAYERS } from '../data/players';

export async function seedPlayers() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('players').upsert(
    IPL_PLAYERS.map((player) => ({ id: player.id, data: player })),
  );
  if (error) throw error;
}

export async function createInitialAuction(auctionId) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const room = {
    hostId: 'system',
    hostName: 'Manager',
    status: 'active',
    auctionType: 'mega',
    isPublic: true,
    players: [],
    settings: { bidTimer: 10, budget: 120 },
  };
  const state = {
    room,
    live: {
      playerId: 'p1',
      currentBid: 2,
      highBidderId: '',
      highBidderName: 'Base Price',
      timerEndsAt: Date.now() + 60000,
      status: 'bidding',
    },
  };
  const [stateResult, directoryResult] = await Promise.all([
    supabase.from('auction_states').upsert({ id: auctionId, state, version: 1 }),
    supabase.from('auctions').upsert({
      id: auctionId,
      host_id: 'system',
      host_name: 'Manager',
      status: 'active',
      auction_type: 'mega',
      is_public: true,
      settings: room.settings,
      players: [],
    }),
  ]);
  if (stateResult.error) throw stateResult.error;
  if (directoryResult.error) throw directoryResult.error;
}
