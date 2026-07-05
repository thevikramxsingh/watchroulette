import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DisplayNamePrompt from './DisplayNamePrompt'
import { setDisplayName } from '../shared/authApi'

vi.mock('../shared/authApi', () => ({
  setDisplayName: vi.fn(),
  isDuplicateNameError: (error) => error?.code === '23505',
}))

beforeEach(() => {
  setDisplayName.mockReset()
})

describe('DisplayNamePrompt', () => {
  it('saves the trimmed name and calls onSaved', async () => {
    setDisplayName.mockResolvedValue({ error: null })
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<DisplayNamePrompt userId="user-1" onSaved={onSaved} />)

    await user.type(screen.getByLabelText('Your name'), '  Vikram  ')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(setDisplayName).toHaveBeenCalledWith('user-1', 'Vikram')
    expect(onSaved).toHaveBeenCalledWith('Vikram')
  })

  it('shows a friendly message on a duplicate name and does not call onSaved', async () => {
    setDisplayName.mockResolvedValue({ error: { code: '23505' } })
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<DisplayNamePrompt userId="user-1" onSaved={onSaved} />)

    await user.type(screen.getByLabelText('Your name'), 'Vikram')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByText(/already in use/i)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('disables Save when the name is empty', () => {
    render(<DisplayNamePrompt userId="user-1" onSaved={vi.fn()} />)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})
