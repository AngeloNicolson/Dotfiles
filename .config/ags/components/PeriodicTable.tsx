import Gtk from "gi://Gtk?version=3.0"

// Element data: [symbol, name, atomic number, category]
type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth"
  | "transition-metal"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide"

interface Element {
  symbol: string
  name: string
  number: number
  mass: string
  category: ElementCategory
}

const elements: (Element | null)[][] = [
  // Row 1
  [
    { symbol: "H", name: "Hydrogen", number: 1, mass: "1.008", category: "nonmetal" },
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    { symbol: "He", name: "Helium", number: 2, mass: "4.003", category: "noble-gas" },
  ],
  // Row 2
  [
    { symbol: "Li", name: "Lithium", number: 3, mass: "6.941", category: "alkali-metal" },
    { symbol: "Be", name: "Beryllium", number: 4, mass: "9.012", category: "alkaline-earth" },
    null, null, null, null, null, null, null, null, null, null,
    { symbol: "B", name: "Boron", number: 5, mass: "10.81", category: "metalloid" },
    { symbol: "C", name: "Carbon", number: 6, mass: "12.01", category: "nonmetal" },
    { symbol: "N", name: "Nitrogen", number: 7, mass: "14.01", category: "nonmetal" },
    { symbol: "O", name: "Oxygen", number: 8, mass: "16.00", category: "nonmetal" },
    { symbol: "F", name: "Fluorine", number: 9, mass: "19.00", category: "halogen" },
    { symbol: "Ne", name: "Neon", number: 10, mass: "20.18", category: "noble-gas" },
  ],
  // Row 3
  [
    { symbol: "Na", name: "Sodium", number: 11, mass: "22.99", category: "alkali-metal" },
    { symbol: "Mg", name: "Magnesium", number: 12, mass: "24.31", category: "alkaline-earth" },
    null, null, null, null, null, null, null, null, null, null,
    { symbol: "Al", name: "Aluminum", number: 13, mass: "26.98", category: "post-transition" },
    { symbol: "Si", name: "Silicon", number: 14, mass: "28.09", category: "metalloid" },
    { symbol: "P", name: "Phosphorus", number: 15, mass: "30.97", category: "nonmetal" },
    { symbol: "S", name: "Sulfur", number: 16, mass: "32.07", category: "nonmetal" },
    { symbol: "Cl", name: "Chlorine", number: 17, mass: "35.45", category: "halogen" },
    { symbol: "Ar", name: "Argon", number: 18, mass: "39.95", category: "noble-gas" },
  ],
  // Row 4
  [
    { symbol: "K", name: "Potassium", number: 19, mass: "39.10", category: "alkali-metal" },
    { symbol: "Ca", name: "Calcium", number: 20, mass: "40.08", category: "alkaline-earth" },
    { symbol: "Sc", name: "Scandium", number: 21, mass: "44.96", category: "transition-metal" },
    { symbol: "Ti", name: "Titanium", number: 22, mass: "47.87", category: "transition-metal" },
    { symbol: "V", name: "Vanadium", number: 23, mass: "50.94", category: "transition-metal" },
    { symbol: "Cr", name: "Chromium", number: 24, mass: "52.00", category: "transition-metal" },
    { symbol: "Mn", name: "Manganese", number: 25, mass: "54.94", category: "transition-metal" },
    { symbol: "Fe", name: "Iron", number: 26, mass: "55.85", category: "transition-metal" },
    { symbol: "Co", name: "Cobalt", number: 27, mass: "58.93", category: "transition-metal" },
    { symbol: "Ni", name: "Nickel", number: 28, mass: "58.69", category: "transition-metal" },
    { symbol: "Cu", name: "Copper", number: 29, mass: "63.55", category: "transition-metal" },
    { symbol: "Zn", name: "Zinc", number: 30, mass: "65.38", category: "transition-metal" },
    { symbol: "Ga", name: "Gallium", number: 31, mass: "69.72", category: "post-transition" },
    { symbol: "Ge", name: "Germanium", number: 32, mass: "72.63", category: "metalloid" },
    { symbol: "As", name: "Arsenic", number: 33, mass: "74.92", category: "metalloid" },
    { symbol: "Se", name: "Selenium", number: 34, mass: "78.97", category: "nonmetal" },
    { symbol: "Br", name: "Bromine", number: 35, mass: "79.90", category: "halogen" },
    { symbol: "Kr", name: "Krypton", number: 36, mass: "83.80", category: "noble-gas" },
  ],
  // Row 5
  [
    { symbol: "Rb", name: "Rubidium", number: 37, mass: "85.47", category: "alkali-metal" },
    { symbol: "Sr", name: "Strontium", number: 38, mass: "87.62", category: "alkaline-earth" },
    { symbol: "Y", name: "Yttrium", number: 39, mass: "88.91", category: "transition-metal" },
    { symbol: "Zr", name: "Zirconium", number: 40, mass: "91.22", category: "transition-metal" },
    { symbol: "Nb", name: "Niobium", number: 41, mass: "92.91", category: "transition-metal" },
    { symbol: "Mo", name: "Molybdenum", number: 42, mass: "95.95", category: "transition-metal" },
    { symbol: "Tc", name: "Technetium", number: 43, mass: "[98]", category: "transition-metal" },
    { symbol: "Ru", name: "Ruthenium", number: 44, mass: "101.1", category: "transition-metal" },
    { symbol: "Rh", name: "Rhodium", number: 45, mass: "102.9", category: "transition-metal" },
    { symbol: "Pd", name: "Palladium", number: 46, mass: "106.4", category: "transition-metal" },
    { symbol: "Ag", name: "Silver", number: 47, mass: "107.9", category: "transition-metal" },
    { symbol: "Cd", name: "Cadmium", number: 48, mass: "112.4", category: "transition-metal" },
    { symbol: "In", name: "Indium", number: 49, mass: "114.8", category: "post-transition" },
    { symbol: "Sn", name: "Tin", number: 50, mass: "118.7", category: "post-transition" },
    { symbol: "Sb", name: "Antimony", number: 51, mass: "121.8", category: "metalloid" },
    { symbol: "Te", name: "Tellurium", number: 52, mass: "127.6", category: "metalloid" },
    { symbol: "I", name: "Iodine", number: 53, mass: "126.9", category: "halogen" },
    { symbol: "Xe", name: "Xenon", number: 54, mass: "131.3", category: "noble-gas" },
  ],
  // Row 6
  [
    { symbol: "Cs", name: "Cesium", number: 55, mass: "132.9", category: "alkali-metal" },
    { symbol: "Ba", name: "Barium", number: 56, mass: "137.3", category: "alkaline-earth" },
    { symbol: "*", name: "Lanthanides", number: 0, mass: "57-71", category: "lanthanide" },
    { symbol: "Hf", name: "Hafnium", number: 72, mass: "178.5", category: "transition-metal" },
    { symbol: "Ta", name: "Tantalum", number: 73, mass: "180.9", category: "transition-metal" },
    { symbol: "W", name: "Tungsten", number: 74, mass: "183.8", category: "transition-metal" },
    { symbol: "Re", name: "Rhenium", number: 75, mass: "186.2", category: "transition-metal" },
    { symbol: "Os", name: "Osmium", number: 76, mass: "190.2", category: "transition-metal" },
    { symbol: "Ir", name: "Iridium", number: 77, mass: "192.2", category: "transition-metal" },
    { symbol: "Pt", name: "Platinum", number: 78, mass: "195.1", category: "transition-metal" },
    { symbol: "Au", name: "Gold", number: 79, mass: "197.0", category: "transition-metal" },
    { symbol: "Hg", name: "Mercury", number: 80, mass: "200.6", category: "transition-metal" },
    { symbol: "Tl", name: "Thallium", number: 81, mass: "204.4", category: "post-transition" },
    { symbol: "Pb", name: "Lead", number: 82, mass: "207.2", category: "post-transition" },
    { symbol: "Bi", name: "Bismuth", number: 83, mass: "209.0", category: "post-transition" },
    { symbol: "Po", name: "Polonium", number: 84, mass: "[209]", category: "metalloid" },
    { symbol: "At", name: "Astatine", number: 85, mass: "[210]", category: "halogen" },
    { symbol: "Rn", name: "Radon", number: 86, mass: "[222]", category: "noble-gas" },
  ],
  // Row 7
  [
    { symbol: "Fr", name: "Francium", number: 87, mass: "[223]", category: "alkali-metal" },
    { symbol: "Ra", name: "Radium", number: 88, mass: "[226]", category: "alkaline-earth" },
    { symbol: "**", name: "Actinides", number: 0, mass: "89-103", category: "actinide" },
    { symbol: "Rf", name: "Rutherfordium", number: 104, mass: "[267]", category: "transition-metal" },
    { symbol: "Db", name: "Dubnium", number: 105, mass: "[268]", category: "transition-metal" },
    { symbol: "Sg", name: "Seaborgium", number: 106, mass: "[269]", category: "transition-metal" },
    { symbol: "Bh", name: "Bohrium", number: 107, mass: "[270]", category: "transition-metal" },
    { symbol: "Hs", name: "Hassium", number: 108, mass: "[277]", category: "transition-metal" },
    { symbol: "Mt", name: "Meitnerium", number: 109, mass: "[278]", category: "transition-metal" },
    { symbol: "Ds", name: "Darmstadtium", number: 110, mass: "[281]", category: "transition-metal" },
    { symbol: "Rg", name: "Roentgenium", number: 111, mass: "[282]", category: "transition-metal" },
    { symbol: "Cn", name: "Copernicium", number: 112, mass: "[285]", category: "transition-metal" },
    { symbol: "Nh", name: "Nihonium", number: 113, mass: "[286]", category: "post-transition" },
    { symbol: "Fl", name: "Flerovium", number: 114, mass: "[289]", category: "post-transition" },
    { symbol: "Mc", name: "Moscovium", number: 115, mass: "[290]", category: "post-transition" },
    { symbol: "Lv", name: "Livermorium", number: 116, mass: "[293]", category: "post-transition" },
    { symbol: "Ts", name: "Tennessine", number: 117, mass: "[294]", category: "halogen" },
    { symbol: "Og", name: "Oganesson", number: 118, mass: "[294]", category: "noble-gas" },
  ],
]

