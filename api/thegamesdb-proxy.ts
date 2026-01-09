import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Helper function to convert query parameters to a clean record
 */
function normalizeQueryParams(params: Record<string, string | string[]>): Record<string, string> {
  return Object.entries(params).reduce((acc, [key, value]) => {
    acc[key] = Array.isArray(value) ? value[0] : value || '';
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Vercel serverless function to proxy requests to TheGamesDB API
 * This solves CORS issues by making API calls from the server side
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the path and query from the request
    const { path, ...queryParams } = req.query;
    
    // Build the query string
    const queryString = new URLSearchParams(normalizeQueryParams(queryParams)).toString();
    
    // Build the target URL
    const pathStr = Array.isArray(path) ? path.join('/') : path || '';
    const targetUrl = `https://api.thegamesdb.net/v1/${pathStr}${queryString ? '?' + queryString : ''}`;
    
    console.log('Proxying request to:', targetUrl);

    // Make the request to TheGamesDB API
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'MySwitchLibrary/1.0',
      },
    });

    if (!response.ok) {
      console.error('TheGamesDB API error:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `TheGamesDB API error: ${response.status} ${response.statusText}` 
      });
    }

    const data = await response.json();

    // Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
