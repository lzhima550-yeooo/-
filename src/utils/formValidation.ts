export interface ValidationResult {
  valid: boolean
  message?: string
}

export const validators = {
  required(value: string, label: string): ValidationResult {
    return value.trim() ? { valid: true } : { valid: false, message: `${label}不能为空` }
  },
  account(value: string): ValidationResult {
    const normalized = value.trim()
    if (!normalized) {
      return { valid: false, message: '账号不能为空' }
    }

    if (normalized.length < 4) {
      return { valid: false, message: '账号至少 4 位' }
    }

    return { valid: true }
  },
  password(value: string): ValidationResult {
    const normalized = value.trim()
    if (normalized.length < 8) {
      return { valid: false, message: '密码至少 8 位' }
    }

    if (!/[a-zA-Z]/.test(normalized) || !/\d/.test(normalized)) {
      return { valid: false, message: '密码需包含字母和数字' }
    }

    return { valid: true }
  },
  confirmPassword(password: string, confirm: string): ValidationResult {
    return password === confirm ? { valid: true } : { valid: false, message: '两次输入的密码不一致' }
  },
  communityPost(title: string, content: string, image?: string): ValidationResult {
    if (!title.trim() && !content.trim() && !image) {
      return { valid: false, message: '请至少填写标题、内容或上传图片' }
    }
    return { valid: true }
  },
}
