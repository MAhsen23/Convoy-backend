import db from '../config/db.js';

/**
 * User model - CRUD and lookups for users table.
 * unique_id: 9-digit public ID for search/share.
 * username: unique case-insensitive via username_normalized.
 */

const USER_PUBLIC_FIELDS = [
    'id',
    'unique_id',
    'username',
    'email',
    'phone',
    'profile_picture_url',
    'status',
    'role',
    'created_at',
    'updated_at'
];

/**
 * Normalize username for uniqueness (lowercase, trim)
 */
export const normalizeUsername = (username) => {
    if (typeof username !== 'string') return '';
    return username.trim().toLowerCase();
};

/**
 * Validate username: 3–30 chars, alphanumeric + underscore
 */
export const validateUsername = (username) => {
    const normalized = normalizeUsername(username);
    if (normalized.length < 3 || normalized.length > 30) {
        return { valid: false, error: 'Username must be 3–30 characters' };
    }
    if (!/^[a-z0-9_]+$/.test(normalized)) {
        return { valid: false, error: 'Username can only contain letters, numbers and underscores' };
    }
    return { valid: true, normalized };
};

/**
 * Get user by UUID (internal id)
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
 * Get user by 9-digit unique_id (public ID for search)
 */
export const getByUniqueId = async (uniqueId) => {
    const id = parseInt(uniqueId, 10);
    if (!Number.isInteger(id) || id < 100000000 || id > 999999999) {
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
    const normalized = normalizeUsername(username);
    if (!normalized) return null;

    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('username_normalized', normalized)
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
    const { valid, normalized } = validateUsername(username);
    if (!valid) return false;

    let query = db
        .from('users')
        .select('id')
        .eq('username_normalized', normalized)
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
        username_normalized,
        email,
        phone,
        password_hash,
        profile_picture_url,
        status = 'offline',
        role = 'user'
    } = payload;

    const { data, error } = await db
        .from('users')
        .insert({
            username: username.trim(),
            username_normalized,
            email: email ? email.trim().toLowerCase() : null,
            phone: phone || null,
            password_hash: password_hash || null,
            profile_picture_url: profile_picture_url || null,
            status,
            role
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
        'username_normalized',
        'profile_picture_url',
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
