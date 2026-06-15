import * as path from 'path';
import { buildExampleRequestBody } from '../src/request-executor/RequestBodyBuilder';
import { SpringScanner } from '../src/spring-scanner/SpringScanner';

const sampleRoot = path.join(__dirname, '..', 'sample-projects', 'spring-demo');

async function main() {
  const scanner = new SpringScanner();
  const endpoints = await scanner.scan({ workspaceRoot: sampleRoot });
  const post = endpoints.find((e) => e.method === 'POST');
  const put = endpoints.find((e) => e.method === 'PUT');

  if (!post || !put) {
    console.error('Missing POST or PUT endpoint');
    process.exit(1);
  }

  const postBody = buildExampleRequestBody(post);
  const putBody = buildExampleRequestBody(put);

  console.log('POST:\n', postBody);
  console.log('PUT:\n', putBody);

  if (!postBody?.includes('"name"') || !postBody.includes('"lastname"')) {
    process.exit(1);
  }
  if (postBody.includes('"id"')) {
    console.error('POST should not include id');
    process.exit(1);
  }
  if (!putBody?.includes('"name"')) {
    process.exit(1);
  }
  console.log('OK');
}

main();
