import db from '../config/db.js';
import {
    evaluateAndUnlockAchievementsForUser,
    getGamificationMe
} from '../services/gamificationService.js';

export const getMe = async (req, res) => {
    try {
        void evaluateAndUnlockAchievementsForUser(req.user.id);
        const progression = await getGamificationMe(req.user.id);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { progression }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to load progression',
            data: null
        });
    }
};

export const listAchievements = async (req, res) => {
    try {
        const { data, error } = await db
            .from('achievement_definitions')
            .select(
                'key, category, title, description, badge_icon_url, xp_reward, metric_key, target_value, is_active, sort_order'
            )
            .eq('is_active', true)
            .order('category', { ascending: true })
            .order('sort_order', { ascending: true });
        if (error) throw new Error(error.message);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { achievements: data || [] }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list achievements',
            data: null
        });
    }
};

export const getMyAchievements = async (req, res) => {
    try {
        await evaluateAndUnlockAchievementsForUser(req.user.id);

        const { data: unlocked, error: uErr } = await db
            .from('user_achievements')
            .select('achievement_key, unlocked_at, xp_awarded, metadata')
            .eq('user_id', req.user.id)
            .order('unlocked_at', { ascending: false });
        if (uErr) throw new Error(uErr.message);

        const progression = await getGamificationMe(req.user.id);

        return res.status(200).json({
            success: true,
            status: 'OK',
            data: {
                unlocked: unlocked || [],
                stats: progression.stats
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to load achievements',
            data: null
        });
    }
};

