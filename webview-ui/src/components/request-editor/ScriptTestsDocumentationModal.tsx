import { useState } from 'react';
import { cn } from '../../lib/utils';

type DocTab = 'assertions' | 'variables' | 'response' | 'recipes' | 'limitations';

interface ScriptTestsDocumentationModalProps {
  onClose: () => void;
}

const DOC_TABS: { id: DocTab; label: string }[] = [
  { id: 'assertions', label: 'Assertions' },
  { id: 'variables', label: 'Variables' },
  { id: 'response', label: 'Response' },
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

export function ScriptTestsDocumentationModal({ onClose }: ScriptTestsDocumentationModalProps) {
  const [tab, setTab] = useState<DocTab>('assertions');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-sm">Script Tests Documentation</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
          >
            Close
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-border overflow-x-auto shrink-0">
          {DOC_TABS.map((item) => (
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
          {tab === 'assertions' && (
            <>
              <CodeBlock>{`assert(response.status === 200);`}</CodeBlock>
              <CodeBlock>{`assert(response.status, 200);`}</CodeBlock>
              <CodeBlock>{`assert(body.user.id, 100);`}</CodeBlock>
            </>
          )}

          {tab === 'variables' && (
            <>
              <CodeBlock>{`env.get("token");

env.set("token", "abc123");`}</CodeBlock>
            </>
          )}

          {tab === 'response' && (
            <>
              <CodeBlock>{`response.status

response.headers

response.text()

response.json()`}</CodeBlock>
            </>
          )}

          {tab === 'recipes' && (
            <div className="space-y-5">
              <Recipe title="Status Check" code={`assert(response.status === 200);`} />
              <Recipe
                title="JWT Token Exists"
                code={`const body = response.json();

assert(
    body.access_token != null
);`}
              />
              <Recipe
                title="User Id Validation"
                code={`const body = response.json();

assert(
    body.user.id,
    100
);`}
              />
              <Recipe
                title="Compare With Variable"
                code={`const body = response.json();

assert(
    body.user.id,
    env.get("userId")
);`}
              />
              <Recipe
                title="Array Validation"
                code={`const body = response.json();

assert(
    body.items.length > 0
);`}
              />
              <Recipe
                title="Status Switch Example"
                code={`switch (response.status) {
    case 200:
        assert(true);
        break;

    default:
        assert(false);
}`}
              />
              <Recipe
                title="Validate All Items"
                code={`const body = response.json();

for (const item of body.items) {
    assert(item.id != null);
}`}
              />
            </div>
          )}

          {tab === 'limitations' && (
            <>
              <p className="text-xs text-muted-foreground">Not supported:</p>
              <CodeBlock>{`fetch()

require()

import

eval()

setTimeout()

setInterval()`}</CodeBlock>
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
                Only API Scope scripting APIs are available.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
