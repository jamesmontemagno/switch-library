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
    // Extract the API path from the event
    // When called via redirect from /api/thegamesdb/*, the path will be /.netlify/functions/thegamesdb-proxy/*
    // We need to extract everything after the function name
    let apiPath = "";
    
    if (event.path.includes("/.netlify/functions/thegamesdb-proxy/")) {
      apiPath = event.path.split("/.netlify/functions/thegamesdb-proxy/")[1] || "";
    } else if (event.path.includes("/.netlify/functions/thegamesdb-proxy")) {
      // If there's no trailing slash and path, check rawUrl
      const rawUrl = event.rawUrl || "";
      const match = rawUrl.match(/\/api\/thegamesdb\/(.*?)(?:\?|$)/);
      if (match) {
        apiPath = match[1];
      }
    }
    
    // Build the target URL
    const targetUrl = `https://api.thegamesdb.net/v1/${apiPath}${event.rawQuery ? '?' + event.rawQuery : ''}`;
    
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
