import { HttpStatusCode } from 'axios';
import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HttpStatusCode.TooManyRequests).json({
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(HttpStatusCode.TooManyRequests).json({
      message:
        'Too many authentication attempts. Please try again after 15 minutes.',
    });
  },
});

export const expensiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(HttpStatusCode.TooManyRequests).json({
      message:
        'You have reached the maximum number of generations per hour.',
      retryAfter: '1 hour',
    });
  },
});


export const standardLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  handler: (req, res) => {
    res.status(HttpStatusCode.TooManyRequests).json({
      message: 'Too many requests, please slow down.',
    });
  },
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) =>
    (req.headers['x-revenuecat-signature'] as string) || (req.ip as string),
  handler: (req, res) => {
    res.status(HttpStatusCode.TooManyRequests).json({
      message: 'Webhook rate limit exceeded.',
    });
  },
});

export const limiter = globalLimiter;
