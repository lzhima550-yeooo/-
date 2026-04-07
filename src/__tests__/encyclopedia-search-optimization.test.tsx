import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('encyclopedia search optimization', () => {
  test('supports normalized keyword search and no-result recovery action', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '图鉴' }))

    await user.clear(screen.getByTestId('encyclopedia-search-input'))
    await user.type(screen.getByTestId('encyclopedia-search-input'), '  APHIS  ')

    expect(await screen.findByText('棉蚜')).toBeInTheDocument()
    expect(screen.getByTestId('encyclopedia-result-count')).toHaveTextContent('条结果')

    await user.clear(screen.getByTestId('encyclopedia-search-input'))
    await user.type(screen.getByTestId('encyclopedia-search-input'), 'not-exists-keyword')

    expect(await screen.findByTestId('encyclopedia-empty-state')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清除搜索与筛选' }))
    expect(await screen.findByText('桃蚜')).toBeInTheDocument()
  }, 10000)
})
