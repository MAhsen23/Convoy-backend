import db from '../config/db.js';

/**
 * User model - CRUD and lookups for users table.
 * unique_id: 7-digit public ID for search/share.
 * username: strictly unique representation.
 */

const USER_PUBLIC_FIELDS = [
    'id',
    'unique_id',
    'username',
    'display_name',
    'email',
    'phone',
    'profile_picture_url',
    'udid',
    'device_info',
    'push_token',
    'status',
    'created_at',
    'updated_at'
];

/**
 * Validate username: 3–30 chars, alphanumeric + underscore
 */
export const validateUsername = (username) => {
    if (typeof username !== 'string') return { valid: false, error: 'Username must be a string' };
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3 || trimmed.length > 30) {
        return { valid: false, error: 'Username must be 3–30 characters' };
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
        return { valid: false, error: 'Username can only contain lowercase letters, numbers and underscores' };
    }
    return { valid: true, username: trimmed };
};

/**
 * Get user by id (internal id)
 */
export const getUserById = async (id) => {
    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

/**
 * Get user by 7-digit unique_id (public ID for search)
 */
export const getByUniqueId = async (uniqueId) => {
    const id = parseInt(uniqueId, 10);
    if (!Number.isInteger(id) || id < 1000000 || id > 9999999) {
        return null;
    }
    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('unique_id', id)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

/**
 * Get user by username (case-insensitive)
 */
export const getByUsername = async (username) => {
    if (typeof username !== 'string') return null;
    const normalized = username.trim().toLowerCase();
    if (!normalized) return null;

    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('username', normalized)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

/**
 * Get user by email
 */
export const getByEmail = async (email) => {
    if (!email || typeof email !== 'string') return null;
    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

/**
 * Get user by phone
 */
export const getByPhone = async (phone) => {
    if (!phone) return null;
    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

/**
 * Check if username is available (not taken)
 */
export const isUsernameAvailable = async (username, excludeUserId = null) => {
    const { valid, username: usernameToCheck } = validateUsername(username);
    if (!valid) return false;

    let query = db
        .from('users')
        .select('id')
        .eq('username', usernameToCheck)
        .limit(1);

    if (excludeUserId) query = query.neq('id', excludeUserId);
    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return !data || data.length === 0;
};

/**
 * Create user (used after OTP verify or register)
 */
export const createUser = async (payload) => {
    const {
        username,
        email,
        phone,
        password_hash,
        display_name,
        profile_picture_url,
        status = 'offline'
    } = payload;

    const { data, error } = await db
        .from('users')
        .insert({
            username: username.trim().toLowerCase(),
            email: email ? email.trim().toLowerCase() : null,
            phone: phone || null,
            password_hash: password_hash || null,
            display_name: display_name || null,
            profile_picture_url: profile_picture_url || null,
            status
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

/**
 * Update user profile (partial update)
 */
export const updateUser = async (userId, updates) => {
    const allowed = [
        'username',
        'display_name',
        'profile_picture_url',
        'udid',
        'device_info',
        'push_token',
        'status',
        'password_hash'
    ];
    const payload = {};
    for (const key of allowed) {
        if (updates[key] !== undefined) payload[key] = updates[key];
    }
    if (Object.keys(payload).length === 0) return await getUserById(userId);

    const { data, error } = await db
        .from('users')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

/**
 * Delete user account
 */
export const deleteUser = async (userId) => {
    const { error } = await db
        .from('users')
        .delete()
        .eq('id', userId);

    if (error) throw new Error(error.message);
    return true;
};

/**
 * Return safe public profile (no password_hash, no internal ids if needed)
 */
export const toPublicProfile = (user) => {
    if (!user) return null;
    const out = {};
    for (const f of USER_PUBLIC_FIELDS) {
        if (user[f] !== undefined) out[f] = user[f];
    }
    return out;
};

/**
 * Get all vehicles for a user (primary first)
 */
export const getUserVehicles = async (userId) => {
    const { data, error } = await db
        .from('vehicles')
        .select('id, model, power, fuel_type, modifications, image_url, is_primary, created_at')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
};