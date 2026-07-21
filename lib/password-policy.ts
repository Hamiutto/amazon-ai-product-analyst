export const passwordPolicyText = "至少 8 位，包含大写字母、小写字母和数字；建议加入特殊符号。";

export function getPasswordPolicyError(password: string) {
  if (password.length < 8) return "密码至少需要 8 位。";
  if (!/[a-z]/.test(password)) return "密码需要包含至少 1 个小写字母。";
  if (!/[A-Z]/.test(password)) return "密码需要包含至少 1 个大写字母。";
  if (!/\d/.test(password)) return "密码需要包含至少 1 个数字。";
  return "";
}