// Lanthanides (Row 8)
const lanthanides: Element[] = [
  { symbol: "La", name: "Lanthanum", number: 57, mass: "138.9", category: "lanthanide" },
  { symbol: "Ce", name: "Cerium", number: 58, mass: "140.1", category: "lanthanide" },
  { symbol: "Pr", name: "Praseodymium", number: 59, mass: "140.9", category: "lanthanide" },
  { symbol: "Nd", name: "Neodymium", number: 60, mass: "144.2", category: "lanthanide" },
  { symbol: "Pm", name: "Promethium", number: 61, mass: "[145]", category: "lanthanide" },
  { symbol: "Sm", name: "Samarium", number: 62, mass: "150.4", category: "lanthanide" },
  { symbol: "Eu", name: "Europium", number: 63, mass: "152.0", category: "lanthanide" },
  { symbol: "Gd", name: "Gadolinium", number: 64, mass: "157.3", category: "lanthanide" },
  { symbol: "Tb", name: "Terbium", number: 65, mass: "158.9", category: "lanthanide" },
  { symbol: "Dy", name: "Dysprosium", number: 66, mass: "162.5", category: "lanthanide" },
  { symbol: "Ho", name: "Holmium", number: 67, mass: "164.9", category: "lanthanide" },
  { symbol: "Er", name: "Erbium", number: 68, mass: "167.3", category: "lanthanide" },
  { symbol: "Tm", name: "Thulium", number: 69, mass: "168.9", category: "lanthanide" },
  { symbol: "Yb", name: "Ytterbium", number: 70, mass: "173.0", category: "lanthanide" },
  { symbol: "Lu", name: "Lutetium", number: 71, mass: "175.0", category: "lanthanide" },
]

