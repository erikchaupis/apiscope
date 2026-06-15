import { performSessionLogin } from '../src/authentication/SessionLogin';

const loginUrl = process.argv[2] ?? 'http://localhost:8086/login';
const username = process.argv[3] ?? 'admin';
const password = process.argv[4] ?? 'admin123';

async function main() {
  const result = await performSessionLogin({ loginUrl, username, password });

  if (!result.success) {
    console.error('Session login failed:', result.error ?? 'unknown error');
    process.exit(1);
  }

  console.log('Session login OK');
  console.log('Cookies:', result.authState?.cookies.map((c) => c.name).join(', '));
}

void main();
