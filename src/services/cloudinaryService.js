import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

/**
 * Predefined folder paths for different image types
 */
export const IMAGE_PATHS = {
    USER_PROFILE: 'fastfix/users/profiles',
    GENERAL: 'fastfix/general',
};

/**
 * Default upload options
 */
const DEFAULT_OPTIONS = {
    folder: IMAGE_PATHS.GENERAL,
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [
        {
            quality: 'auto',
            fetch_format: 'auto'
        }
    ]
};

/**
 * Convert base64 string to buffer
 */
const base64ToBuffer = (base64String) => {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
};

/**
 * Convert buffer to stream
 */
const bufferToStream = (buffer) => {
    return Readable.from(buffer);
};

/**
 * Upload a single image to Cloudinary
 * 
 * @param {string|Buffer|Stream} image - Image as base64 string, Buffer, or Stream
 * @param {string} folder - Folder path (use IMAGE_PATHS constants)
 * @param {string} publicId - Optional custom public ID
 * @param {object} options - Additional Cloudinary options
 * @returns {Promise<object>} Upload result with URL and public_id
 */
export const uploadImage = async (image, folder = IMAGE_PATHS.GENERAL, publicId = null, options = {}) => {
    try {
        if (!image) {
            throw new Error('Image is required');
        }

        const uploadOptions = {
            ...DEFAULT_OPTIONS,
            folder,
            ...options
        };

        if (publicId) {
            uploadOptions.public_id = publicId;
        }

        let uploadResult;

        if (typeof image === 'string') {
            if (image.startsWith('data:')) {
                const buffer = base64ToBuffer(image);
                uploadResult = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        uploadOptions,
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    bufferToStream(buffer).pipe(uploadStream);
                });
            } else if (image.startsWith('http://') || image.startsWith('https://')) {
                uploadResult = await cloudinary.uploader.upload(image, uploadOptions);
            } else {
                throw new Error('Invalid image format. Expected base64 string or URL');
            }
        } else if (Buffer.isBuffer(image)) {
            uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    uploadOptions,
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                bufferToStream(image).pipe(uploadStream);
            });
        } else {
            uploadResult = await cloudinary.uploader.upload(image, uploadOptions);
        }

        return {
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
            bytes: uploadResult.bytes,
            created_at: uploadResult.created_at
        };
    } catch (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};

/**
 * Upload multiple images to Cloudinary
 * 
 * @param {Array<string|Buffer|Stream>} images - Array of images
 * @param {string} folder - Folder path (use IMAGE_PATHS constants)
 * @param {object} options - Additional Cloudinary options
 * @returns {Promise<Array<object>>} Array of upload results
 */
export const uploadMultipleImages = async (images, folder = IMAGE_PATHS.GENERAL, options = {}) => {
    try {
        if (!Array.isArray(images) || images.length === 0) {
            throw new Error('Images array is required and cannot be empty');
        }

        const uploadPromises = images.map((image, index) => {
            const publicId = options.publicIdPrefix
                ? `${options.publicIdPrefix}_${index + 1}`
                : null;
            return uploadImage(image, folder, publicId, options);
        });

        const results = await Promise.all(uploadPromises);
        return results;
    } catch (error) {
        throw new Error(`Failed to upload multiple images: ${error.message}`);
    }
};

/**
 * Delete an image from Cloudinary
 * 
 * @param {string} publicId - Public ID of the image to delete
 * @param {string} resourceType - Resource type (default: 'image')
 * @returns {Promise<object>} Deletion result
 */
export const deleteImage = async (publicId, resourceType = 'image') => {
    try {
        if (!publicId) {
            throw new Error('Public ID is required');
        }

        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });

        return result;
    } catch (error) {
        throw new Error(`Failed to delete image: ${error.message}`);
    }
};

/**
 * Delete multiple images from Cloudinary
 * 
 * @param {Array<string>} publicIds - Array of public IDs to delete
 * @param {string} resourceType - Resource type (default: 'image')
 * @returns {Promise<object>} Deletion result
 */
export const deleteMultipleImages = async (publicIds, resourceType = 'image') => {
    try {
        if (!Array.isArray(publicIds) || publicIds.length === 0) {
            throw new Error('Public IDs array is required and cannot be empty');
        }

        const result = await cloudinary.uploader.destroy(publicIds.join(','), {
            resource_type: resourceType
        });

        return result;
    } catch (error) {
        throw new Error(`Failed to delete multiple images: ${error.message}`);
    }
};

/**
 * Extract public ID from Cloudinary URL
 * 
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID or null if invalid URL
 */
export const extractPublicIdFromUrl = (url) => {
    try {
        if (!url || typeof url !== 'string') {
            return null;
        }
        const match = url.match(/\/v\d+\/(.+)\.(jpg|jpeg|png|webp|gif)/i);
        if (match && match[1]) {
            return match[1];
        }

        return null;
    } catch (error) {
        return null;
    }
};

/**
 * Upload image with specific transformations
 * 
 * @param {string|Buffer|Stream} image - Image to upload
 * @param {string} folder - Folder path
 * @param {object} transformations - Cloudinary transformation options
 * @param {object} options - Additional options
 * @returns {Promise<object>} Upload result
 */
export const uploadImageWithTransformations = async (
    image,
    folder = IMAGE_PATHS.GENERAL,
    transformations = {},
    options = {}
) => {
    const transformOptions = {
        width: transformations.width,
        height: transformations.height,
        crop: transformations.crop || 'limit',
        aspect_ratio: transformations.aspectRatio,
        gravity: transformations.gravity || 'auto',
        quality: transformations.quality || 'auto',
        format: transformations.format || 'auto',
        ...transformations
    };

    return uploadImage(image, folder, null, {
        transformation: [transformOptions],
        ...options
    });
};

/**
 * Helper function to upload user profile picture
 */
export const uploadUserProfile = async (image, userId = null) => {
    const publicId = userId ? `user_${userId}` : null;
    return uploadImage(image, IMAGE_PATHS.USER_PROFILE, publicId, {
        width: 400,
        height: 400,
        crop: 'fill',
        gravity: 'face'
    });
};
