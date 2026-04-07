import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App'

describe('welcome page image resilience', () => {
  test('uses local hero image and still falls back when load fails', () => {
    render(<App />)

    const heroImage = screen.getByRole('img', { name: '校园背景' })
    expect(heroImage).toHaveAttribute('src')
    expect(heroImage.getAttribute('src')).toContain('/images/welcome-campus')

    fireEvent.error(heroImage)
    expect(heroImage.getAttribute('src')).toContain('data:image/svg+xml')
  })

  test('renders provided local program logo image', () => {
    render(<App />)

    const logoImage = screen.getByAltText('四季夏木程序Logo')
    expect(logoImage.getAttribute('src')).toContain('/images/711d717f9bc3af89d56a4b69ad7579d4.png')
  })
})
