import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('community publish with image only', () => {
  test('allows posting with only an uploaded image', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    await user.click(screen.getByRole('link', { name: '社区' }))
    await user.click(screen.getByRole('link', { name: '发布求助' }))

    const file = new File(['fake image'], 'leaf.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('上传图片'), file)
    await user.click(screen.getByRole('button', { name: '发布到社区' }))

    expect(await screen.findByText('现场图片求助')).toBeInTheDocument()
  })
})
