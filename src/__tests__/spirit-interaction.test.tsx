import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('spirit interaction page', () => {
  test('supports smart identification first, then spirit role generation without forced encyclopedia mapping', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '灵化' }))

    const captureInput = screen.getByTestId('spirit-capture-input')
    expect(captureInput).toHaveAttribute('capture', 'environment')
    expect(screen.getByTestId('spirit-runtime-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('spirit-keywords-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('spirit-keywords-input')).not.toBeInTheDocument()

    const file = new File(['fake image'], 'ladybug.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByTestId('spirit-upload-input'), file)

    expect(screen.getByTestId('spirit-identify-loading')).toBeInTheDocument()
    expect(await screen.findByText(/Coccinella septempunctata/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '查看相关图鉴' })).not.toBeInTheDocument()
    expect(await screen.findByTestId('spirit-no-encyclopedia')).toBeInTheDocument()
    expect(await screen.findByTestId('spirit-keywords-panel')).toBeInTheDocument()
    expect(screen.getByTestId('spirit-keywords-panel')).toHaveTextContent('瓢虫')
    expect(screen.queryByTestId('spirit-keywords-input')).not.toBeInTheDocument()

    const generateButton = await screen.findByTestId('spirit-generate')
    await user.click(generateButton)

    expect(screen.getByTestId('spirit-generate-loading')).toBeInTheDocument()

    expect(await screen.findByTestId('spirit-upper-layer')).toBeInTheDocument()
    expect(screen.getByTestId('spirit-lower-layer')).toBeInTheDocument()
    expect(screen.getByTestId('spirit-portrait-image')).toHaveClass('object-contain')
    expect(screen.getByTestId('spirit-tags')).toHaveTextContent('Coccinella')

    await user.click(screen.getByTestId('spirit-toggle-image'))
    expect(screen.getByAltText('昆虫实拍图')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '防治建议' }))
    expect((await screen.findAllByText(/优先保护天敌/)).length).toBeGreaterThan(0)

    await user.type(screen.getByTestId('spirit-chat-input'), '如果我要优化提示词，该怎么设计？')
    await user.click(screen.getByTestId('spirit-chat-send'))
    expect(await screen.findByText(/当前是演示流式回复/)).toBeInTheDocument()
  }, 15000)
})
