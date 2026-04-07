import '@testing-library/jest-dom'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useAppStore } from '../store/useAppStore'

const initialState = useAppStore.getInitialState()

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:mock-preview',
    writable: true,
  })
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    writable: true,
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.pushState({}, '', '/')
  useAppStore.setState(initialState, true)
})

afterEach(() => {
  cleanup()
})
