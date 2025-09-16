import { Request } from 'express';

// Utility to detect if request is coming from a proxy/VPN or cloud environment
export const detectProxyEnvironment = (req?: Request): boolean => {
  if (!req) return false;
  
  const proxyHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-forwarded-proto',
    'x-forwarded-host',
    'x-original-forwarded-for',
    'client-ip',
    'x-client-ip',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded',
    'via'
  ];
  
  // Check for common proxy/VPN headers
  const hasProxyHeaders = proxyHeaders.some(header => 
    req.headers[header] && 
    req.headers[header] !== req.ip
  );
  
  return hasProxyHeaders;
};

// Get environment information for logging
export const getEnvironmentInfo = (req?: Request) => {
  const isRender = !!(process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME);
  const isHeroku = !!process.env.DYNO;
  const isVercel = !!process.env.VERCEL;
  const isNetlify = !!process.env.NETLIFY;
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cloudProvider = isRender ? 'Render' : 
                       isHeroku ? 'Heroku' : 
                       isVercel ? 'Vercel' : 
                       isNetlify ? 'Netlify' : 
                       'Unknown';
  
  return {
    isCloudDeployment: isRender || isHeroku || isVercel || isNetlify,
    cloudProvider,
    isProduction,
    hasProxyDetected: req ? detectProxyEnvironment(req) : false,
    userAgent: req?.headers['user-agent'] || 'Unknown',
    ip: req?.ip || 'Unknown'
  };
};

// Check if the current environment is likely to trigger abuse detection
export const isHighRiskEnvironment = (req?: Request): boolean => {
  const envInfo = getEnvironmentInfo(req);
  
  // High risk if:
  // 1. Running on cloud platform (shared IPs)
  // 2. Has proxy headers detected
  // 3. Is in production (often uses load balancers)
  return envInfo.isCloudDeployment || envInfo.hasProxyDetected;
};