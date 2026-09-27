# OmniRoute Integration Guide

## Overview

The application now supports OmniRoute as a provider for connecting to multiple AI services. This guide explains how to properly configure and test the connection.

## Configuration

### 1. **Base URL**
- **What**: The root URL of your OmniRoute instance
- **Format**: `http://localhost:20128/v1` or `https://your-domain:port/v1`
- **Important**: 
  - Must include the `/v1` path (OmniRoute API version)
  - Supports both `localhost` and `127.0.0.1`
  - Port can be any configured port (default: 20128)
  - HTTPS is supported for remote instances

### 2. **API Key**
- **Format**: OmniRoute API keys typically start with `sk-` (e.g., `<OMNIROUTE_API_KEY>`)
- **Security**: Keys are stored locally on your machine, never sent to external servers
- **Bearer Token**: Keys are sent as `Authorization: Bearer <key>` in requests

### 3. **Testing Connection**
Click the **"Test Connection"** button in Settings to verify:
- ✅ OmniRoute server is running and reachable
- ✅ Base URL is correctly formatted
- ✅ API Key is valid and has proper permissions
- ✅ Network connectivity is working

## API Implementation

### Request Format

All requests to OmniRoute follow the **OpenAI-compatible** format:

```typescript
POST ${baseUrl}/chat/completions
```

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer ${apiKey}"
}
```

**Request Body:**
```json
{
  "model": "model-name",
  "messages": [
    { "role": "user", "content": "Your question" }
  ],
  "max_tokens": 512,
  "temperature": 0.7
}
```

**Response Format:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Response text"
      }
    }
  ]
}
```

## Troubleshooting

### Connection Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot resolve hostname" | OmniRoute server not running | Start OmniRoute: `omniroute` |
| "Connection refused" | Server not listening on port | Check port in Base URL (default: 20128) |
| "Invalid Base URL format" | Malformed URL | Use format: `http://localhost:20128/v1` |
| "API Key is invalid" | Wrong credentials | Get new key from OmniRoute dashboard |
| "Non-JSON response" | Base URL points to website | Ensure URL includes `/v1` path |

### Configuration Issues

1. **Base URL shows website instead of API**
   - Add `/v1` to end of URL if missing
   - Don't include model names in base URL

2. **Port is different**
   - Check OmniRoute config for actual port
   - Update Base URL to match (e.g., `http://localhost:9999/v1`)

3. **localhost vs 127.0.0.1**
   - Both formats are supported
   - Choose whichever works in your environment

## Code Examples

### Using sendMessage Function

```typescript
import { sendMessage } from "../lib/providers";

const response = await sendMessage(
  "http://localhost:20128/v1",
  "<OMNIROUTE_API_KEY>",
  {
    model: "gpt-3.5-turbo",
    messages: [
      { role: "user", content: "Hello" }
    ]
  }
);

console.log(response); // "Response from OmniRoute"
```

### Testing Connection

```typescript
import { testOmniRouteConnection } from "../lib/providers";

const result = await testOmniRouteConnection(
  "http://localhost:20128/v1",
  "<OMNIROUTE_API_KEY>"
);

if (result.status === "connected") {
  console.log("✅", result.message);
} else {
  console.error("❌", result.message);
  console.error("Details:", result.details);
}
```

### React Hook for Testing

```typescript
import { useOmniRouteTest } from "../hooks/useOmniRouteTest";

function MyComponent() {
  const { result, isLoading, testConnection } = useOmniRouteTest();

  return (
    <>
      <button onClick={() => testConnection(baseUrl, apiKey)}>
        {isLoading ? "Testing..." : "Test Connection"}
      </button>
      
      {result.status === "connected" && (
        <p className="text-green-600">✅ Connected!</p>
      )}
      
      {result.status === "error" && (
        <div>
          <p className="text-red-600">❌ {result.message}</p>
          {result.details && <p className="text-xs">{result.details}</p>}
        </div>
      )}
    </>
  );
}
```

## Files Changed

1. **src/lib/providers.ts** (NEW)
   - Core integration: `sendMessage()`, `testOmniRouteConnection()`
   - Type definitions: `Provider`, `OpenAIChatRequest`, `OpenAIChatResponse`
   - Utilities: `normalizeBaseUrl()`, `normalizeApiKey()`

2. **src/hooks/useOmniRouteTest.ts** (NEW)
   - React hook for connection testing UI

3. **src/server/server.ts** (MODIFIED)
   - Imports from new providers module
   - Simplified `callOmniRoute()` function
   - New `/api/omniroute/test` endpoint
   - Updated default BASE URL to `localhost:20128`

4. **src/components/pages/SettingsPage.tsx** (MODIFIED)
   - Added connection test UI
   - Test button with loading state
   - Real-time status display
   - Better error messages

## Security Notes

- ✅ All credentials are stored locally on your machine
- ✅ Keys are only sent to your configured OmniRoute instance
- ✅ Never shares data with external services
- ✅ Supports HTTPS for secure remote connections
- ⚠️ Protect your OmniRoute instance with authentication
- ⚠️ Don't commit API keys to version control

## Performance Tips

1. **Connection Pooling**: OmniRoute handles connection pooling internally
2. **Timeouts**: Adjust max_tokens based on expected response length
3. **Temperature**: Use 0.0 for deterministic outputs, up to 1.0 for creative responses
4. **Streaming**: Set `stream: true` in request for real-time responses (if needed)

## Next Steps

1. ✅ Install and run OmniRoute
2. ✅ Configure upstream providers in OmniRoute dashboard
3. ✅ Get OmniRoute API key from dashboard
4. ✅ Enter Base URL and API Key in Settings
5. ✅ Click "Test Connection" to verify
6. ✅ Start chatting!
