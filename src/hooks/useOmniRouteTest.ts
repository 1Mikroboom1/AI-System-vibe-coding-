/**
 * Hook for testing provider connections
 * Provides connection status checking with detailed error information
 */

import { useState, useCallback } from "react";
import type { SupportedProvider } from "../lib/providers";

export interface ConnectionTestResult {
  status: "idle" | "testing" | "connected" | "error" | "unreachable";
  message: string;
  details?: string;
}

export interface ProviderConnectionTestRequest {
  provider: SupportedProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

const initialState: ConnectionTestResult = {
  status: "idle",
  message: ""
};

export function useOmniRouteTest() {
  const [result, setResult] = useState<ConnectionTestResult>(initialState);
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = useCallback(
    async (request: ProviderConnectionTestRequest): Promise<ConnectionTestResult> => {
      if (!request.provider) {
        const errorResult = {
          status: "error" as const,
          message: "Provider is required"
        };
        setResult(errorResult);
        return errorResult;
      }

      setIsLoading(true);
      setResult({ status: "testing", message: "Testing connection..." });

      try {
        const response = await fetch("http://localhost:5000/api/providers/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request)
        });

        const data = (await response.json()) as {
          success: boolean;
          status: "connected" | "error" | "unreachable";
          message: string;
          details?: string;
        };

        const result: ConnectionTestResult = {
          status: data.status,
          message: data.message,
          details: data.details
        };

        setResult(result);
        return result;
      } catch (error) {
        const errorResult: ConnectionTestResult = {
          status: "error",
          message: "Network error - could not reach backend",
          details: error instanceof Error ? error.message : String(error)
        };
        setResult(errorResult);
        return errorResult;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(initialState);
  }, []);

  return {
    result,
    isLoading,
    testConnection,
    reset
  };
}
