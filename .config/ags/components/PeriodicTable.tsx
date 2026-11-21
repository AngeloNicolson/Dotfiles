// Periodic table — standard 18-column IUPAC layout, f-block beneath and aligned
// under groups 3–17. Hover (or tap) an element for its details; hover a legend
// entry to pick out that category.
//
// Data: IUPAC abridged standard atomic weights (2021); bracketed values are the
// mass number of the longest-lived isotope for elements with no stable ones.
// Names use IUPAC spellings (aluminium, caesium). Position, block, phase and
// electron configuration are derived from the atomic number below.

import Gtk from "gi://Gtk?version=3.0"

type Category =
  | "alkali" | "alkaline" | "transition" | "post" | "metalloid" | "nonmetal"
  | "halogen" | "noble" | "lanthanide" | "actinide" | "unknown"

const CATEGORY_LABEL: Record<Category, string> = {
  alkali: "Alkali metal",
  alkaline: "Alkaline earth metal",
  transition: "Transition metal",
  post: "Post-transition metal",
  metalloid: "Metalloid",
  nonmetal: "Reactive nonmetal",
  halogen: "Halogen",
  noble: "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
  unknown: "Unknown properties",
}

// symbol name mass — index = atomic number - 1
const DATA = `
H Hydrogen 1.008|He Helium 4.0026
Li Lithium 6.94|Be Beryllium 9.0122|B Boron 10.81|C Carbon 12.011|N Nitrogen 14.007|O Oxygen 15.999|F Fluorine 18.998|Ne Neon 20.180
Na Sodium 22.990|Mg Magnesium 24.305|Al Aluminium 26.982|Si Silicon 28.085|P Phosphorus 30.974|S Sulfur 32.06|Cl Chlorine 35.45|Ar Argon 39.95
K Potassium 39.098|Ca Calcium 40.078|Sc Scandium 44.956|Ti Titanium 47.867|V Vanadium 50.942|Cr Chromium 51.996|Mn Manganese 54.938|Fe Iron 55.845|Co Cobalt 58.933|Ni Nickel 58.693|Cu Copper 63.546|Zn Zinc 65.38|Ga Gallium 69.723|Ge Germanium 72.630|As Arsenic 74.922|Se Selenium 78.971|Br Bromine 79.904|Kr Krypton 83.798
Rb Rubidium 85.468|Sr Strontium 87.62|Y Yttrium 88.906|Zr Zirconium 91.224|Nb Niobium 92.906|Mo Molybdenum 95.95|Tc Technetium [97]|Ru Ruthenium 101.07|Rh Rhodium 102.91|Pd Palladium 106.42|Ag Silver 107.87|Cd Cadmium 112.41|In Indium 114.82|Sn Tin 118.71|Sb Antimony 121.76|Te Tellurium 127.60|I Iodine 126.90|Xe Xenon 131.29
Cs Caesium 132.91|Ba Barium 137.33|La Lanthanum 138.91|Ce Cerium 140.12|Pr Praseodymium 140.91|Nd Neodymium 144.24|Pm Promethium [145]|Sm Samarium 150.36|Eu Europium 151.96|Gd Gadolinium 157.25|Tb Terbium 158.93|Dy Dysprosium 162.50|Ho Holmium 164.93|Er Erbium 167.26|Tm Thulium 168.93|Yb Ytterbium 173.05|Lu Lutetium 174.97|Hf Hafnium 178.49|Ta Tantalum 180.95|W Tungsten 183.84|Re Rhenium 186.21|Os Osmium 190.23|Ir Iridium 192.22|Pt Platinum 195.08|Au Gold 196.97|Hg Mercury 200.59|Tl Thallium 204.38|Pb Lead 207.2|Bi Bismuth 208.98|Po Polonium [209]|At Astatine [210]|Rn Radon [222]
Fr Francium [223]|Ra Radium [226]|Ac Actinium [227]|Th Thorium 232.04|Pa Protactinium 231.04|U Uranium 238.03|Np Neptunium [237]|Pu Plutonium [244]|Am Americium [243]|Cm Curium [247]|Bk Berkelium [247]|Cf Californium [251]|Es Einsteinium [252]|Fm Fermium [257]|Md Mendelevium [258]|No Nobelium [259]|Lr Lawrencium [262]|Rf Rutherfordium [267]|Db Dubnium [268]|Sg Seaborgium [269]|Bh Bohrium [270]|Hs Hassium [269]|Mt Meitnerium [277]|Ds Darmstadtium [281]|Rg Roentgenium [282]|Cn Copernicium [285]|Nh Nihonium [286]|Fl Flerovium [290]|Mc Moscovium [290]|Lv Livermorium [293]|Ts Tennessine [294]|Og Oganesson [294]
`.trim().split(/[|\n]/).map((s) => s.split(" "))

const NOBLE = [2, 10, 18, 36, 54, 86, 118]
const NOBLE_SYM = ["He", "Ne", "Ar", "Kr", "Xe", "Rn", "Og"]

