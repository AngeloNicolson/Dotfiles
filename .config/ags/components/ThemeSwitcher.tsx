import { applyTheme } from "../theme"

function ThemeButton({ name, displayName }: { name: string; displayName: string }) {
  return (
    <button
      name="theme-button"
      onClicked={() => applyTheme(name)}
    >
      <label label={displayName} />
    </button>
  )
}

export default function ThemeSwitcher() {
  return (
    <box vertical name="page-box">
      <label name="theme-title" label="Themes" />
      <ThemeButton name="mech" displayName="Mech" />
      <ThemeButton name="e-ink" displayName="E-Ink" />
      <ThemeButton name="famicom" displayName="Famicom" />
    </box>
  )
}
