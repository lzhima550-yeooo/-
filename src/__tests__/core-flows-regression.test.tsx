import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

const enterExploreIfNeeded = async (user: ReturnType<typeof userEvent.setup>) => {
  const enterLink = screen.queryByRole('link', { name: '进入探索' })
  if (enterLink) {
    await user.click(enterLink)
  }
}

describe('core flow regressions', () => {
  test('login blocks empty credentials and shows alert', async () => {
    const user = userEvent.setup()
    render(<App />)

    await enterExploreIfNeeded(user)
    await user.click(screen.getByTestId('login-submit'))

    const error = await screen.findByTestId('login-error')
    expect(error).toHaveAttribute('role', 'alert')
  })

  test('identify upload adds latest record into recent list', async () => {
    const user = userEvent.setup()
    render(<App />)

    await enterExploreIfNeeded(user)
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('button', { name: 'AI识别' }))

    const file = new File(['fake image'], 'leaf.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('上传图片'), file)
    await user.click(screen.getByTestId('identify-generate'))

    const list = screen.getByTestId('identify-recent-list')
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(list).getByText(/蚜虫/)).toBeInTheDocument()
  })

  test('home search trims text before syncing to encyclopedia query', async () => {
    const user = userEvent.setup()
    render(<App />)

    await enterExploreIfNeeded(user)
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.type(screen.getByTestId('home-search-input'), '  aphid  ')
    await user.click(screen.getByTestId('home-search-submit'))

    expect(screen.getByTestId('encyclopedia-search-input')).toHaveValue('aphid')
  })
})
