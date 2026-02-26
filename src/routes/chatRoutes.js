import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as chatController from '../controllers/chatController.js';

const router = express.Router();

router.use(authenticate);

router.post('/direct/:userId', chatController.createOrGetDirectConversation);
router.get('/conversations', chatController.listConversations);
router.get('/conversations/:id/messages', chatController.listMessages);
router.post('/conversations/:id/messages', chatController.sendMessage);
router.patch('/conversations/:id/read', chatController.markRead);

export default router;
