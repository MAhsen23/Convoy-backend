import multer from 'multer';
import { IMAGE_PATHS } from '../services/cloudinaryService.js';

/**
 * Configure multer for memory storage
 * Files will be stored in memory as Buffer objects
 */
const storage = multer.memoryStorage();

/**
 * File filter to accept only images
 */
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'), false);
    }
};

/**
 * Multer configuration
 */
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10
    }
});

export const uploadSingle = (fieldName = 'image') => {
    return upload.single(fieldName);
};

export const uploadMultiple = (fieldName = 'images', maxCount = 10) => {
    return upload.array(fieldName, maxCount);
};

export const uploadFields = (fields) => {
    return upload.fields(fields);
};

export default upload;

