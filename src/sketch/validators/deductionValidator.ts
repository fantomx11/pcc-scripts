import type { OpeningDefaults, WallMeta } from '../types';

export const SQ_UNITS_PER_SQ_FT = 2322576;

export function hasUnsetDeductions(defaults: OpeningDefaults, wallMetaList: WallMeta[]): boolean {
  const isDeductUnset =
    defaults.doorDeductArea <= 0 &&
    defaults.windowDeductArea <= 0 &&
    defaults.missingWallDeductArea <= 0;

  const hasAnyOpenings = wallMetaList.some(
    m => (m.openings && m.openings.length > 0) || m.isInvisible
  );

  return isDeductUnset && hasAnyOpenings;
}

export function toXactimateDeductUnits(sqFt: number): string {
  return ((sqFt || 0.0) * SQ_UNITS_PER_SQ_FT).toFixed(7);
}