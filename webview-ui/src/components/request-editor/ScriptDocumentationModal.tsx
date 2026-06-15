import { useState } from 'react';
import { cn } from '../../lib/utils';
import type { ScriptsSubTab } from '../RequestEditorTabBar';

type PostDocTab = 'variables' | 'response' | 'recipes' | 'limitations';
type PreDocTab = 'variables' | 'request' | 'recipes' | 'limitations';
type DocTab = PostDocTab | PreDocTab;

interface ScriptDocumentationModalProps {
  scriptKind: ScriptsSubTab;
  onClose: () => void;
}

const POST_DOC_TABS: { id: PostDocTab; label: string }[] = [
  { id: 'variables', label: 'Variables' },
  { id: 'response', label: 'Response' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'limitations', label: 'Limitations' },
];

const PRE_DOC_TABS: { id: PreDocTab; label: string }[] = [
  { id: 'variables', label: 'Variables' },
  { id: 'request', label: 'Request' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'limitations', label: 'Limitations' },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="text-xs font-mono leading-relaxed bg-background border border-border rounded px-3 py-2 overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function Recipe({ title, code }: { title: string; code: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <CodeBlock>{code}</CodeBlock>
    </div>
  );
}

function LimitationsContent() {
  return (
    <>
      <p className="text-xs text-muted-foreground">Not supported:</p>
      <CodeBlock>{`fetch()

require()

import

eval()

setTimeout()

setInterval()

WebSocket()

process`}</CodeBlock>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Scripts run in a secure sandbox.
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">Scripts cannot access:</p>
      <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
        <li>Network</li>
        <li>Filesystem</li>
        <li>Operating System</li>
        <li>Browser APIs</li>
      </ul>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Only the provided API Scope scripting APIs are available. Execution is limited to 500 ms,
        10,000 loop iterations, and 5 MB memory. Exceeding limits returns: &quot;Script execution
        limit exceeded.&quot;
      </p>
    </>
  );
}

function PostRecipes() {
  return (
    <div className="space-y-5">
      <Recipe
        title="Extract JWT Token"
        code={`const body = response.json();

env.set("token", body.access_token);`}
      />
      <Recipe
        title="Extract User ID"
        code={`const body = response.json();

env.set("userId", body.user.id);`}
      />
      <Recipe
        title="Store Response Header"
        code={`const requestId =
    response.headers["x-request-id"];

if (requestId) {
    env.set("requestId", requestId);
}`}
      />
      <Recipe
        title="Check Response Status"
        code={`if (response.status !== 200) {
    env.set("lastError", "Request failed");
}`}
      />
      <Recipe
        title="Save Success Flag"
        code={`if (response.status === 200) {
    env.set("success", "true");
}`}
      />
      <Recipe
        title="Extract Nested JSON Value"
        code={`const body = response.json();

env.set(
    "customerName",
    body.customer.profile.name
);`}
      />
      <Recipe
        title="Store Item Count"
        code={`const body = response.json();

env.set(
    "itemCount",
    body.items.length
);`}
      />
      <Recipe
        title="Array Processing"
        code={`const body = response.json();

for (const item of body.items) {
    console.log(item.id);
}`}
      />
      <Recipe
        title="Switch by Status"
        code={`switch (response.status) {
    case 200:
        env.set("status", "success");
        break;

    case 401:
        env.set("status", "unauthorized");
        break;

    default:
        env.set("status", "error");
}`}
      />
      <Recipe
        title="Safe Null Check"
        code={`const body = response.json();

if (
    body &&
    body.user &&
    body.user.id
) {
    env.set("userId", body.user.id);
}`}
      />
      <Recipe
        title="Build Full Name"
        code={`const body = response.json();

const fullName =
    body.firstName +
    " " +
    body.lastName;

env.set(
    "fullName",
    fullName
);`}
      />
      <Recipe
        title="Store Response Time Category"
        code={`if (response.status === 200) {
    env.set("apiStatus", "healthy");
}`}
      />
      <Recipe
        title="Reuse Existing Variable"
        code={`const token = env.get("token");

if (token) {
    env.set(
        "isAuthenticated",
        "true"
    );
}`}
      />
    </div>
  );
}

function PreRecipes() {
  return (
    <div className="space-y-5">
      <Recipe
        title="Check Request Method"
        code={`if (request.method === "POST") {
    env.set("createMode", "true");
}`}
      />
      <Recipe
        title="Generate Random Number"
        code={`const randomId = Math.floor(
    Math.random() * 1000
);

env.set("randomId", randomId);`}
      />
      <Recipe
        title="Generate Timestamp"
        code={`env.set(
    "timestamp",
    Date.now()
);`}
      />
      <Recipe
        title="Increment Counter"
        code={`let counter = env.get("counter");

if (!counter) {
    counter = 0;
}

counter++;

env.set("counter", counter);`}
      />
      <Recipe
        title="Reuse Existing Variable"
        code={`const token = env.get("token");

if (token) {
    env.set(
        "isAuthenticated",
        "true"
    );
}`}
      />
    </div>
  );
}

export function ScriptDocumentationModal({ scriptKind, onClose }: ScriptDocumentationModalProps) {
  const isPost = scriptKind === 'post';
  const tabs = isPost ? POST_DOC_TABS : PRE_DOC_TABS;
  const [tab, setTab] = useState<DocTab>('variables');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-sm">
            {isPost ? 'Post Script Documentation' : 'Pre Script Documentation'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
          >
            Close
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-border overflow-x-auto shrink-0">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'px-2.5 py-1 text-xs rounded whitespace-nowrap',
                tab === item.id
                  ? 'bg-primary text-background font-medium'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm">
          {tab === 'variables' && (
            <>
              <p className="text-xs text-muted-foreground">
                Variables API. <code className="font-mono">env.get</code> resolves Request → Runtime →
                Environment. <code className="font-mono">env.set</code> stores in Runtime Variables
                (memory only).
              </p>
              <CodeBlock>{`env.get("token")

env.set("token", "abc123")
env.unset("token")
env.clear()`}</CodeBlock>
              <CodeBlock>{`const token = env.get("token");

if (token) {
    env.set("authenticated", "true");
}`}</CodeBlock>
            </>
          )}

          {tab === 'request' && !isPost && (
            <>
              <p className="text-xs text-muted-foreground">Available in Pre Scripts (read-only).</p>
              <CodeBlock>{`request.url

request.method

request.headers

request.body`}</CodeBlock>
              <CodeBlock>{`if (request.method === "POST") {
    env.set("createMode", "true");
}`}</CodeBlock>
            </>
          )}

          {tab === 'response' && isPost && (
            <>
              <p className="text-xs text-muted-foreground">Available response APIs (read-only).</p>
              <CodeBlock>{`response.status

response.headers

response.text()

response.json()`}</CodeBlock>
              <CodeBlock>{`const body = response.json();

env.set("token", body.access_token);`}</CodeBlock>
            </>
          )}

          {tab === 'recipes' && (isPost ? <PostRecipes /> : <PreRecipes />)}

          {tab === 'limitations' && <LimitationsContent />}
        </div>
      </div>
    </div>
  );
}
