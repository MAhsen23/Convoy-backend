import db from '../config/db.js';
import { emitToUser } from '../socket/io.js';

const XP_PER_KM = Number(process.env.XP_PER_KM || 10);
const MAX_XP_PER_CONVOY = Number(process.env.MAX_XP_PER_CONVOY || 500);

// Simple, deterministic level curve:
// xp required for level n: 100 * (n-1)^2
export const levelForXp = (xpTotal) => {
    const xp = Math.max(0, Number(xpTotal) || 0);
    return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
};

export const xpForLevel = (level) => {
    const lv = Math.max(1, parseInt(level, 10) || 1);
    return 100 * (lv - 1) * (lv - 1);
};

const ensureUserStatsRow = async (userId) => {
    const { data, error } = await db
        .from('user_stats')
        .upsert([{ user_id: userId }], { onConflict: 'user_id' })
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

const getUserStats = async (userId) => {
    const { data, error } = await db.from('user_stats').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

const getUnlockedAchievementKeys = async (userId) => {
    const { data, error } = await db
        .from('user_achievements')
        .select('achievement_key')
        .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return new Set((data || []).map((r) => r.achievement_key));
};

const listActiveAchievementDefinitions = async () => {
    const { data, error } = await db
        .from('achievement_definitions')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};

export const applyXpEvent = async (userId, eventKey, eventType, points, metadata = null) => {
    const safePoints = Math.max(0, parseInt(points, 10) || 0);

    // Insert event first (unique key makes it idempotent)
    const { data: inserted, error: insertErr } = await db
        .from('xp_events')
        .insert({
            user_id: userId,
            event_key: eventKey,
            event_type: eventType,
            points: safePoints,
            metadata
        })
        .select('id')
        .maybeSingle();

    // Duplicate event -> no-op
    if (insertErr) {
        // Postgres unique violation via PostgREST usually returns 409, but supabase-js surfaces message only.
        if (String(insertErr.message || '').toLowerCase().includes('duplicate')) return { applied: false };
        if (String(insertErr.code || '') === '23505') return { applied: false };
        throw new Error(insertErr.message);
    }
    if (!inserted) return { applied: false };

    // Increment user xp_total
    const { data: userRow, error: userErr } = await db
        .from('users')
        .select('xp_total, level')
        .eq('id', userId)
        .single();
    if (userErr) throw new Error(userErr.message);

    const newXpTotal = Math.max(0, Number(userRow.xp_total || 0) + safePoints);
    const newLevel = levelForXp(newXpTotal);
    const { error: updateErr } = await db
        .from('users')
        .update({ xp_total: newXpTotal, level: newLevel, xp_updated_at: new Date().toISOString() })
        .eq('id', userId);
    if (updateErr) throw new Error(updateErr.message);

    emitToUser(userId, 'gamification:progress_updated', {
        user_id: userId,
        xp_total: newXpTotal,
        level: newLevel
    });

    return { applied: true, xp_total: newXpTotal, level: newLevel };
};

export const evaluateAndUnlockAchievementsForUser = async (userId) => {
    await ensureUserStatsRow(userId);
    const stats = (await getUserStats(userId)) || (await ensureUserStatsRow(userId));
    const unlocked = await getUnlockedAchievementKeys(userId);
    const defs = await listActiveAchievementDefinitions();

    const newlyUnlocked = [];

    for (const def of defs) {
        if (unlocked.has(def.key)) continue;

        const metric = def.metric_key;
        const target = Number(def.target_value);
        const current = Number(stats?.[metric] || 0);
        if (!Number.isFinite(target) || target < 0) continue;

        if (current >= target) {
            const { error: insErr } = await db.from('user_achievements').insert({
                user_id: userId,
                achievement_key: def.key,
                xp_awarded: def.xp_reward || 0,
                metadata: { metric_key: metric, target_value: target, current_value: current }
            });
            if (insErr) {
                // Ignore duplicates (race condition)
                if (String(insErr.message || '').toLowerCase().includes('duplicate')) continue;
                if (String(insErr.code || '') === '23505') continue;
                throw new Error(insErr.message);
            }

            newlyUnlocked.push(def);

            if ((def.xp_reward || 0) > 0) {
                await applyXpEvent(
                    userId,
                    `achievement:${def.key}:user:${userId}`,
                    'achievement_unlock',
                    def.xp_reward,
                    { achievement_key: def.key, category: def.category }
                );
            }

            emitToUser(userId, 'gamification:achievement_unlocked', {
                user_id: userId,
                achievement: {
                    key: def.key,
                    category: def.category,
                    title: def.title,
                    description: def.description || null,
                    badge_icon_url: def.badge_icon_url || null,
                    xp_reward: def.xp_reward || 0
                }
            });
        }
    }

    return { newly_unlocked: newlyUnlocked.map((d) => d.key) };
};

export const refreshGarageVehicleCount = async (userId) => {
    await ensureUserStatsRow(userId);
    const { count, error } = await db
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
    if (error) throw new Error(error.message);

    const { error: updErr } = await db.from('user_stats').update({ vehicle_count: count || 0 }).eq('user_id', userId);
    if (updErr) throw new Error(updErr.message);

    await evaluateAndUnlockAchievementsForUser(userId);
};

export const processConvoyEnded = async (convoyId) => {
    // Pull all membership rows (including left) and apply stats per user.
    const { data: members, error: mErr } = await db
        .from('convoy_members')
        .select('user_id, role, status, distance_km')
        .eq('convoy_id', convoyId);
    if (mErr) throw new Error(mErr.message);

    for (const m of members || []) {
        const userId = m.user_id;
        if (!Number.isInteger(userId)) continue;

        await ensureUserStatsRow(userId);
        const deltaKm = Math.max(0, Number(m.distance_km) || 0);

        // Read-modify-write (portable across Supabase/PostgREST setups)
        const stats = (await getUserStats(userId)) || (await ensureUserStatsRow(userId));
        const next = {
            total_distance_km: Number(stats.total_distance_km || 0) + deltaKm,
            convoys_completed: Number(stats.convoys_completed || 0) + 1,
            convoys_led_completed: Number(stats.convoys_led_completed || 0) + (m.role === 'leader' ? 1 : 0),
            vehicle_count: Number(stats.vehicle_count || 0)
        };
        const { error: updErr } = await db.from('user_stats').update(next).eq('user_id', userId);
        if (updErr) throw new Error(updErr.message);

        // Distance-based XP for the convoy itself
        const xp = Math.min(Math.floor(deltaKm * XP_PER_KM), MAX_XP_PER_CONVOY);
        if (xp > 0) {
            await applyXpEvent(userId, `convoy_end:${convoyId}:user:${userId}`, 'convoy_end', xp, {
                convoy_id: convoyId,
                distance_km: deltaKm
            });
        }

        await evaluateAndUnlockAchievementsForUser(userId);
    }
};

export const getGamificationMe = async (userId) => {
    await ensureUserStatsRow(userId);
    const { data: user, error: userErr } = await db
        .from('users')
        .select('id, xp_total, level')
        .eq('id', userId)
        .single();
    if (userErr) throw new Error(userErr.message);

    const stats = (await getUserStats(userId)) || (await ensureUserStatsRow(userId));
    const level = user.level || levelForXp(user.xp_total || 0);
    const xpTotal = Number(user.xp_total || 0);
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);

    return {
        user_id: userId,
        xp_total: xpTotal,
        level,
        current_level_xp: currentLevelXp,
        next_level_xp: nextLevelXp,
        xp_to_next_level: Math.max(0, nextLevelXp - xpTotal),
        stats
    };
};

