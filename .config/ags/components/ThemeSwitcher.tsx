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
    <box vertical name="home-page">
      <label name="section-header" label="//THEMES" />
      <ThemeButton name="mech" displayName="MECH" />
      <ThemeButton name="e-ink" displayName="E-INK" />
      <ThemeButton name="famicom" displayName="FAMICOM" />
    </box>
  )
}
