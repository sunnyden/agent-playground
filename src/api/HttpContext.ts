import { IHttpContext } from './interface/HttpContext.interface';
import { ApiResponse } from './interface/data/common/ApiResponse';

export class HttpContext implements IHttpContext {
  private authHeader: string;
  constructor(private baseUrl: string) {
    if (!baseUrl) {
      throw Error('baseUrl is required!');
    }
    this.authHeader = '';
  }
  public async get<T>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(this.baseUrl + url, {
      method: 'GET',
      headers: {
        Authorization: this.authHeader,
      },
    });
    return response.json();
  }

  public async post<P, T>(url: string, payload: P): Promise<ApiResponse<T>> {
    const response = await fetch(this.baseUrl + url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  public async *postStream<P, T>(url: string, payload: P): AsyncGenerator<T> {
    console.log('Starting SSE connection to:', this.baseUrl + url);

    const response = await fetch(this.baseUrl + url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: JSON.stringify(payload),
      // Important: for streaming responses
      cache: 'no-store',
      // Ensure we don't buffer the response
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Use TextDecoderStream to convert the binary data to text
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();

    // Buffer to hold partial lines
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        // Add new data to the buffer
        buffer += value;

        // Process complete lines in the buffer
        const lines = buffer.split('\n');

        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || '';

        // Process each complete line
        for (const line of lines) {
          // Skip empty lines and SSE comments (lines starting with ":")
          if (line.trim() === '' || line.startsWith(':')) {
            continue;
          }

          let jsonData = line;
          // Handle the data: prefix in SSE
          if (line.startsWith('data:')) {
            jsonData = line.substring(5).trim();
          }

          try {
            if (jsonData.trim()) {
              const parsedData = JSON.parse(jsonData);
              yield parsedData;
            }
          } catch (e) {
            console.error('Error parsing JSON from stream:', e, jsonData);
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        let jsonData = buffer;

        if (buffer.startsWith('data:')) {
          jsonData = buffer.substring(5).trim();
        }

        try {
          if (jsonData.trim()) {
            const parsedData = JSON.parse(jsonData);
            yield parsedData;
          }
        } catch (e) {
          console.error('Error parsing JSON from remaining buffer:', e, buffer);
        }
      }
    } catch (e) {
      console.error('Error in SSE stream processing:', e);
      throw e;
    }
  }

  public setAuth(auth: string): void {
    this.authHeader = `Bearer ${auth}`;
  }
}
