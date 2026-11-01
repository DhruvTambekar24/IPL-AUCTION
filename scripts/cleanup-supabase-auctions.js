import { createSupabaseAdminClient } from './supabaseAdmin.js';

const CUTOFF_TIMESTAMP = new Date('2026-09-12T00:00:00Z').getTime();

async function cleanupOldAuctions() {
  const supabase = createSupabaseAdminClient();
  console.log(`Starting Supabase auction cleanup before ${new Date(CUTOFF_TIMESTAMP).toISOString()}`);

  const { data: auctions, error: auctionsError } = await supabase
    .from('auctions')
    .select('id, status, created_at');
  if (auctionsError) throw auctionsError;

  let deletedCount = 0;
  let retainedCount = 0;
  for (const auction of auctions || []) {
    const { data: row, error: stateError } = await supabase
      .from('auction_states')
      .select('state')
      .eq('id', auction.id)
      .maybeSingle();
    if (stateError) throw stateError;

    const room = row?.state?.room || {};
    const isCompleted = (room.status || auction.status) === 'completed';
    const createdAt = new Date(auction.created_at || 0).getTime();
    const isOld = Number.isFinite(createdAt) && createdAt > 0 && createdAt < CUTOFF_TIMESTAMP;
    if (!isCompleted && !isOld) {
      retainedCount += 1;
      continue;
    }

    const deletions = await Promise.all([
      supabase.from('auction_states').delete().eq('id', auction.id),
      supabase.from('teams').delete().eq('auction_id', auction.id),
      supabase.from('auctions').delete().eq('id', auction.id),
    ]);
    const failedDelete = deletions.find((result) => result.error);
    if (failedDelete) throw failedDelete.error;
    deletedCount += 1;
  }

  console.log(`Cleanup finished. Deleted ${deletedCount}; retained ${retainedCount}.`);
}

cleanupOldAuctions().catch((error) => {
  console.error('Supabase auction cleanup failed:', error);
  process.exitCode = 1;
});