// Actinides (Row 9)
const actinides: Element[] = [
  { symbol: "Ac", name: "Actinium", number: 89, mass: "[227]", category: "actinide" },
  { symbol: "Th", name: "Thorium", number: 90, mass: "232.0", category: "actinide" },
  { symbol: "Pa", name: "Protactinium", number: 91, mass: "231.0", category: "actinide" },
  { symbol: "U", name: "Uranium", number: 92, mass: "238.0", category: "actinide" },
  { symbol: "Np", name: "Neptunium", number: 93, mass: "[237]", category: "actinide" },
  { symbol: "Pu", name: "Plutonium", number: 94, mass: "[244]", category: "actinide" },
  { symbol: "Am", name: "Americium", number: 95, mass: "[243]", category: "actinide" },
  { symbol: "Cm", name: "Curium", number: 96, mass: "[247]", category: "actinide" },
  { symbol: "Bk", name: "Berkelium", number: 97, mass: "[247]", category: "actinide" },
  { symbol: "Cf", name: "Californium", number: 98, mass: "[251]", category: "actinide" },
  { symbol: "Es", name: "Einsteinium", number: 99, mass: "[252]", category: "actinide" },
  { symbol: "Fm", name: "Fermium", number: 100, mass: "[257]", category: "actinide" },
  { symbol: "Md", name: "Mendelevium", number: 101, mass: "[258]", category: "actinide" },
  { symbol: "No", name: "Nobelium", number: 102, mass: "[259]", category: "actinide" },
  { symbol: "Lr", name: "Lawrencium", number: 103, mass: "[266]", category: "actinide" },
]

