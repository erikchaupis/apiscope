import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface RawHttpResponse {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[]>;
  body: string;
}

export async function rawHttpRequest(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<RawHttpResponse> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            statusMessage: res.statusMessage ?? '',
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}
