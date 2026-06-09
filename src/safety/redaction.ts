const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ghPhonePattern = /(?:\+233|0)\d{9}/g;

export function redactSensitiveText(input: string) {
  return input
    .replace(emailPattern, '[email]')
    .replace(ghPhonePattern, '[phone]')
    .replace(/\b\d{12,16}\b/g, '[long-number]');
}
