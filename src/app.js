import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes.js';
import garageRoutes from './routes/garageRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use('/api/garage', garageRoutes);
app.use('/api/upload', uploadRoutes);

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        status: 'ERROR',
        message: 'API endpoint not found',
        data: null
    });
});

app.use((err, req, res, next) => {
    res.status(500).json({
        success: false,
        status: 'ERROR',
        message: 'Something went wrong!',
        data: null
    });
});

export default app;
