import { useEffect, useState } from 'react'
import { AppSettings } from '../types'
import { FolderIcon, XIcon } from './icons'

const ACCENT_PRESETS = [
  { name: 'Roxo', value: '#b03dfd' },
  { name: 'Azul', value: '#3d8bfd' },
  { name: 'Verde', value: '#3ddb85' },
  { name: 'Laranja', value: '#fd9c3d' },
  { name: 'Rosa', value: '#fd3d9c' },
  { name: 'Vermelho', value: '#fd4d3d' }
]

export default function SettingsModal({
  settings,
  onChange,
  onClose
}: {
  settings: AppSettings
  onChange: (partial: Partial<AppSettings>) => void
  onClose: () => void
}) {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.kiro.getAppVersion().then(setVersion)
  }, [])

  async function pickDefaultFolder() {
    const folder = await window.kiro.pickFolder()
    if (folder) onChange({ defaultFolder: folder })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal__header">
          <h2>Configurações</h2>
          <button className="settings-modal__close" onClick={onClose} title="Fechar">
            <XIcon width={16} height={16} />
          </button>
        </div>

        <div className="settings-modal__body">
          <section className="settings-section">
            <h3>Aparência</h3>
            <div className="settings-row">
              <span className="settings-row__label">Cor de destaque</span>
              <div className="settings-swatches">
                {ACCENT_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    className={`settings-swatch ${settings.accentColor === p.value ? 'settings-swatch--active' : ''}`}
                    style={{ background: p.value }}
                    title={p.name}
                    onClick={() => onChange({ accentColor: p.value })}
                  />
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Tamanho do texto do chat</span>
              <div className="settings-segmented">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    className={`settings-segmented__btn ${settings.fontSize === size ? 'settings-segmented__btn--active' : ''}`}
                    onClick={() => onChange({ fontSize: size })}
                  >
                    {size === 'small' ? 'Pequeno' : size === 'medium' ? 'Médio' : 'Grande'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3>Pasta padrão</h3>
            <p className="settings-hint">Usada quando você abre o app ou clica em "Nova conversa".</p>
            <div className="settings-row">
              <span className="settings-row__path" title={settings.defaultFolder ?? undefined}>
                {settings.defaultFolder ?? '~/projects/kiro (padrão)'}
              </span>
              <button className="btn btn--ghost settings-row__btn" onClick={pickDefaultFolder}>
                <FolderIcon width={13} height={13} />
                Alterar
              </button>
              {settings.defaultFolder && (
                <button className="btn btn--ghost settings-row__btn" onClick={() => onChange({ defaultFolder: null })}>
                  Restaurar
                </button>
              )}
            </div>
          </section>

          <section className="settings-section">
            <h3>Navegador do Kiro</h3>
            <div className="settings-row settings-row--toggle">
              <div>
                <span className="settings-row__label">Aprovar ações automaticamente</span>
                <p className="settings-hint">
                  Sem pedir confirmação para navegar, tirar print ou ler a página do navegador embutido.
                </p>
              </div>
              <button
                className={`settings-toggle ${settings.browserAutoApprove ? 'settings-toggle--on' : ''}`}
                onClick={() => onChange({ browserAutoApprove: !settings.browserAutoApprove })}
              >
                <span className="settings-toggle__knob" />
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Sobre</h3>
            <p className="settings-hint">Kiro Code {version && `— versão ${version}`}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
