// HTTPS is required for production Secure cookies in WebKit as well as service workers.
import { readFileSync } from 'node:fs';
import { preview } from 'vite';

await preview({ preview: {
	host: '127.0.0.1', port: 55141, strictPort: true,
	https: { key: readFileSync(process.argv[2]), cert: readFileSync(process.argv[3]) }
} });
