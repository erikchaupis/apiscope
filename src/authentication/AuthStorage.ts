import * as vscode from 'vscode';
import { AuthState } from '../core/types';
import { buildAuthStatus } from './AuthState';

const SECRET_KEY = 'apiScope.authState';

export class AuthStorage {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async load(): Promise<AuthState | null> {
    const raw = await this.context.secrets.get(SECRET_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthState;
    } catch {
      return null;
    }
  }

  async save(state: AuthState): Promise<void> {
    await this.context.secrets.store(SECRET_KEY, JSON.stringify(state));
  }

  async clear(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
  }

  async getStatus() {
    const state = await this.load();
    return buildAuthStatus(state);
  }
}
