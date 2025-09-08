// Vercel serverless function for health check
export default function handler(req, res) {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: 'vercel',
    nodeVersion: process.version,
    environment: process.env.VERCEL_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown',
    deployment: {
      url: process.env.VERCEL_URL || 'localhost',
      git: {
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
        commitRef: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
        repoOwner: process.env.VERCEL_GIT_REPO_OWNER || 'unknown',
        repoSlug: process.env.VERCEL_GIT_REPO_SLUG || 'unknown'
      }
    }
  };

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Return health data
  res.status(200).json(healthData);
}