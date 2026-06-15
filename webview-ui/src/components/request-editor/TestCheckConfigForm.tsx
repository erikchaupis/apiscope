import type { ResponseTestCheck, ResponseTestCheckType, ResponseTestOperator } from '../../types';
import {
  CHECK_TYPE_LABELS,
  OPERATORS_BY_CHECK_TYPE,
  operatorNeedsValue,
  responseTestOperatorLabel,
} from '../../lib/responseTests';
import { cn } from '../../lib/utils';

interface TestCheckConfigFormProps {
  check: ResponseTestCheck;
  onChange: (patch: Partial<ResponseTestCheck>) => void;
  showType?: boolean;
}

export function TestCheckConfigForm({ check, onChange, showType = false }: TestCheckConfigFormProps) {
  const operators = OPERATORS_BY_CHECK_TYPE[check.type];
  const needsValue = operatorNeedsValue(check.operator);

  return (
    <div className="space-y-3">
      {showType && (
        <p className="text-xs text-muted-foreground">
          Check type: <span className="text-foreground font-medium">{CHECK_TYPE_LABELS[check.type]}</span>
        </p>
      )}

      {check.type === 'response-header' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Header Name</label>
          <input
            type="text"
            value={check.headerName ?? ''}
            onChange={(e) => onChange({ headerName: e.target.value })}
            placeholder="Content-Type"
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
          />
        </div>
      )}

      {check.type === 'response-cookie' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Cookie Name</label>
          <input
            type="text"
            value={check.cookieName ?? ''}
            onChange={(e) => onChange({ cookieName: e.target.value })}
            placeholder="SESSION"
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
          />
        </div>
      )}

      {check.type === 'json-field' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">JSON Path</label>
          <input
            type="text"
            value={check.jsonPath ?? ''}
            onChange={(e) => onChange({ jsonPath: e.target.value })}
            placeholder="user.id"
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
          />
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Operator</label>
        <select
          value={check.operator}
          onChange={(e) => onChange({ operator: e.target.value as ResponseTestOperator })}
          className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {responseTestOperatorLabel(operator)}
            </option>
          ))}
        </select>
      </div>

      {needsValue && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Value</label>
          <input
            type="text"
            value={check.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={
              check.type === 'status-code'
                ? '200'
                : check.type === 'response-time'
                  ? '1000'
                  : check.type === 'response-size'
                    ? '100'
                    : 'Value'
            }
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
          />
          {check.type === 'response-time' && (
            <p className="text-[11px] text-muted-foreground mt-1">Unit: ms</p>
          )}
          {check.type === 'response-size' && (
            <p className="text-[11px] text-muted-foreground mt-1">Unit: bytes</p>
          )}
        </div>
      )}
    </div>
  );
}

interface CheckTypeOptionProps {
  type: ResponseTestCheckType;
  selected: boolean;
  onSelect: () => void;
}

export function CheckTypeOption({ type, selected, onSelect }: CheckTypeOptionProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent/50',
        selected && 'bg-accent'
      )}
    >
      <input type="radio" checked={selected} onChange={onSelect} className="shrink-0" />
      <span className="text-sm">{CHECK_TYPE_LABELS[type]}</span>
    </label>
  );
}
