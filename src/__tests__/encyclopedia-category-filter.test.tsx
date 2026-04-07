import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('encyclopedia category filter', () => {
  test('filters cards by professional category', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '图鉴' }))

    await user.click(screen.getByRole('button', { name: '虫害' }))
    await user.click(screen.getByRole('button', { name: '刺吸式害虫' }))

    const grid = screen.getByTestId('encyclopedia-grid')
    expect(within(grid).getByText('桃蚜')).toBeInTheDocument()
    expect(within(grid).queryByText('稻瘟病')).not.toBeInTheDocument()
  })
})
