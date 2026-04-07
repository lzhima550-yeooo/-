import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('spirit to community draft flow', () => {
  test('supports one-click community draft creation from spirit page', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '灵化' }))

    const file = new File(['fake image'], 'ladybug.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByTestId('spirit-upload-input'), file)

    expect(await screen.findByText(/Coccinella septempunctata/)).toBeInTheDocument()

    await user.click(await screen.findByTestId('spirit-generate'))
    expect(await screen.findByTestId('spirit-upper-layer')).toBeInTheDocument()
    expect(screen.queryByTestId('spirit-p4-panel')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('spirit-toggle-diagnostics'))
    expect(screen.getByTestId('spirit-p4-panel')).toBeInTheDocument()

    await user.click(screen.getByTestId('spirit-create-draft'))

    expect(await screen.findByRole('heading', { name: '发布求助' })).toBeInTheDocument()
    const titleInput = (await screen.findByLabelText('问题标题')) as HTMLInputElement
    const contentInput = screen.getByLabelText('详细描述') as HTMLTextAreaElement
    expect(titleInput.value).toContain('灵化记录')
    expect(contentInput.value).toContain('识别对象')
  }, 20000)
})