function ElementCell({ element }: { element: Element | null }) {
  if (!element) {
    return <box name="element-cell-empty" />
  }

  return (
    <button
      name="element-cell"
      class={element.category}
      tooltipText={`${element.name}\nAtomic Mass: ${element.mass}`}
    >
      <box vertical>
        <label name="element-number" label={element.number > 0 ? String(element.number) : ""} />
        <label name="element-symbol" label={element.symbol} />
      </box>
    </button>
  )
}

function LegendItem({ category, label }: { category: string; label: string }) {
  return (
    <box name="legend-item">
      <box name="legend-color" class={category} />
      <label name="legend-label" label={label} />
    </box>
  )
}

export default function PeriodicTable() {
  return (
    <box name="periodic-table" vertical>
      {/* Title bar */}
      <box name="periodic-title-bar">
        <label name="periodic-title" label="Periodic Table of Elements" />
      </box>

      {/* Main table grid */}
      <box name="periodic-grid" vertical>
        {elements.map((row, rowIndex) => (
          <box name="element-row">
            {row.map((element, colIndex) => (
              <ElementCell element={element} />
            ))}
          </box>
        ))}
      </box>

      {/* Separator */}
      <box name="periodic-separator" />

      {/* Lanthanides */}
      <box name="lanthanide-row">
        <box name="series-label">
          <label label="*" />
        </box>
        {lanthanides.map((element, index) => (
          <ElementCell element={element} />
        ))}
      </box>

      {/* Actinides */}
      <box name="actinide-row">
        <box name="series-label">
          <label label="**" />
        </box>
        {actinides.map((element, index) => (
          <ElementCell element={element} />
        ))}
      </box>

      {/* Legend */}
      <box name="periodic-legend">
        <LegendItem category="alkali-metal" label="Alkali Metal" />
        <LegendItem category="alkaline-earth" label="Alkaline Earth" />
        <LegendItem category="transition-metal" label="Transition Metal" />
        <LegendItem category="post-transition" label="Post-Transition" />
        <LegendItem category="metalloid" label="Metalloid" />
        <LegendItem category="nonmetal" label="Nonmetal" />
        <LegendItem category="halogen" label="Halogen" />
        <LegendItem category="noble-gas" label="Noble Gas" />
        <LegendItem category="lanthanide" label="Lanthanide" />
        <LegendItem category="actinide" label="Actinide" />
      </box>
    </box>
  )
}
