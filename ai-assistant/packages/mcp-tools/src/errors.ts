/**
 * Typed error classes for MCP tool execution.
 */

export class ToolExecutionError extends Error {
    public readonly toolName: string;
    public readonly statusCode: number;

    constructor(toolName: string, message: string, statusCode: number = 500) {
        super(message);
        this.name = 'ToolExecutionError';
        this.toolName = toolName;
        this.statusCode = statusCode;
    }
}

export class TokenNotFoundError extends ToolExecutionError {
    constructor(toolName: string, provider: string) {
        super(toolName, `No ${provider} OAuth connection found. Please connect your ${provider} account first.`, 401);
        this.name = 'TokenNotFoundError';
    }
}

export class TokenRefreshError extends ToolExecutionError {
    constructor(toolName: string, provider: string, reason: string) {
        super(toolName, `Failed to refresh ${provider} token: ${reason}`, 401);
        this.name = 'TokenRefreshError';
    }
}

export class IntegrationAPIError extends ToolExecutionError {
    public readonly provider: string;
    public readonly apiStatusCode: number;

    constructor(toolName: string, provider: string, apiStatusCode: number, message: string) {
        super(toolName, `${provider} API error (${apiStatusCode}): ${message}`, apiStatusCode);
        this.name = 'IntegrationAPIError';
        this.provider = provider;
        this.apiStatusCode = apiStatusCode;
    }
}