const set = (...z: number[]) => new Set(z)
const NONMETALS = set(1, 6, 7, 8, 15, 16, 34)
const HALOGENS = set(9, 17, 35, 53, 85)
const METALLOIDS = set(5, 14, 32, 33, 51, 52)
const POST = set(13, 31, 49, 50, 81, 82, 83, 84)
// Chemistry not yet characterised: Mt, Ds, Rg and Nh–Og
const UNKNOWN = set(109, 110, 111, 113, 114, 115, 116, 117, 118)
const GASES = set(1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86)
const LIQUIDS = set(35, 80)

// Ground states that depart from the Madelung (n+l) filling order.
const CONFIG_EXCEPTIONS: Record<number, string> = {
  24: "3d5 4s1", 29: "3d10 4s1",
  41: "4d4 5s1", 42: "4d5 5s1", 44: "4d7 5s1", 45: "4d8 5s1", 46: "4d10", 47: "4d10 5s1",
  57: "5d1 6s2", 58: "4f1 5d1 6s2", 64: "4f7 5d1 6s2", 78: "4f14 5d9 6s1", 79: "4f14 5d10 6s1",
  89: "6d1 7s2", 90: "6d2 7s2", 91: "5f2 6d1 7s2", 92: "5f3 6d1 7s2", 93: "5f4 6d1 7s2",
  96: "5f7 6d1 7s2", 103: "5f14 7s2 7p1",
}

const MADELUNG = "1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p".split(" ")
const CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 }
const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹"
const sup = (s: string) => s.replace(/([spdf])(\d+)/g, (_, l, n: string) => l + [...n].map((d) => SUPER[+d]).join(""))

function electronConfig(z: number): string {
  const coreIdx = NOBLE.findLastIndex((n) => n < z)
  const core = coreIdx >= 0 ? `[${NOBLE_SYM[coreIdx]}] ` : ""
  if (CONFIG_EXCEPTIONS[z]) return core + sup(CONFIG_EXCEPTIONS[z])
  let left = z
  const shells: [string, number][] = []
  for (const sub of MADELUNG) {
    if (left <= 0) break
    const n = Math.min(left, CAPACITY[sub[1]])
    shells.push([sub, n])
    left -= n
  }
  // drop the noble-gas core, then write in shell order (3d before 4s)
  let skip = coreIdx >= 0 ? NOBLE[coreIdx] : 0
  const valence = shells.filter(([, n]) => (skip -= n) < 0)
  valence.sort((a, b) => (+a[0][0] - +b[0][0]) || "spdf".indexOf(a[0][1]) - "spdf".indexOf(b[0][1]))
  return core + sup(valence.map(([s, n]) => s + n).join(" "))
}

interface Element {
  z: number
  symbol: string
  name: string
  mass: string
  category: Category
  period: number
  group: number | null   // null for the f-block
  block: "s" | "p" | "d" | "f"
  col: number            // grid column, 1–18
  row: number            // grid row: 1–7 periods, 9–10 f-block
}

function place(z: number): Pick<Element, "period" | "group" | "block" | "col" | "row"> {
  const period = NOBLE.findIndex((n) => z <= n) + 1
  const i = z - (period > 1 ? NOBLE[period - 2] : 0) // position within the period, from 1
  let group: number | null
  if (period === 1) group = i === 1 ? 1 : 18
  else if (period <= 3) group = i <= 2 ? i : i + 10
  else if (period <= 5) group = i
  else group = i <= 2 ? i : i <= 17 ? null : i - 14
  if (group === null) return { period, group, block: "f", col: i, row: period + 3 }
  const block = z === 2 || group <= 2 ? "s" : group <= 12 ? "d" : "p"
  return { period, group, block, col: group, row: period }
}

function categoryOf(z: number, p: ReturnType<typeof place>): Category {
  if (UNKNOWN.has(z)) return "unknown"
  if (p.block === "f") return p.period === 6 ? "lanthanide" : "actinide"
  if (NONMETALS.has(z)) return "nonmetal"
  if (HALOGENS.has(z)) return "halogen"
  if (METALLOIDS.has(z)) return "metalloid"
  if (POST.has(z)) return "post"
  if (p.group === 18) return "noble"
  if (p.group === 1) return "alkali"
  if (p.group === 2) return "alkaline"
  return "transition"
}

const ELEMENTS: Element[] = DATA.map(([symbol, name, mass], idx) => {
  const z = idx + 1
  const p = place(z)
  return { z, symbol, name, mass, category: categoryOf(z, p), ...p }
})

function phase(z: number): string {
  if (z >= 100) return "UNKNOWN"
  return GASES.has(z) ? "GAS" : LIQUIDS.has(z) ? "LIQUID" : "SOLID"
}

const label = (name: string, text = "", xalign = 0.5) =>
  (<label name={name} label={text} xalign={xalign} />) as Gtk.Label

