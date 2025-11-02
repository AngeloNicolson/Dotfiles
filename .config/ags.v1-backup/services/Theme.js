class ThemeService extends Service {
  static {
    Service.register(
      this,
      {
        'theme-changed': ['string'], // theme name
      },
      {
        'current-theme': ['string', 'r'],
        'available-themes': ['jsobject', 'r'],
      }
    )
  }

  #currentTheme = 'gruvbox'
  #availableThemes = ['gruvbox', 'cassette-futurism']

  get current_theme() {
    return this.#currentTheme
  }

  get available_themes() {
    return this.#availableThemes
  }

  constructor() {
    super()
    this.#loadTheme()
  }

  #loadTheme() {
    // Load saved theme from state file
    try {
      const stateFile = `${App.configDir}/.states.json`
      const state = JSON.parse(Utils.readFile(stateFile))
      if (state.theme && this.#availableThemes.includes(state.theme)) {
        this.#currentTheme = state.theme
      }
    } catch (e) {
      console.log('No saved theme state, using default')
    }
  }

  #saveTheme() {
    try {
      const stateFile = `${App.configDir}/.states.json`
      let state = {}
      try {
        state = JSON.parse(Utils.readFile(stateFile))
      } catch (e) {
        // File doesn't exist or invalid JSON
      }
      state.theme = this.#currentTheme
      Utils.writeFile(JSON.stringify(state, null, 2), stateFile)
    } catch (e) {
      console.log('Failed to save theme state:', e)
    }
  }

  setTheme(themeName) {
    if (!this.#availableThemes.includes(themeName)) {
      console.log(`Theme not found: ${themeName}`)
      return false
    }

    this.#currentTheme = themeName
    this.#saveTheme()
    this.emit('theme-changed', themeName)
    this.notify('current-theme')

    // Recompile and apply CSS
    this.#applyTheme()

    return true
  }

  #applyTheme() {
    const scss = `${App.configDir}/themes/${this.#currentTheme}-compiled.scss`
    const css = `${App.configDir}/out.css`

    // Compile SCSS with theme
    Utils.exec(`sassc ${scss} ${css}`)

    // Apply the compiled CSS
    App.resetCss()
    App.applyCss(css)

    console.log(`Applied theme: ${this.#currentTheme}`)
  }

  nextTheme() {
    const currentIndex = this.#availableThemes.indexOf(this.#currentTheme)
    const nextIndex = (currentIndex + 1) % this.#availableThemes.length
    this.setTheme(this.#availableThemes[nextIndex])
  }

  connect(event = 'theme-changed', callback) {
    return super.connect(event, callback)
  }
}

export default new ThemeService
