import app from './app.js';
import config from './config/config.js';
import { print } from './helpers/helpers.js';
import http from 'http';
import { initSocket } from './socket/io.js';
import { startHazardExpiryJob } from './services/hazardService.js';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (!isVercel) {
    const PORT = config.port;

    try {
        import('./config/db.js').then(() => {
            print('Supabase client initialized successfully.');

            const server = http.createServer(app);
            initSocket(server);
            startHazardExpiryJob();

            server.listen(PORT, () => {
                print(`Convoy server running in ${config.env} mode on port ${PORT}`);
            });
        }).catch((err) => {
            print('Failed to initialize Supabase', err.message);
            process.exit(1);
        });
    } catch (err) {
        print('Failed to start server', err.message);
        process.exit(1);
    }
}

export default app;
