import { useState } from 'react';
import type { ResponseTestCheck, ResponseTestCheckType } from '../../types';
import {
  CHECK_TYPE_LABELS,
  WIZARD_CHECK_TYPES,
  createDefaultResponseTestCheck,
  validateResponseTestCheck,
} from '../../lib/responseTests';
import { CheckTypeOption, TestCheckConfigForm } from './TestCheckConfigForm';

interface AddResponseTestModalProps {
  onCreate: (check: ResponseTestCheck) => void;
  onCancel: () => void;
}

type WizardStep = 'type' | 'config';

export function AddResponseTestModal({ onCreate, onCancel }: AddResponseTestModalProps) {
  const [step, setStep] = useState<WizardStep>('type');
  const [type, setType] = useState<ResponseTestCheckType>('status-code');
  const [check, setCheck] = useState<ResponseTestCheck>(() => createDefaultResponseTestCheck('status-code'));
  const [error, setError] = useState<string | null>(null);

  const selectType = (nextType: ResponseTestCheckType) => {
    setType(nextType);
    setCheck(createDefaultResponseTestCheck(nextType));
    setError(null);
  };

  const handleCreate = () => {
    const validationError = validateResponseTestCheck(check);
    if (validationError) {
      setError(validationError);
      return;
    }
    onCreate(check);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-4">
        <h3 className="font-semibold text-sm mb-1">Add Check</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {step === 'type' ? 'Choose Check Type' : `Configure ${CHECK_TYPE_LABELS[type]}`}
        </p>

        {step === 'type' && (
          <div className="space-y-0.5">
            {WIZARD_CHECK_TYPES.map((checkType) => (
              <CheckTypeOption
                key={checkType}
                type={checkType}
                selected={type === checkType}
                onSelect={() => selectType(checkType)}
              />
            ))}
          </div>
        )}

        {step === 'config' && (
          <TestCheckConfigForm
            check={check}
            onChange={(patch) => {
              setCheck((current) => ({ ...current, ...patch }));
              setError(null);
            }}
          />
        )}

        {error && <p className="text-xs text-danger mt-3">{error}</p>}

        <div className="flex justify-between gap-2 mt-5">
          <button
            type="button"
            onClick={() => {
              if (step === 'type') {
                onCancel();
              } else {
                setStep('type');
                setError(null);
              }
            }}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            {step === 'type' ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === 'type') {
                setStep('config');
              } else {
                handleCreate();
              }
            }}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            {step === 'type' ? 'Next' : 'Add Check'}
          </button>
        </div>
      </div>
    </div>
  );
}
