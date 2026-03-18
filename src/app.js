import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes.js';
import socialRoutes from './routes/socialRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import garageRoutes from './routes/garageRoutes.js';
import convoyRoutes from './routes/convoyRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import logRoutes from './routes/logRoutes.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb';

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
app.use(requestLogger);

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'OK',
        message: 'Server is running successfully',
        data: {
            uptime: process.uptime(),
            timestamp: Date.now(),
            version: '1.0.0'
        }
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/garage', garageRoutes);
app.use('/api/convoys', convoyRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/logs', logRoutes);

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        status: 'ERROR',
        message: 'API endpoint not found',
        data: null
    });
});

app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            status: 'ERROR',
            message: 'Request payload is too large',
            data: null
        });
    }
    res.status(500).json({
        success: false,
        status: 'ERROR',
        message: 'Something went wrong!',
        data: null
    });
});

export default app;
