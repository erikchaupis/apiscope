import { useState } from 'react';
import {
  POST_VARIABLE_SOURCE_LABELS,
  WIZARD_POST_SOURCES,
  createPostRequestVariable,
} from '../../lib/postRequestVariables';
import type { PostRequestVariable, PostRequestVariableSource } from '../../types';
import { cn } from '../../lib/utils';

interface AddPostRequestVariableModalProps {
  existingNames: string[];
  onCreate: (variable: PostRequestVariable) => void;
  onCancel: () => void;
}

type WizardStep = 'source' | 'config';

export function AddPostRequestVariableModal({
  existingNames,
  onCreate,
  onCancel,
}: AddPostRequestVariableModalProps) {
  const [step, setStep] = useState<WizardStep>('source');
  const [source, setSource] = useState<PostRequestVariableSource>('body');
  const [name, setName] = useState('');
  const [extractor, setExtractor] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Variable name is required.';
    }
    if (!/^\w+$/.test(trimmed)) {
      return 'Use letters, numbers, and underscores only.';
    }
    if (existingNames.includes(trimmed)) {
      return 'A variable with this name already exists.';
    }
    return null;
  };

  const validateExtractor = (): string | null => {
    if (!extractor.trim()) {
      switch (source) {
        case 'body':
          return 'JSON Path is required.';
        case 'headers':
          return 'Header name is required.';
        case 'cookies':
          return 'Cookie name is required.';
      }
    }
    return null;
  };

  const handleCreate = () => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    const extractorError = validateExtractor();
    if (extractorError) {
      setError(extractorError);
      return;
    }
    onCreate(createPostRequestVariable(source, name, extractor));
  };

  const extractorLabel =
    source === 'body' ? 'JSON Path' : source === 'headers' ? 'Header Name' : 'Cookie Name';

  const extractorPlaceholder =
    source === 'body' ? 'access_token' : source === 'headers' ? 'X-Request-Id' : 'SESSION';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-4">
        <h3 className="font-semibold text-sm mb-1">Extract Variable</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Step {step === 'source' ? 1 : 2} of 2
        </p>

        {step === 'source' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground mb-2">Choose Source</p>
            {WIZARD_POST_SOURCES.map((option) => (
              <label
                key={option}
                className={cn(
                  'flex items-center gap-2 rounded border px-3 py-2 cursor-pointer text-sm',
                  source === option
                    ? 'border-primary/50 bg-[var(--as-tree-selected)]'
                    : 'border-border hover:bg-accent/40'
                )}
              >
                <input
                  type="radio"
                  name="post-variable-source"
                  checked={source === option}
                  onChange={() => setSource(option)}
                />
                <span>{POST_VARIABLE_SOURCE_LABELS[option]}</span>
              </label>
            ))}
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Variable Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="token"
                autoFocus
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{extractorLabel}</label>
              <input
                type="text"
                value={extractor}
                onChange={(e) => {
                  setExtractor(e.target.value);
                  setError(null);
                }}
                placeholder={extractorPlaceholder}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-danger mt-3">{error}</p>}

        <div className="flex justify-between gap-2 mt-5">
          <button
            type="button"
            onClick={() => {
              if (step === 'source') {
                onCancel();
              } else {
                setStep('source');
                setError(null);
              }
            }}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            {step === 'source' ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === 'source') {
                setStep('config');
                setError(null);
              } else {
                handleCreate();
              }
            }}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            {step === 'config' ? 'Create' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
