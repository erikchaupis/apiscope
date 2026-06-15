import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sampleRoot = path.join(root, 'sample-projects', 'spring-demo');

// Dynamic import of compiled scanner would need bundling; inline minimal validation
const controllerPath = path.join(
  sampleRoot,
  'src/main/java/com/example/demo/UserController.java'
);
const content = fs.readFileSync(controllerPath, 'utf-8');
const expected = [
  'GET /users',
  'GET /users/{id}',
  'POST /users',
  'PUT /users/{id}',
  'DELETE /users/{id}',
  'GET /users/search',
];

const patterns = [
  /@GetMapping\b/,
  /@GetMapping\("\/\{id\}"\)/,
  /@PostMapping\b/,
  /@PutMapping\("\/\{id\}"\)/,
  /@DeleteMapping\("\/\{id\}"\)/,
  /@RequestMapping\(value = "\/search", method = RequestMethod\.GET\)/,
];

let ok = true;
for (const p of patterns) {
  if (!p.test(content)) {
    console.error('Missing pattern:', p);
    ok = false;
  }
}

const props = fs.readFileSync(
  path.join(sampleRoot, 'src/main/resources/application.properties'),
  'utf-8'
);
if (!/server\.port=8085/.test(props)) {
  console.error('Expected server.port=8085');
  ok = false;
}

if (ok) {
  console.log('Spring sample validation OK');
  console.log('Expected endpoints:', expected.join(', '));
} else {
  process.exit(1);
}
