import dotenv from 'dotenv';
dotenv.config();

export default {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '30d',
    bypassOTP: process.env.BYPASS_OTP === 'true' || process.env.BYPASS_OTP === true || process.env.NODE_ENV === 'development',
    logToDatabase: process.env.LOG_TO_DATABASE === 'true',
    logAllRequests: process.env.LOG_ALL_REQUESTS === 'true',
    logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 90,
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    },
};