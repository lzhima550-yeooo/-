import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('home search flow', () => {
  test('navigates to encyclopedia with query from home search', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.type(screen.getByTestId('home-search-input'), 'aphid')
    await user.click(screen.getByTestId('home-search-submit'))

    expect(screen.getByTestId('encyclopedia-search-input')).toHaveValue('aphid')
  })
})
