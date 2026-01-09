import { Handler, HandlerEvent } from "@netlify/functions";

/**
 * Netlify serverless function to proxy requests to TheGamesDB API
 * This solves CORS issues by making API calls from the server side
 */
const handler: Handler = async (event: HandlerEvent) => {
  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  try {
    // Get the path after /api/thegamesdb/
    const path = event.path.replace("/.netlify/functions/thegamesdb-proxy/", "");
    
    // Build the target URL
    const targetUrl = `https://api.thegamesdb.net/v1/${path}${event.rawQuery ? '?' + event.rawQuery : ''}`;
    
    console.log("Proxying request to:", targetUrl);

    // Make the request to TheGamesDB API
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "MySwitchLibrary/1.0",
      },
    });

    if (!response.ok) {
      console.error("TheGamesDB API error:", response.status, response.statusText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: `TheGamesDB API error: ${response.status} ${response.statusText}` 
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    };
  } catch (error) {
    console.error("Proxy error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to proxy request",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};

export { handler };
