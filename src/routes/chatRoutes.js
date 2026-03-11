import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as chatController from '../controllers/chatController.js';

const router = express.Router();

router.use(authenticate);

router.post('/conversations/messages', chatController.sendMessage);
router.get('/conversations', chatController.listConversations);
router.get('/conversations/:id/messages', chatController.listMessages);
router.patch('/conversations/:id/read', chatController.markRead);

export default router;