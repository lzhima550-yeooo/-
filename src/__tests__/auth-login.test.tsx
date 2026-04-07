import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('auth flow', () => {
  test('enters from welcome, blocks wrong password, and allows valid account login', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: '四季夏木' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '进入探索' }))

    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()

    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), 'wrong-password')
    await user.click(screen.getByTestId('login-submit'))

    expect(await screen.findByTestId('login-error')).toHaveTextContent('账号或密码错误')

    await user.clear(screen.getByTestId('login-password'))
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    expect(screen.getByText('探索校园四季')).toBeInTheDocument()
  })
})
