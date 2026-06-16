import * as path from 'path';
import { buildExampleRequestBody } from '../src/request-executor/RequestBodyBuilder';
import { SpringScanner } from '../src/spring-scanner/SpringScanner';
import { FastApiScanner } from '../src/fastapi-scanner/FastApiScanner';
import { ExpressScanner } from '../src/express-scanner/ExpressScanner';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

async function testSpringDemo() {
  const sampleRoot = path.join(__dirname, '..', 'sample-projects', 'spring-demo');
  const endpoints = await new SpringScanner().scan({ workspaceRoot: sampleRoot });
  const post = endpoints.find((e) => e.method === 'POST');
  const put = endpoints.find((e) => e.method === 'PUT');

  assert(Boolean(post && put), 'Missing POST or PUT endpoint in spring-demo');

  const postBody = buildExampleRequestBody(post!, 'spring')?.body;
  const putBody = buildExampleRequestBody(put!, 'spring')?.body;

  console.log('spring-demo POST:\n', postBody);
  console.log('spring-demo PUT:\n', putBody);

  assert(Boolean(postBody?.includes('"name"') && postBody.includes('"lastname"')), 'POST missing user fields');
  assert(!postBody?.includes('"id"'), 'POST should not include id');
  assert(Boolean(putBody?.includes('"id"') && putBody?.includes('"name"')), 'PUT should include id and name');
}

async function testSpringAuthSession() {
  const sampleRoot = path.join(__dirname, '..', 'sample-projects', 'spring-auth-session');
  const endpoints = await new SpringScanner().scan({ workspaceRoot: sampleRoot });
  const post = endpoints.find((e) => e.path === '/api/tickets' && e.method === 'POST');
  const put = endpoints.find((e) => e.path === '/api/tickets/{id}' && e.method === 'PUT');
  const formPost = endpoints.find((e) => e.path === '/tickets' && e.method === 'POST');

  assert(Boolean(post && put && formPost), 'Missing spring-auth-session endpoints');

  const apiPost = buildExampleRequestBody(post!, 'spring');
  const apiPut = buildExampleRequestBody(put!, 'spring');
  const form = buildExampleRequestBody(formPost!, 'spring');

  console.log('spring-auth-session API POST:\n', apiPost?.body);
  console.log('spring-auth-session API PUT:\n', apiPut?.body);
  console.log('spring-auth-session form POST kind:', form?.requestBody?.kind);

  assert(Boolean(apiPost?.body?.includes('"name"') && apiPost.body.includes('"description"')), 'API POST should use TicketRequest record fields');
  assert(!apiPost.body?.includes('"lastname"'), 'API POST should not use fallback lastname');
  assert(Boolean(apiPut?.body?.includes('"description"')), 'API PUT should use TicketRequest record fields');
  assert(form?.requestBody?.kind === 'form-urlencoded', 'Form POST should use form-urlencoded body');
  assert(Boolean(form.requestBody?.urlEncoded?.some((row) => row.key === 'name')), 'Form POST should include name field');
}

async function testFastApi() {
  const sampleRoot = path.join(__dirname, '..', 'sample-projects', 'jwt-api-fastapi');
  const endpoints = await new FastApiScanner().scan({ workspaceRoot: sampleRoot });
  const login = endpoints.find((e) => e.path === '/auth/login' && e.method === 'POST');
  const echo = endpoints.find((e) => e.path === '/echo' && e.method === 'POST');

  assert(Boolean(login), 'Missing FastAPI login endpoint');

  const loginBody = buildExampleRequestBody(login!, 'fastapi')?.body;
  console.log('fastapi login POST:\n', loginBody);

  assert(Boolean(loginBody?.includes('"username"') && loginBody.includes('"password"')), 'FastAPI login should include credentials');
  assert(!loginBody?.includes('"lastname"'), 'FastAPI login should not use spring fallback');

  if (echo) {
    const echoBody = buildExampleRequestBody(echo, 'fastapi')?.body;
    console.log('fastapi echo POST:\n', echoBody);
    assert(Boolean(echoBody?.includes('"example"')), 'FastAPI echo should generate dict example body');
  }
}

async function testExpress() {
  const sampleRoot = path.join(__dirname, '..', 'sample-projects', 'files-api-nodejs');
  const endpoints = await new ExpressScanner().scan({ workspaceRoot: sampleRoot });
  const single = endpoints.find((e) => e.path === '/upload/single' && e.method === 'POST');
  const multiple = endpoints.find((e) => e.path === '/upload/multiple' && e.method === 'POST');

  assert(Boolean(single && multiple), 'Missing Express upload endpoints');

  const singleBody = buildExampleRequestBody(single!, 'express');
  const multipleBody = buildExampleRequestBody(multiple!, 'express');

  console.log('express upload/single kind:', singleBody?.requestBody?.kind);
  console.log('express upload/single field:', singleBody?.requestBody?.formData?.[0]?.key);
  console.log('express upload/multiple field:', multipleBody?.requestBody?.formData?.[0]?.key);

  assert(singleBody?.requestBody?.kind === 'multipart', 'Express single upload should be multipart');
  assert(singleBody?.requestBody?.formData?.[0]?.key === 'file', 'Express single upload should use file field');
  assert(multipleBody?.requestBody?.formData?.[0]?.key === 'files', 'Express multiple upload should use files field');
  assert(!singleBody?.body?.includes('"lastname"'), 'Express upload should not use spring fallback');
}

async function main() {
  await testSpringDemo();
  await testSpringAuthSession();
  await testFastApi();
  await testExpress();
  console.log('OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
