import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('community thread floors and follow-up flow', () => {
  test('supports tieba-like floors with image answer and poster follow-up', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '社区' }))

    const listImage = screen.getByAltText('龟背竹叶片出现褐色斑点，怎么处理？')
    fireEvent.error(listImage)
    expect(listImage.getAttribute('src')).toContain('/images/community-post-fallback.svg')

    await user.click(screen.getByRole('link', { name: '发布求助' }))
    await user.type(screen.getByLabelText('问题标题'), '楼层测试贴')
    await user.type(screen.getByLabelText('详细描述'), '请按贴吧楼层回复')
    await user.click(screen.getByRole('button', { name: '发布到社区' }))

    await user.click((await screen.findAllByRole('link', { name: '查看详情 / 回答' }))[0])

    expect(screen.getByText('1楼')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '楼层测试贴' })).toBeInTheDocument()

    const answerImage = new File(['answer image'], 'answer.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('回答附图（可选）'), answerImage)
    await user.type(screen.getByTestId('community-reply-input'), '这是二楼图文解答')
    await user.click(screen.getByRole('button', { name: '提交楼层' }))

    expect(await screen.findByText('2楼')).toBeInTheDocument()
    expect(screen.getByText('这是二楼图文解答')).toBeInTheDocument()
    expect(screen.getByAltText('楼层配图')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '楼主追问' }))
    await user.type(screen.getByTestId('community-reply-input'), '我补充一张叶背近照，麻烦再看下')
    await user.click(screen.getByRole('button', { name: '提交楼层' }))

    expect(await screen.findByText('3楼')).toBeInTheDocument()
    expect(screen.getAllByText('楼主追问').length).toBeGreaterThan(0)
  }, 10000)
})
