import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('encyclopedia visual tags', () => {
  test('shows risk and season tags on encyclopedia cards', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '图鉴' }))

    expect(screen.getAllByText(/风险$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/高发|季/).length).toBeGreaterThan(0)
  })
})
