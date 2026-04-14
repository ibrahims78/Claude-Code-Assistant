export function validatePasswordComplexity(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return "Password must contain at least one digit or special character";
  return null;
}

export function validatePhoneNumber(number: string): string | null {
  if (!number?.trim()) return "Phone number is required";
  if (number.endsWith("@c.us") || number.endsWith("@g.us") || number.endsWith("@lid")) return null;
  const digits = number.trim().replace(/\D/g, "");
  if (digits.length < 7) return `Phone number too short: '${number}' (minimum 7 digits)`;
  if (digits.length > 15) return `Phone number too long: '${number}' (maximum 15 digits per E.164)`;
  return null;
}

export function formatNumber(number: string): string {
  if (number.endsWith("@c.us") || number.endsWith("@g.us")) return number;
  if (number.includes("@")) return `${number.split("@")[0]}@c.us`;
  return `${number.replace(/\D/g, "")}@c.us`;
}
