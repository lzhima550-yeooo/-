import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('my profile editing', () => {
  test('supports renaming and avatar update preview', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '我的' }))

    await user.clear(screen.getByTestId('profile-name-input'))
    await user.type(screen.getByTestId('profile-name-input'), '植物侦探小夏')

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    await user.upload(screen.getByTestId('profile-avatar-input'), file)

    await user.click(screen.getByTestId('profile-save'))

    expect(screen.getByTestId('profile-display-name')).toHaveTextContent('植物侦探小夏')
    expect(screen.getByTestId('profile-display-avatar')).toHaveAttribute('src')
  })

  test('supports switch account and logout actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '我的' }))
    await user.click(screen.getByTestId('profile-switch-account'))

    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()

    await user.clear(screen.getByTestId('login-account'))
    await user.type(screen.getByTestId('login-account'), 'teacher01')
    await user.type(screen.getByTestId('login-password'), 'teacher123')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '我的' }))
    await user.click(screen.getByTestId('profile-logout'))

    expect(await screen.findByRole('link', { name: '进入探索' })).toBeInTheDocument()
  })
})
