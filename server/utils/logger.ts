/**
 * Logger utility for the Bosta Insights Hub
 * Provides structured logging with different levels
 */

import _ from 'lodash';
import winston from 'winston';
import expressWinston from 'express-winston';
import { Request, Response, NextFunction } from 'express';

// Environment constants
const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TESTING: 'testing'
} as const;

// Get environment from NODE_ENV
const environment = process.env.NODE_ENV || 'development';

// Simple async local storage mock (since we don't have the external dependency)
const asyncLocalStorage = {
  getStore: () => {
    // Generate a simple request ID
    return Math.random().toString(36).substring(2, 15);
  }
};

class Logger {
  private logger: winston.Logger;
  public expressWinstonMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  public expressWinstonErrorMiddleware: (error: Error, req: Request, res: Response, next: NextFunction) => void;

  constructor() {
    let level: string;
    let silent: boolean;

    switch (environment) {
      case 'production':
      case 'staging':
        level = 'info';
        silent = false;
        break;
      case 'testing':
        level = 'error';
        silent = false;
        break;
      case 'development':
        level = 'debug';
        silent = false;
        break;
      default:
        level = 'error';
        silent = true;
        break;
    }

    this.logger = winston.createLogger({
      level,
      silent,
      defaultMeta: {
        service: 'bosta-insights-hub',
        version: '2.0.0'
      },
      transports: [
        new winston.transports.Console({
          handleExceptions: true,
          format: winston.format.combine(
            winston.format.colorize({ all: environment === 'development' }),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              if (environment === 'development') {
                return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
              }
              return JSON.stringify({ timestamp, level, message, ...meta });
            })
          )
        })
      ],
      exitOnError: false
    });

    // Express Winston middleware for request logging
    this.expressWinstonMiddleware = expressWinston.logger({
      winstonInstance: this.logger,
      metaField: null,
      requestWhitelist: ['headers', 'query', 'body', 'originalBody'],
      responseWhitelist: ['body'],
      expressFormat: true,
      colorize: false,
      statusLevels: false,
      requestFilter: (req: any, propName: string) => {
        if (propName === 'body') {
          // Remove sensitive data from logs
          if (_.has(req.body, 'password')) delete req.body.password;
          if (_.has(req.body, 'token')) delete req.body.token;
          if (_.has(req.body, 'secret')) delete req.body.secret;

          // Remove large attachments for specific routes
          if (req.path && req.path.match('/api/.*')) {
            delete req.body.attachments;
            delete req.body.files;
          }
        }
        return req[propName];
      },
      responseFilter: (res: any, propName: string) => {
        if (propName === 'body') {
          // Don't log response bodies to reduce noise
          // delete res.body;
        }
        return res[propName];
      },
      ignoreRoute: (req: any, _res: any) => {
        // Ignore health checks and static files
        if (
            req.path === '/api/health' ||
            req.path === '/api/debug' ||
            req.path === '/'
        ) return true;


        if (
            req.path.startsWith('/static') ||
            req.path.startsWith('/assets') ||
            req.path.startsWith('/')
        ) return true;

        if (req.method === 'OPTIONS') return true;

        if (
            req.path.endsWith('.svg') ||
            req.path.endsWith('.ico') ||
            req.path.endsWith('.png')
        ) return true;

        return false;
      },
      level: (_req: any, res: any) => {
        let logLevel = 'info';
        if (res.statusCode >= 500) logLevel = 'error';
        else if (res.statusCode >= 400) logLevel = 'warn';
        return logLevel;
      },
      dynamicMeta: (req: any, res: any) => {
        const httpRequest: any = {};
        const meta: any = {};

        if (req) {
          meta.httpRequest = httpRequest;
          httpRequest.requestMethod = req.method;
          httpRequest.requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          httpRequest.protocol = `HTTP/${req.httpVersion}`;
          httpRequest.remoteIp = req.ip || req.connection?.remoteAddress;
          httpRequest.userAgent = req.get('User-Agent');
          httpRequest.referrer = req.get('Referrer');

          meta.user = req.user;
        }

        if (res) {
          httpRequest.status = res.statusCode;
          httpRequest.latency = {
            seconds: Math.floor(res.responseTime / 1000),
            nanos: (res.responseTime % 1000) * 1000000
          };
        }

        meta.labels = { reqId: asyncLocalStorage.getStore() };
        return meta;
      }
    });

    // Express Winston error middleware
    this.expressWinstonErrorMiddleware = expressWinston.errorLogger({
      winstonInstance: this.logger,
      metaField: null,
      requestWhitelist: ['headers', 'query', 'body'],
      msg: '{{req.method}} {{req.path}} {{err.message}}',
      requestFilter: (req: any, propName: string) => {
        if (propName === 'body') {
          if (_.has(req.body, 'password')) delete req.body.password;
          if (_.has(req.body, 'token')) delete req.body.token;
        }
        return req[propName];
      },
      dynamicMeta: (req: any, res: any, err: any) => {
        const httpRequest: any = {};
        const meta: any = {};

        if (req) {
          meta.httpRequest = httpRequest;
          httpRequest.requestMethod = req.method;
          httpRequest.requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          httpRequest.protocol = `HTTP/${req.httpVersion}`;
          httpRequest.remoteIp = req.ip || req.connection?.remoteAddress;
          httpRequest.userAgent = req.get('User-Agent');
          httpRequest.referrer = req.get('Referrer');
          meta.user = req.user;
        }

        if (res) {
          httpRequest.status = res.statusCode;
          httpRequest.latency = {
            seconds: Math.floor(res.responseTime / 1000),
            nanos: (res.responseTime % 1000) * 1000000
          };
        }

        if (err) {
          httpRequest.status = err.status || 500;
          meta.error = {
            message: err.message,
            stack: err.stack,
            name: err.name
          };
        }

        meta.labels = { reqId: asyncLocalStorage.getStore() };
        return meta;
      },
      skip: (_req: any, _res: any) => {
        return environment !== ENVIRONMENTS.DEVELOPMENT;
      }
    });
  }

  info(message: string, meta?: any) {
    return this.logger.info(message, {
      ...meta,
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  error(message: string, error?: Error | any, meta?: any) {
    const errorMeta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : { error };

    return this.logger.error(message, {
      ...errorMeta,
      ...meta,
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  debug(message: string, meta?: any) {
    return this.logger.debug(message, {
      ...meta,
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  warn(message: string, meta?: any) {
    return this.logger.warn(message, {
      ...meta,
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  // Convenience method for database logs
  db(message: string, meta?: any) {
    return this.logger.info(`[DB] ${message}`, {
      ...meta,
      component: 'database',
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  // Convenience method for authentication logs
  auth(message: string, meta?: any) {
    return this.logger.info(`[AUTH] ${message}`, {
      ...meta,
      component: 'authentication',
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  // Convenience method for agent logs
  agent(message: string, meta?: any) {
    return this.logger.info(`[AGENT] ${message}`, {
      ...meta,
      component: 'agent',
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  // Generic log method
  log(level: string, message: string, meta?: any) {
    return this.logger.log(level, message, {
      ...meta,
      labels: {
        reqId: asyncLocalStorage.getStore()
      }
    });
  }

  getExpressWinstonMiddleware() {
    return this.expressWinstonMiddleware;
  }

  getExpressWinstonErrorMiddleware() {
    return this.expressWinstonErrorMiddleware;
  }
}

// Create and freeze the logger instance
const logger = Object.freeze(new Logger());

export { logger };
export default logger;
