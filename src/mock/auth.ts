export interface AuthUserSeed {
  account: string
  password: string
  nickname: string
  avatar: string
}

export const defaultProfileAvatar =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=320&q=80'

export const authUsersSeed: AuthUserSeed[] = [
  {
    account: 'student01',
    password: '123456',
    nickname: '林溪同学',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80',
  },
  {
    account: 'teacher01',
    password: 'teacher123',
    nickname: '植保老师',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=320&q=80',
  },
]
