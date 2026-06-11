import type { ReactNode } from 'react'
import { useEffect } from 'react'

type Props = {
  open: boolean
  title: string
  children?: ReactNode
  confirmText?: string
  cancelText?: string
  confirmDanger?: boolean
  disableConfirm?: boolean
  checkboxLabel?: string
  checkboxChecked?: boolean
  onCheckboxChange?: (checked: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmText = '确认',
  cancelText = '取消',
  confirmDanger,
  disableConfirm,
  checkboxLabel,
  checkboxChecked,
  onCheckboxChange,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="modalOverlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="btn" type="button" onClick={onCancel}>
            关闭
          </button>
        </div>
        <div className="modalBody">
          {children}
          {checkboxLabel ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#525252' }}>
              <input
                type="checkbox"
                checked={!!checkboxChecked}
                onChange={(e) => onCheckboxChange?.(e.target.checked)}
              />
              {checkboxLabel}
            </label>
          ) : null}
        </div>
        <div className="modalFooter">
          <button className="btn" type="button" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={confirmDanger ? 'btn btnDanger' : 'btn btnPrimary'}
            type="button"
            disabled={!!disableConfirm}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

