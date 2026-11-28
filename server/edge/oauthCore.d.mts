export interface BuildGoogleStateInput {
  secret: string;
  mode?: string;
  inviteCode?: string;
  nextPlan?: string;
  ttlMs?: number;
}

export type VerifyGoogleStateResult =
  | {
      ok: true;
      mode: 'signin' | 'signup';
      inviteCode: string;
      nextPlan: '' | 'plus' | 'advisor';
      iat: number;
      exp: number;
    }
  | {
      ok: false;
      error: 'google_invalid_state' | 'google_state_expired';
    };

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
}

export function buildGoogleState(input: BuildGoogleStateInput): Promise<string>;

export function verifyGoogleState(input: {
  secret: string;
  state: string;
}): Promise<VerifyGoogleStateResult>;

export function buildGoogleAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string;

export function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleProfile>;
