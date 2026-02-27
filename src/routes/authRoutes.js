import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.post('/send-otp', authController.sendOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.get('/check-username', authController.checkUsername);
router.get('/profile/:uniqueId', authController.getProfileByUniqueId);

router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, authController.updateProfile);

export default router;