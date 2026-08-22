// Single source of truth for the sidebar's pages: order, ids, tab metadata.
// state.ts derives its cycling order from this and Sidebar.tsx maps each id to
// its component — adding a page means one entry here plus its component mapping.
// Deliberately import-free so neither state.ts nor components can form a cycle
// through it.

export interface PageDef {
  id: string
  icon: string
  label: string
}

export const PAGES: PageDef[] = [
  { id: "home", icon: "", label: "HOME" },
  { id: "planner", icon: "", label: "PLAN" },
  { id: "pomodoro", icon: "", label: "POMO" },
  { id: "apps", icon: "", label: "APPS" },
  { id: "core", icon: "", label: "CORE" },
  { id: "power", icon: "", label: "PWR" },
]

export const pageIds = PAGES.map((p) => p.id)

// Pre-registry builds used "page1".."page6"; persisted state may still say so.
export const LEGACY_PAGE_IDS: Record<string, string> = {
  page1: "home",
  page2: "planner",
  page3: "pomodoro",
  page4: "apps",
  page5: "core",
  page6: "power",
}
