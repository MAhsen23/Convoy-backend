import agoraTokenPkg from 'agora-token';

const AgoraToken = agoraTokenPkg?.default || agoraTokenPkg;
const { RtcTokenBuilder, RtcRole } = AgoraToken;

export const generateRtcTokenForUid = ({
    appId,
    appCertificate,
    channelName,
    uid,
    role = 'publisher',
    expirySeconds = 3600
}) => {
    if (!appId || !appCertificate) {
        throw new Error('Agora credentials are not configured');
    }
    if (!channelName) {
        throw new Error('Agora channel name is required');
    }

    const parsedUid = parseInt(uid, 10);
    if (!Number.isInteger(parsedUid) || parsedUid <= 0) {
        throw new Error('Agora uid must be a positive integer');
    }

    const safeExpiry = Math.min(Math.max(parseInt(expirySeconds, 10) || 3600, 60), 86400);
    const now = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = now + safeExpiry;
    const rtcRole = String(role).toLowerCase() === 'subscriber'
        ? RtcRole.SUBSCRIBER
        : RtcRole.PUBLISHER;

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        parsedUid,
        rtcRole,
        privilegeExpireTs
    );

    return {
        token,
        uid: parsedUid,
        role: rtcRole === RtcRole.SUBSCRIBER ? 'subscriber' : 'publisher',
        expires_in_seconds: safeExpiry,
        expires_at: new Date(privilegeExpireTs * 1000).toISOString()
    };
};
