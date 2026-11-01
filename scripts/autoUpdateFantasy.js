import { createSupabaseAdminClient } from './supabaseAdmin.js';
import { IPL_PLAYERS } from "../src/data/players.js";

let CRICKET_API_KEY;

const normalizeName = (name) => {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Robust player mapping with specific fixes
const playerMap = {};
IPL_PLAYERS.forEach(p => {
    playerMap[normalizeName(p.name)] = p;
});

// Specific Name Fixes (API Name -> Database ID)
const explicitMappings = {
    "amghazanfar": "p_122", // Allah Ghazanfar
    "philipsalt": "p_121",   // Phil Salt
    "mohammedshami": "p_118",
    "mohammedsiraj": "p_119",
    "lungingidi": "p_453",
    "manimaransiddharth": "p_378",
    "varunchakaravarthy": "p_159",
    "vijaykumarvyshak": "p_385",
    "digveshsinghrathi": "p_888", 
    "allahghazanfar": "p_122"
};

// --- Fantasy Point Calculation Logic (User Rules) ---

const calculatePoints = (stats, role) => {
    let points = 0;
    const details = { batting: 0, bowling: 0, fielding: 0, other: 0 };

    if (stats.batting) {
        const { r, b, fours, sixes, dismissal } = stats.batting;
        const runs = parseInt(r) || 0;
        const balls = parseInt(b) || 0;
        const f = parseInt(fours) || 0;
        const s = parseInt(sixes) || 0;

        let battingPts = runs + (f * 4) + (s * 6);
        if (runs >= 100) battingPts += 16;
        else if (runs >= 75) battingPts += 12;
        else if (runs >= 50) battingPts += 8;
        else if (runs >= 25) battingPts += 4;

        if (runs === 0 && dismissal && !role.toLowerCase().includes('bowler')) battingPts -= 2;

        if (balls >= 10 && !role.toLowerCase().includes('bowler')) {
            const sr = (runs / balls) * 100;
            if (sr > 170) battingPts += 6;
            else if (sr > 150) battingPts += 4;
            else if (sr > 130) battingPts += 2;
            else if (sr >= 60 && sr < 70) battingPts -= 2;
            else if (sr >= 50 && sr < 60) battingPts -= 4;
            else if (sr < 50) battingPts -= 6;
        }
        details.batting = battingPts;
        points += battingPts;
    }

    if (stats.bowling) {
        const { w, m, r, o, dot, lbw_bowled } = stats.bowling;
        const wickets = parseInt(w) || 0;
        const maidens = parseInt(m) || 0;
        const runsConceded = parseInt(r) || 0;
        const oversValue = parseFloat(o) || 0;
        const dots = parseInt(dot) || 0;
        const lbwB = parseInt(lbw_bowled) || 0;

        let bowlingPts = (dots * 1) + (wickets * 30) + (maidens * 12) + (lbwB * 8);

        if (wickets >= 5) bowlingPts += 12;
        else if (wickets >= 4) bowlingPts += 8;
        else if (wickets >= 3) bowlingPts += 4;

        if (oversValue >= 2) {
            const er = runsConceded / oversValue;
            if (er < 5) bowlingPts += 6;
            else if (er < 6) bowlingPts += 4;
            else if (er < 7.01) bowlingPts += 2;
            else if (er >= 10 && er < 11.01) bowlingPts -= 2;
            else if (er > 11 && er < 12.01) bowlingPts -= 4;
            else if (er > 12) bowlingPts -= 6;
        }
        details.bowling = bowlingPts;
        points += bowlingPts;
    }

    if (stats.fielding) {
        const { c, s, ro_d, ro_i } = stats.fielding;
        const catches = parseInt(c) || 0;
        const st = parseInt(s) || 0;
        const roD = parseInt(ro_d) || 0;
        const roI = parseInt(ro_i) || 0;

        let fieldingPts = (catches * 8) + (st * 12) + (roD * 12) + (roI * 6);
        if (catches >= 3) fieldingPts += 4;
        
        details.fielding = fieldingPts;
        points += fieldingPts;
    }

    let otherPts = 0;
    if (stats.announced) otherPts += 4;
    if (stats.impact) otherPts += 4;
    details.other = otherPts;
    points += otherPts;

    return { points, details };
};

async function fetchFromAPI(endpoint) {
    if (!CRICKET_API_KEY) throw new Error("CRICKET_API_KEY is missing in environment.");
    console.log(`[API] Fetching: ${endpoint}`);
    const url = `https://api.cricapi.com/v1/${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${CRICKET_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Log hit stats if available
    if (data.info) {
        const { hitsToday, hitsLimit } = data.info;
        const remaining = hitsLimit - hitsToday;
        console.log(`[API Usage] Hits: ${hitsToday}/${hitsLimit} (Remaining today: ${remaining})`);
        if (remaining <= 0) {
            console.error("[Fatal] Daily API Limit Reached! Cannot process more matches today.");
            process.exit(0);
        }
    }

    if (data.status !== "success") {
        if (data.reason?.toLowerCase().includes("hits today exceeded")) {
            console.error("[Fatal] API Rate Limit Exceeded.");
            process.exit(0);
        }
        throw new Error(`API Error: ${data.reason}`);
    }
    return data.data;
}

async function runAutoUpdate() {
    try {
        const supabase = createSupabaseAdminClient();
        CRICKET_API_KEY = process.env.CRICKET_API_KEY || process.env.VITE_CRICKET_API_KEY;
        if (!CRICKET_API_KEY) throw new Error('Set CRICKET_API_KEY or VITE_CRICKET_API_KEY before running this script.');

        console.log("[AutoUpdate] Initializing catch-up fetch...");

        // 1. Get Status from DB
        const { data: statusRow, error: statusError } = await supabase
            .from('fantasy_config')
            .select('data')
            .eq('id', 'autoUpdateStatus')
            .maybeSingle();
        if (statusError) throw statusError;
        const status = statusRow?.data || {
            lastProcessedMatchDate: "2026-04-08T00:00:00Z", // User hint: fetched till 8/4/26
            seriesId: "87c62aac-bc3c-4738-ab93-19da0690488f" // Found via discovery
        };

        const lastDate = new Date(status.lastProcessedMatchDate);
        console.log(`[AutoUpdate] Catching up on matches since: ${lastDate.toISOString()}`);

        // 2. Fetch All Matches in Series
        const seriesData = await fetchFromAPI(`series_info?id=${status.seriesId}`);
        const matches = seriesData.matchList || [];
        console.log(`[Debug] Total matches in series: ${matches.length}`);


        // 3. Filter for concluded matches after lastDate
        console.log(`[Debug] Filtering matches starting from ${lastDate.toISOString()}...`);
        const pendingMatches = matches
            .filter(m => {
                const matchDate = new Date(m.dateTimeGMT);
                const isFinished = m.matchFinished || 
                                 m.status?.toLowerCase().includes("won") || 
                                 m.status?.toLowerCase().includes("tied") || 
                                 m.status?.toLowerCase().includes("no result") ||
                                 m.status?.toLowerCase().includes("result") ||
                                 m.status?.toLowerCase().includes("abandoned");
                
                const isNewer = matchDate >= lastDate;
                
                if (isNewer && !isFinished) {
                    console.log(`[Debug] Match found but not finished: ${m.name} (Status: ${m.status})`);
                }
                
                return isFinished && isNewer;
            })
            .sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));

        if (pendingMatches.length === 0) {
            console.log("[AutoUpdate] No new matches found after filtering.");
            // Log the first few upcoming/recent matches for debugging
            matches.slice(0, 5).forEach(m => {
                console.log(`[Debug] Sample Match: ${m.name} | Date: ${m.dateTimeGMT} | Status: ${m.status} | Finished: ${m.matchFinished}`);
            });
            process.exit(0);
        }

        console.log(`[AutoUpdate] Found ${pendingMatches.length} pending matches to process.`);

        let latestProcessedDate = lastDate;

        for (const match of pendingMatches) {
            console.log(`[AutoUpdate] --> Processing ${match.name} (${match.dateTimeGMT})`);
            
            // Check if match already processed via dedicated collection
            const { data: procRow, error: procError } = await supabase
                .from('processed_matches')
                .select('id')
                .eq('id', match.id)
                .maybeSingle();
            if (procError) throw procError;
            if (procRow) {
                console.log(`[AutoUpdate] Skipping ${match.name} (Match ID: ${match.id} already processed)`);
                continue;
            }

            const now = new Date().toISOString();
            let scorecardData;
            try {
                scorecardData = await fetchFromAPI(`match_scorecard?id=${match.id}`);
            } catch (err) {
                console.error(`[Error] Failed to fetch scorecard for ${match.name}: ${err.message}`);
                const statusLower = (match.status || "").toLowerCase();
                if (statusLower.includes("abandoned") || statusLower.includes("no result")) {
                    console.log(`[AutoUpdate] Match was abandoned/no result. Processing with available data.`);
                    scorecardData = { scorecard: [], players: [] };
                } else {
                    console.log(`[AutoUpdate] Halting further match processing to preserve order. Will retry next time.`);
                    break;
                }
            }
            
            // Extract from various possible player fields (resilient detection)
            let pSource = scorecardData.players || scorecardData.playerList || [];
            
            // Smart Fallback: If scorecard is empty, try match_info only if we have hits
            // Note: fetchFromAPI already logs usage, we can check global hits state if we stored it
            // but for now we'll just try if we didn't find any players in the main list
            if (pSource.length === 0) {
                console.log(`[Debug] No player list in scorecard. Trying match_info...`);
                try {
                    const infoData = await fetchFromAPI(`match_info?id=${match.id}`);
                    pSource = infoData.players || infoData.playerList || [];
                } catch (e) {
                    console.warn(`[Warning] Could not fetch secondary info: ${e.message}`);
                }
            }

            const matchPlayers = {};
            const announced = new Set();
            pSource.forEach(p => {
                const name = p.name || p.playerName;
                if (name) announced.add(normalizeName(name));
            });

            const scorecard = scorecardData.scorecard || scorecardData.score || scorecardData.data?.scorecard;
            scorecard?.forEach((inning) => {
                inning.batting?.forEach(b => {
                    const rawName = b.batsman?.name || b.name || b.player || b.playerName;
                    if (!rawName) return;
                    const name = normalizeName(rawName);
                    if (!matchPlayers[name]) matchPlayers[name] = {};
                    matchPlayers[name].batting = b;
                    if (announced.has(name)) matchPlayers[name].announced = true;
                });
                inning.bowling?.forEach(bw => {
                    const rawName = bw.bowler?.name || bw.name || bw.player || bw.playerName;
                    if (!rawName) return;
                    const name = normalizeName(rawName);
                    if (!matchPlayers[name]) matchPlayers[name] = {};
                    matchPlayers[name].bowling = bw;
                    if (announced.has(name)) matchPlayers[name].announced = true;
                });
                inning.fielding?.forEach(f => {
                    const rawName = f.catcher?.name || f.fielder?.name || f.fielder?.playerName || f.name || f.player || f.playerName;
                    if (!rawName) return;
                    const name = normalizeName(rawName);
                    if (!matchPlayers[name]) matchPlayers[name] = {};
                    matchPlayers[name].fielding = f;
                    if (announced.has(name)) matchPlayers[name].announced = true;
                });
            });

            // Also include players who were announced but didn't bat/bowl/field
            announced.forEach(name => {
                if (!matchPlayers[name]) {
                    matchPlayers[name] = { announced: true };
                }
            });

            console.log(`[AutoUpdate] Match data parsed. Found ${Object.keys(matchPlayers).length} players total.`);

            const matchAggregatedPoints = {};
            const playerStatsUpdates = {};
            let matchedCount = 0;
            let unmapped = [];

            const matchPointWrites = [];

            for (const [name, stats] of Object.entries(matchPlayers)) {
                const pId = explicitMappings[name] || playerMap[name]?.id;
                const player = IPL_PLAYERS.find(p => p.id === pId);

                if (player) {
                    matchedCount++;
                    const { points, details } = calculatePoints(stats, player.role);
                    matchAggregatedPoints[player.id] = points;

                    if (!playerStatsUpdates[player.id]) playerStatsUpdates[player.id] = { totalPoints: 0, matches: 0 };
                    playerStatsUpdates[player.id].totalPoints += points;
                    playerStatsUpdates[player.id].matches += 1;

                    matchPointWrites.push({
                        id: `${player.id}_${match.id}`,
                        player_id: player.id,
                        player_name: player.name,
                        match_id: match.id,
                        match_name: match.name,
                        points,
                        details,
                        updated_at: now
                    });
                } else {
                    unmapped.push(name);
                }
            }

            console.log(`[AutoUpdate] Summary: Matched ${matchedCount}/${Object.keys(matchPlayers).length} players.`);
            if (unmapped.length > 0) {
                console.log(`[Advice] To fix 0 players matched, add these to explicitMappings: "${unmapped.slice(0, 5).join('", "')}"`);
            }

            if (matchedCount === 0 && Object.keys(matchPlayers).length > 0) {
                console.warn(`[Warning] Found players in API but NONE matched your database. Check normalizeName or explicitMappings.`);
            }

            // Update cumulative player stats for THIS match
            const { data: globalRows, error: globalError } = await supabase
                .from('fantasy_config')
                .select('id, data')
                .in('id', ['playerStats', 'playerPoints']);
            if (globalError) throw globalError;
            const globalData = Object.fromEntries((globalRows || []).map(({ id, data }) => [id, data || {}]));
            const statsData = globalData.playerStats || {};
            const pointsData = globalData.playerPoints || {};

            for (const [pId, updates] of Object.entries(playerStatsUpdates)) {
                statsData[pId] = {
                    ...(statsData[pId] || {}),
                    totalPoints: (Number(statsData[pId]?.totalPoints) || 0) + updates.totalPoints,
                    matches: (Number(statsData[pId]?.matches) || 0) + updates.matches,
                };
                pointsData[pId] = (Number(pointsData[pId]) || 0) + updates.totalPoints;
            }
            statsData.updatedAt = now;
            pointsData.updatedAt = now;

            // Update user squads and leaderboard
            // Note: We use the actual week ID if possible, otherwise a generic one
            const weekId = "Week_1"; // Default for current season
            
            const { data: squads, error: squadsError } = await supabase
                .from('user_squads')
                .select('id, user_id, user_name, players, captain_id, vice_captain_id, raw_data');
            if (squadsError) throw squadsError;
            const profileDeltas = new Map();
            const leaderboardDeltas = new Map();
            for (const row of squads || []) {
                const squad = row.raw_data || {};
                const userId = row.user_id || squad.userId;
                const players = row.players || squad.players || [];
                const captain = row.captain_id || squad.captain;
                const viceCaptain = row.vice_captain_id || squad.viceCaptain;
                const impactPlayer = squad.impactPlayer;
                if (!userId || !Array.isArray(players)) continue;
                
                let matchPointsGained = 0;
                players.forEach(pId => {
                    let pts = matchAggregatedPoints[pId] || 0;
                    if (pId === captain) pts *= 2;
                    else if (pId === viceCaptain) pts *= 1.5;
                    matchPointsGained += pts;
                });
                if (impactPlayer) matchPointsGained += (matchAggregatedPoints[impactPlayer] || 0);

                if (matchPointsGained !== 0) {
                    profileDeltas.set(userId, (profileDeltas.get(userId) || 0) + matchPointsGained);
                    const leaderboardId = `${weekId}_${userId}`;
                    const current = leaderboardDeltas.get(leaderboardId);
                    leaderboardDeltas.set(leaderboardId, {
                        id: leaderboardId,
                        user_id: userId,
                        week_id: weekId,
                        user_name: row.user_name || squad.userName || userId,
                        points_delta: (current?.points_delta || 0) + matchPointsGained,
                    });
                }
            }

            const profileIds = [...profileDeltas.keys()];
            const { data: existingProfiles, error: profilesError } = profileIds.length
                ? await supabase.from('fantasy_profiles').select('id, total_fantasy_points').in('id', profileIds)
                : { data: [], error: null };
            if (profilesError) throw profilesError;
            const profilePoints = new Map((existingProfiles || []).map(({ id, total_fantasy_points }) => [id, Number(total_fantasy_points) || 0]));
            const profileRows = [...profileDeltas].map(([id, pointsDelta]) => ({
                id,
                total_fantasy_points: (profilePoints.get(id) || 0) + pointsDelta,
                updated_at: now,
            }));

            const leaderboardUpdates = [...leaderboardDeltas.values()];
            const { data: existingLeaderboard, error: leaderboardError } = leaderboardUpdates.length
                ? await supabase.from('fantasy_leaderboard')
                    .select('id, weekly_points, total_points')
                    .in('id', leaderboardUpdates.map(({ id }) => id))
                : { data: [], error: null };
            if (leaderboardError) throw leaderboardError;
            const leaderboardPoints = new Map((existingLeaderboard || []).map(({ id, weekly_points, total_points }) => [
                id,
                { weekly: Number(weekly_points) || 0, total: Number(total_points) || 0 },
            ]));
            const leaderboardRows = leaderboardUpdates.map((row) => {
                const existing = leaderboardPoints.get(row.id) || { weekly: 0, total: 0 };
                return {
                    id: row.id,
                    user_id: row.user_id,
                    week_id: row.week_id,
                    user_name: row.user_name,
                    weekly_points: existing.weekly + row.points_delta,
                    total_points: existing.total + row.points_delta,
                    updated_at: now,
                };
            });

            const writes = [
                matchPointWrites.length ? supabase.from('player_match_points').upsert(matchPointWrites) : Promise.resolve({ error: null }),
                supabase.from('fantasy_config').upsert([
                    { id: 'playerStats', data: statsData, updated_at: now },
                    { id: 'playerPoints', data: pointsData, updated_at: now },
                    {
                        id: 'autoUpdateStatus',
                        data: { ...status, lastProcessedMatchDate: match.dateTimeGMT, updatedAt: now },
                        updated_at: now,
                    },
                ]),
                supabase.from('processed_matches').upsert({
                    id: match.id,
                    match_id: match.id,
                    name: match.name,
                    processed_at: now,
                }),
                profileRows.length ? supabase.from('fantasy_profiles').upsert(profileRows) : Promise.resolve({ error: null }),
                leaderboardRows.length ? supabase.from('fantasy_leaderboard').upsert(leaderboardRows) : Promise.resolve({ error: null }),
            ];
            console.log(`[AutoUpdate] Saving ${match.name} to Supabase...`);
            const results = await Promise.all(writes);
            const failedWrite = results.find((result) => result.error);
            if (failedWrite) throw failedWrite.error;
            status.lastProcessedMatchDate = match.dateTimeGMT;
            latestProcessedDate = new Date(match.dateTimeGMT);
            console.log(`[AutoUpdate] Match ${match.name} processed successfully.`);
        }

        console.log(`[Success] Final Check: Processed ${pendingMatches.length} matches. Last Date: ${latestProcessedDate.toISOString()}`);
        process.exit(0);

    } catch (error) {
        console.error("[Error] Auto-update failed:", error);
        process.exit(1);
    }
}

runAutoUpdate();
