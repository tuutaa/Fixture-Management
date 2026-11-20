/**
 * Master data for fixture step / process / position.
 *
 * Source: Fixture Management drawing + user-provided FAN2 position list.
 * Used by the fixture-list Excel import to validate and repair fixture records.
 * Plain ESM so both Vite and server.js can import it.
 */

export const FIXTURE_POSITION_MASTER = [
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Stopport Impeller' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Permanence yoke' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Insert Rot' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Stopper Yoke' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Vibration rotor' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Support Apply oil' },
  { step: 'STEP ROTOR', process: 'BL Test', position: 'Balance rotor' },
  { step: 'STEP WINDING', process: 'Winding', position: 'Winding (Arbor)' },
  { step: 'STEP WINDING', process: 'Winding', position: 'Winding (Estate shaft)' },
  { step: 'STEP WINDING', process: 'Winding', position: 'Winding (Guard)' },
  { step: 'STEP WINDING', process: 'Winding', position: 'Winding (Tension)' },
  { step: 'STEP WINDING', process: 'Dipping', position: 'Dipping' },
  { step: 'STEP WINDING', process: 'Stator Test', position: 'DCR Test' },
  { step: 'STEP 1', process: 'Solder PWB', position: 'Insert stator with PWB' },
  { step: 'STEP 1', process: 'Solder PWB', position: 'Inspection wire' },
  { step: 'STEP 1', process: 'Solder PWB', position: 'Solder PWB' },
  { step: 'STEP 1', process: 'Cutting PWB', position: 'Cutting PWB' },
  { step: 'STEP 1', process: 'Solder PVC wire', position: 'Solder PVC wire' },
  { step: 'STEP 1', process: 'Apply silicone', position: 'Apply silicone' },
  { step: 'STEP 1', process: 'WIP Silicone', position: 'WIP Silicone' },
  { step: 'STEP 1', process: 'Suport Curing UV', position: 'Suport Curing UV' },
  { step: 'STEP 2', process: 'Frame Transfer', position: 'Frame Transfer' },
  { step: 'STEP 2', process: 'Stator transfer', position: 'Stator transfer' },
  { step: 'STEP 2', process: "Ass'y stator with frame", position: "Ass'y stator with frame" },
  { step: 'STEP 2', process: 'Laser Frame', position: 'Laser Frame' },
  { step: 'STEP 2', process: 'Washer', position: 'Base support washer' },
  { step: 'STEP 2', process: 'Washer', position: 'Nozzle Washer' },
  { step: 'STEP 2', process: 'Fastener', position: 'Fastener' },
  { step: 'STEP 2', process: 'Drop Oil', position: 'Drop Oil' },
  { step: 'STEP 2', process: 'Sleeve', position: 'Base Sleeve' },
  { step: 'STEP 2', process: 'Sleeve', position: 'Pressing Sleeve' },
  { step: 'STEP 2', process: 'Seanlane', position: 'Seanlane' },
  { step: 'STEP 2', process: 'Hotmelt', position: 'Hotmelt' },
  { step: 'STEP 2', process: 'Apply Glue', position: 'Apply Glue' },
  { step: 'STEP 2', process: 'Insert PWB', position: 'Insert PWB' },
  { step: 'STEP 2', process: 'Pressing Stator', position: 'Pressing Stator' },
  { step: 'STEP 2', process: 'Solder Pin', position: 'Solder Pin' },
  { step: 'STEP 2', process: 'Preesing Rotor', position: 'Preesing Rotor' },
  { step: 'STEP 2', process: 'Vaccum & Load Rotor', position: 'Base insert rotor' },
  { step: 'STEP 2', process: 'Auto Label', position: 'Auto Label' },
  { step: 'TEST STEP', process: 'Touch Glass', position: 'Touch Glass' },
  { step: 'TEST STEP', process: 'Wire test', position: 'Wire test' },
  { step: 'TEST STEP', process: 'Inspection Cushion', position: 'Inspection Cushion' },
  { step: 'TEST STEP', process: 'Test Run/Test Current', position: 'Test Run/Test Current' },
  { step: 'TEST STEP', process: 'Noise', position: 'Noise' },
  { step: 'TEST STEP', process: 'Function', position: 'Function Test' },
  { step: 'TEST STEP', process: 'Wire length inspection', position: 'Wire length inspection' },
  { step: 'TEST STEP', process: 'AOI', position: 'AOI' },
  { step: 'STEP 2', process: 'Vacuum FG', position: 'Vacuum FG' },
]

/** Normalise spacing/case differences from imported Excel cells. */
export function normalizeMeta(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([)\]])/g, '$1')
    .trim()
}

const keyOf = (value) => normalizeMeta(value).toLowerCase()

export const MASTER_BY_POSITION = new Map(
  FIXTURE_POSITION_MASTER.map((item) => [keyOf(item.position), item]),
)

/** Return the canonical row for a position, or null when position is unknown. */
export function canonicalPosition(position) {
  return MASTER_BY_POSITION.get(keyOf(position)) || null
}

/** Check an imported row against the canonical step/process/position table. */
export function checkPositionMeta({ step, process, position } = {}) {
  const canonical = canonicalPosition(position)
  if (!canonical) return { canonical: null, matches: false, unknown: true }
  const matches = keyOf(step) === keyOf(canonical.step)
    && keyOf(process) === keyOf(canonical.process)
    && keyOf(position) === keyOf(canonical.position)
  return { canonical, matches, unknown: false }
}
