import { state } from './utils.js'

export const revealSideBar = state('reveal_sidebar', false)
export const sidebarShown = state('sidebar_shown', 'home')
export const breakPopupEnabled = state('break_popup_enabled', false)
