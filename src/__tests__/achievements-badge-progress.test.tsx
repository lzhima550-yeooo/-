import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('achievements badge wall progress', () => {
  test('keeps publish progress after renaming profile', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '社区' }))
    await user.click(screen.getByRole('link', { name: '发布求助' }))

    await user.type(screen.getByLabelText('问题标题'), '测试发布')
    await user.type(screen.getByLabelText('详细描述'), '测试内容')
    await user.click(screen.getByRole('button', { name: '发布到社区' }))

    await user.click(screen.getByRole('link', { name: '我的成就' }))
    expect(await screen.findByText((content) => content.trim() === '进度：1/1')).toBeInTheDocument()

    await user.clear(screen.getByTestId('profile-name-input'))
    await user.type(screen.getByTestId('profile-name-input'), '改名后昵称')
    await user.click(screen.getByTestId('profile-save'))

    expect(screen.getByText((content) => content.trim() === '进度：1/1')).toBeInTheDocument()
  })

  test('does not leak unsupported icon ligature text in badge wall', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '我的成就' }))
    expect(screen.queryByText(/^sprout$/i)).not.toBeInTheDocument()
  })
})
