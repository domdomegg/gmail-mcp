// Gmail API configuration and utilities

export const GMAIL_API_BASE_URL = 'https://gmail.googleapis.com/gmail/v1';

// Common helper to create base headers
function createBaseHeaders(accessToken: string): Record<string, string> {
	return {
		Authorization: `Bearer ${accessToken}`,
		Accept: 'application/json',
	};
}

// Common helper to handle API errors
async function handleApiError(response: Response): Promise<never> {
	const errorText = await response.text();
	throw new Error(`Gmail API error: ${response.status} ${response.statusText} - ${errorText}`);
}

// Common helper to parse response based on content type
async function parseResponse(response: Response): Promise<unknown> {
	if (!response.ok) {
		await handleApiError(response);
	}

	const contentType = response.headers.get('content-type');

	if (contentType?.includes('application/json')) {
		const responseText = await response.text();

		if (!responseText.trim()) {
			return {success: true, message: 'Operation completed successfully'};
		}

		try {
			return JSON.parse(responseText);
		} catch (error) {
			throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	return (await response.text()) || 'Success';
}

// Utility function to make authenticated API calls
export async function makeGmailApiCall(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
	endpoint: string,
	accessToken: string,
	body?: unknown,
) {
	const url = `${GMAIL_API_BASE_URL}${endpoint}`;
	const headers = createBaseHeaders(accessToken);

	if (body) {
		headers['Content-Type'] = 'application/json';
	}

	const fetchOptions: RequestInit = {
		method,
		headers,
	};

	if (body) {
		fetchOptions.body = JSON.stringify(body);
	}

	const response = await fetch(url, fetchOptions);
	return parseResponse(response);
}
