import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('community search and filters', () => {
  test('supports keyword search and status filtering in community list', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '社区' }))

    await user.type(screen.getByTestId('community-search-input'), '龟背竹')
    expect(await screen.findByText('龟背竹叶片出现褐色斑点，怎么处理？')).toBeInTheDocument()
    expect(screen.queryByText('月季上密密麻麻小绿虫，是蚜虫吗？')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '仅看待解决' }))
    expect(screen.getByText('龟背竹叶片出现褐色斑点，怎么处理？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清空筛选' }))
    expect(await screen.findByText(/月季上密密麻麻小绿虫/)).toBeInTheDocument()
  })
})
