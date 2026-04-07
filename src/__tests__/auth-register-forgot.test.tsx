import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('auth register and forgot password flow', () => {
  test(
    'supports register and reset password from frontend auth flow',
    async () => {
      const user = userEvent.setup()
      render(<App />)

      await user.click(screen.getByRole('link', { name: '进入探索' }))
      await user.click(screen.getByRole('link', { name: '立即注册' }))

      await user.type(screen.getByTestId('register-nickname'), '新同学')
      await user.type(screen.getByTestId('register-account'), 'new-student')
      await user.type(screen.getByTestId('register-password'), 'abc123')
      await user.type(screen.getByTestId('register-confirm'), 'abc123')
      await user.click(screen.getByTestId('register-submit'))

      expect(await screen.findByRole('alert')).toHaveTextContent('密码至少 8 位')

      await user.clear(screen.getByTestId('register-password'))
      await user.clear(screen.getByTestId('register-confirm'))
      await user.type(screen.getByTestId('register-password'), 'abc12345')
      await user.type(screen.getByTestId('register-confirm'), 'abc12345')
      await user.click(screen.getByTestId('register-submit'))

      expect(await screen.findByText('注册成功，请使用新账号登录')).toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: '忘记密码？' }))
      await user.type(screen.getByTestId('forgot-account'), 'new-student')
      await user.type(screen.getByTestId('forgot-password'), 'abc12345')
      await user.type(screen.getByTestId('forgot-confirm'), 'abc12345')
      await user.click(screen.getByTestId('forgot-submit'))

      expect(await screen.findByRole('alert')).toHaveTextContent('新密码不能与旧密码相同')

      await user.clear(screen.getByTestId('forgot-password'))
      await user.clear(screen.getByTestId('forgot-confirm'))
      await user.type(screen.getByTestId('forgot-password'), 'new-pass-123')
      await user.type(screen.getByTestId('forgot-confirm'), 'new-pass-123')
      await user.click(screen.getByTestId('forgot-submit'))

      expect(await screen.findByText('密码已重置，请返回登录')).toBeInTheDocument()

      await user.clear(screen.getByTestId('login-account'))
      await user.type(screen.getByTestId('login-account'), 'new-student')
      await user.type(screen.getByTestId('login-password'), 'abc12345')
      await user.click(screen.getByTestId('login-submit'))
      expect(await screen.findByTestId('login-error')).toHaveTextContent('账号或密码错误')

      await user.clear(screen.getByTestId('login-password'))
      await user.type(screen.getByTestId('login-password'), 'new-pass-123')
      await user.click(screen.getByTestId('login-submit'))

      expect(screen.getByTestId('home-search-input')).toBeInTheDocument()
    },
    15000,
  )
})
