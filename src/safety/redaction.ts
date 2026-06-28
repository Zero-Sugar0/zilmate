const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ghPhonePattern = /(?:\+233|0)\d{9}/g;
const pemPrivateKeyPattern = /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+ PRIVATE KEY-----/g;
const dbPasswordPattern = /(\b[a-zA-Z0-9+.-]+:\/\/[^/:\s]+:)([^@\s]+)(@[A-Za-z0-9_.-]+)/g;
const apiKeyPattern = /\b(sk|ghp|github_pat|sk_live|sk-proj)_[A-Za-z0-9_-]{24,82}\b/gi;
const awsAccessKeyPattern = /\bAKIA[0-9A-Z]{16}\b/g;

export function redactSensitiveText(input: string) {
  if (!input) return input;
  return input
    .replace(emailPattern, '[email]')
    .replace(ghPhonePattern, '[phone]')
    .replace(pemPrivateKeyPattern, '[private-key]')
    .replace(dbPasswordPattern, '$1[password]$3')
    .replace(apiKeyPattern, '[api-key]')
    .replace(awsAccessKeyPattern, '[aws-access-key-id]')
    .replace(/\b\d{12,16}\b/g, '[long-number]');
}