export default function PeriodicTable() {
  const cells: { el: Element, widget: Gtk.Widget }[] = []
  let active: Gtk.Widget | null = null
  let tileCategory: Category | null = null

  // ── Detail panel (sits in the gap above the d-block) ──
  const tileNumber = label("pt-tile-num", "", 0)
  const tileSymbol = label("pt-tile-sym")
  const tileMass = label("pt-tile-mass")
  const tile = (
    <box name="pt-tile" vertical valign={Gtk.Align.CENTER}>
      {tileNumber}{tileSymbol}{tileMass}
    </box>
  ) as Gtk.Box
  const dName = label("pt-detail-name", "", 0)
  const dCategory = label("pt-detail-cat", "", 0)
  const dConfig = label("pt-detail-value", "", 0)
  const dPosition = label("pt-detail-value", "", 0)
  const dPhase = label("pt-detail-value", "", 0)
  const row = (key: string, value: Gtk.Label) => (
    <box name="pt-detail-row">{label("pt-detail-key", key, 0)}{value}</box>
  )
  const detail = (
    <box name="pt-detail" valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER}>
      {tile}
      <box vertical valign={Gtk.Align.CENTER}>
        {dName}
        {dCategory}
        {row("CONFIG", dConfig)}
        {row("POSITION", dPosition)}
        {row("STP", dPhase)}
      </box>
    </box>
  ) as Gtk.Widget

  function select(el: Element, widget: Gtk.Widget) {
    active?.get_style_context().remove_class("active")
    active = widget
    widget.get_style_context().add_class("active")

    for (const w of [tile, dCategory]) {
      const ctx = w.get_style_context()
      if (tileCategory) ctx.remove_class(tileCategory)
      ctx.add_class(el.category)
    }
    tileCategory = el.category

    tileNumber.label = String(el.z)
    tileSymbol.label = el.symbol
    tileMass.label = el.mass
    dName.label = el.name.toUpperCase()
    dCategory.label = CATEGORY_LABEL[el.category].toUpperCase()
    dConfig.label = electronConfig(el.z)
    dPosition.label = `${el.group ? `GROUP ${el.group}` : "F-BLOCK"} · PERIOD ${el.period} · ${el.block}-BLOCK`
    dPhase.label = phase(el.z)
  }

  function highlight(category: Category | null) {
    for (const { el, widget } of cells) {
      const ctx = widget.get_style_context()
      if (category && el.category !== category) ctx.add_class("dim")
      else ctx.remove_class("dim")
    }
  }

  // ── Grid: col 0 = period labels, row 0 = group labels, row 8 = spacer ──
  const grid = new Gtk.Grid({ visible: true, name: "pt-grid" })

  for (let g = 1; g <= 18; g++) grid.attach(label("pt-axis", String(g)), g, 0, 1, 1)
  for (let p = 1; p <= 7; p++) grid.attach(label("pt-axis", String(p)), 0, p, 1, 1)

  for (const el of ELEMENTS) {
    const widget = (
      <button
        name="pt-cell"
        class={el.category}
        onClicked={(self) => select(el, self)}
        onEnterNotifyEvent={(self) => { select(el, self); return false }}
      >
        <box vertical>
          {label("pt-num", String(el.z), 0)}
          {label("pt-sym", el.symbol)}
          {label("pt-mass", el.mass)}
        </box>
      </button>
    ) as Gtk.Widget
    cells.push({ el, widget })
    grid.attach(widget, el.col, el.row, 1, 1)
  }

  // Group-3 slots in periods 6/7 point down to the f-block rows
  const fSlot = (category: Category, range: string, mark: string, row: number) => {
    grid.attach(
      (<box name="pt-fslot" class={category} vertical valign={Gtk.Align.CENTER}>
        {label("pt-fslot-range", range)}
        {label("pt-fslot-mark", mark)}
      </box>) as Gtk.Widget,
      3, row, 1, 1,
    )
  }
  fSlot("lanthanide", "57–71", "La–Lu", 6)
  fSlot("actinide", "89–103", "Ac–Lr", 7)

  grid.attach((<box name="pt-gap" />) as Gtk.Widget, 1, 8, 18, 1)
  grid.attach(label("pt-series", "LANTHANIDES", 1), 1, 9, 2, 1)
  grid.attach(label("pt-series", "ACTINIDES", 1), 1, 10, 2, 1)

  grid.attach(detail, 3, 1, 10, 3)

  select(ELEMENTS[0], cells[0].widget)

  return (
    <box name="periodic-table" vertical>
      {grid}
      <box name="pt-legend" halign={Gtk.Align.CENTER}>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((category) => (
          <eventbox
            onEnterNotifyEvent={() => { highlight(category); return false }}
            onLeaveNotifyEvent={() => { highlight(null); return false }}
          >
            <box name="pt-legend-item">
              <box name="pt-swatch" class={category} valign={Gtk.Align.CENTER} />
              {label("pt-legend-label", CATEGORY_LABEL[category].toUpperCase(), 0)}
            </box>
          </eventbox>
        ))}
      </box>
    </box>
  )
}
