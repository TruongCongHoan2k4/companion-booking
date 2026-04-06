import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import userRoute from './routes/user.route.js';
import authRoute from './routes/auth.route.js';
import companionRoute from './routes/companion.route.js';
import walletRoute from './routes/wallet.route.js';
import bookingRoute from './routes/booking.route.js';
import adminRoute from './routes/admin.route.js';
import companionNotifyRoute from './routes/companionNotify.route.js';
import { configureCloudinary } from './config/cloudinary.config.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';

dotenv.config();
configureCloudinary();

const app = express();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);
app.use('/api/companions', companionRoute);
app.use('/api/companion', companionNotifyRoute);
app.use('/api/wallet', walletRoute);
app.use('/api/bookings', bookingRoute);
app.use('/api/admin', adminRoute);

app.use(errorHandler);

export default app;
