import { describe, it, expect } from 'vitest';

import { haversineMeters } from './distance';

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(1.3521, 103.8198, 1.3521, 103.8198)).toBe(0);
  });

  it('measures a short walk to within a few percent', () => {
    // ~111m north (0.001° latitude) near the equator.
    const d = haversineMeters(1.3521, 103.8198, 1.3531, 103.8198);
    expect(d).toBeGreaterThan(108);
    expect(d).toBeLessThan(114);
  });
});
