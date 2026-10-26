// Wallpaper library — one recursive scan of ~/.config/ags/wallpapers, split
// into categories for the carousel's filter chips, plus starred favourites.
//
// Layout on disk:
//   wallpapers/43pr-*.jpg              loose files, grouped by name prefix
//   wallpapers/destiny/01-earth/*.jpg  a set with sub-categories (NN- sorts them)
//   wallpapers/<set>-originals/        untouched sources, never listed
//   wallpapers/*.mp4                   live wallpapers (mpvpaper), group "live"
//
// Loose files whose prefix is shared by fewer than PREFIX_MIN files land in
// "misc" so one-off names don't each get their own chip.

import GLib from "gi://GLib"
import { favouriteWallpapers, setFavouriteWallpapers } from "../state"

export const WALLPAPER_DIR = GLib.get_home_dir() + "/.config/ags/wallpapers"
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mkv", ".avi", ".mov"]
const PREFIX_MIN = 5

export interface Wallpaper {
  path: string
  group: string   // top-level set: "43pr", "destiny", "misc"
  sub: string     // sub-category dir ("01-earth"), "" for loose files
}

export interface Category {
  id: string      // group, or "group/sub"
  label: string
  count: number
}

const isImage = (name: string) => IMAGE_EXTENSIONS.some((e) => name.toLowerCase().endsWith(e))
export const isVideo = (name: string) => VIDEO_EXTENSIONS.some((e) => name.toLowerCase().endsWith(e))

function listDir(dir: string): string[] {
  const out: string[] = []
  try {
    const d = GLib.Dir.open(dir, 0)
    let name: string | null
    while ((name = d.read_name()) !== null) if (!name.startsWith(".")) out.push(name)
    d.close()
  } catch {}
  return out.sort()
}

function walk(dir: string, into: string[]) {
  for (const name of listDir(dir)) {
    const full = `${dir}/${name}`
    if (GLib.file_test(full, GLib.FileTest.IS_DIR)) {
      if (!name.endsWith("-originals")) walk(full, into)
    } else if (isImage(name)) into.push(full)
  }
}

export function scanWallpapers(): Wallpaper[] {
  const files: string[] = []
  walk(WALLPAPER_DIR, files)

  const prefixOf = (name: string) => name.match(/^([^-_.]+)[-_]/)?.[1].toLowerCase() ?? ""
  const prefixCount = new Map<string, number>()
  const rel = files.map((f) => f.slice(WALLPAPER_DIR.length + 1).split("/"))
  for (const parts of rel) {
    if (parts.length !== 1) continue
    const p = prefixOf(parts[0])
    prefixCount.set(p, (prefixCount.get(p) ?? 0) + 1)
  }

  const images = files.map((path, i) => {
    const parts = rel[i]
    if (parts.length > 1) return { path, group: parts[0], sub: parts.slice(1, -1).join("/") }
    const p = prefixOf(parts[0])
    return { path, group: p && (prefixCount.get(p) ?? 0) >= PREFIX_MIN ? p : "misc", sub: "" }
  })
  const videos = listDir(WALLPAPER_DIR).filter(isVideo)
    .map((name) => ({ path: `${WALLPAPER_DIR}/${name}`, group: "live", sub: "" }))
  return [...images, ...videos]
}

// "01-earth" → "EARTH", "jovian-moons" → "JOVIAN MOONS"
export function prettyName(s: string): string {
  return s.replace(/^\d+[-_. ]+/, "").replace(/[-_]+/g, " ").toUpperCase()
}

export function groupsOf(walls: Wallpaper[]): Category[] {
  const counts = new Map<string, number>()
  for (const w of walls) counts.set(w.group, (counts.get(w.group) ?? 0) + 1)
  return [...counts.keys()]
    .sort((a, b) => (a === "misc" ? 1 : b === "misc" ? -1 : a.localeCompare(b)))
    .map((g) => ({ id: g, label: prettyName(g), count: counts.get(g)! }))
}

export function subsOf(walls: Wallpaper[], group: string): Category[] {
  const counts = new Map<string, number>()
  for (const w of walls) if (w.group === group && w.sub) counts.set(w.sub, (counts.get(w.sub) ?? 0) + 1)
  return [...counts.keys()].sort()
    .map((s) => ({ id: `${group}/${s}`, label: prettyName(s.split("/").pop()!), count: counts.get(s)! }))
}

// ── Favourites ──
const relPath = (path: string) =>
  path.startsWith(WALLPAPER_DIR + "/") ? path.slice(WALLPAPER_DIR.length + 1) : path

export function isFavourite(path: string): boolean {
  return favouriteWallpapers.get().includes(relPath(path))
}

export function toggleFavourite(path: string) {
  const r = relPath(path)
  const cur = favouriteWallpapers.get()
  setFavouriteWallpapers(cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r])
}

// Favourites that still exist on disk, as absolute paths, in starred order.
export function favouritePaths(): string[] {
  return favouriteWallpapers.get()
    .map((r) => `${WALLPAPER_DIR}/${r}`)
    .filter((p) => GLib.file_test(p, GLib.FileTest.EXISTS))
}
