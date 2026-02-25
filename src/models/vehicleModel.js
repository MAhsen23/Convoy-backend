import db from '../config/db.js';

/**
 * Vehicle (garage) model – CRUD for user vehicles. One primary per user.
 */

export const getByUserId = async (userId) => {
    const { data, error } = await db
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
};

export const getById = async (id) => {
    const { data, error } = await db
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

export const getByIdAndUserId = async (id, userId) => {
    const { data, error } = await db
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

export const getPrimaryByUserId = async (userId) => {
    const { data, error } = await db
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
};

export const create = async (payload) => {
    const { user_id, model, power, fuel_type, modifications, image_url, is_primary = false } = payload;

    const { data, error } = await db
        .from('vehicles')
        .insert({
            user_id,
            model: model?.trim() || '',
            power: power != null ? String(power).trim() : null,
            fuel_type: fuel_type != null ? String(fuel_type).trim() : null,
            modifications: modifications != null ? String(modifications).trim() : null,
            image_url: image_url != null ? String(image_url).trim() : null,
            is_primary: Boolean(is_primary)
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

export const update = async (id, userId, updates) => {
    const allowed = ['model', 'power', 'fuel_type', 'modifications', 'image_url', 'is_primary'];
    const payload = {};
    for (const key of allowed) {
        if (updates[key] !== undefined) {
            if (key === 'is_primary') payload[key] = Boolean(updates[key]);
            else if (key === 'image_url') payload[key] = updates[key] != null ? String(updates[key]).trim() : null;
            else if (typeof updates[key] === 'string') payload[key] = updates[key].trim();
            else payload[key] = updates[key];
        }
    }
    if (Object.keys(payload).length === 0) return await getByIdAndUserId(id, userId);

    const { data, error } = await db
        .from('vehicles')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

export const remove = async (id, userId) => {
    const { error } = await db
        .from('vehicles')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) throw new Error(error.message);
};

export const toPublicVehicle = (vehicle) => {
    if (!vehicle) return null;
    const { user_id, ...rest } = vehicle;
    return rest;
};
