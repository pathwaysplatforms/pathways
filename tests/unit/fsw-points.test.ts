import { describe, it, expect } from 'vitest';
import { computeFswEstimate } from '@/lib/fsw-points';
import type { CrsProfileSource } from '@/lib/crs-input';

const STRONG_PROFILE: CrsProfileSource = {
  date_of_birth: '1992-06-15',       // age 33 → 12 pts
  education_level: 'masters',        // 23 pts
  clb_speaking: 9,
  clb_listening: 9,
  clb_reading: 9,
  clb_writing: 9,                    // 24 pts language
  canadian_work_years: 3,            // experience: 2-3 yrs → 11 pts; also 10 pts adaptability
  has_canadian_job_offer: false,
  has_sibling_in_canada: false,
  noc_teer_category: 1,
  // total: 12 + 23 + 24 + 11 + 0 + 10 = 80 pts
};

describe('computeFswEstimate', () => {
  it('returns null when fewer than 3 scoreable fields', () => {
    const result = computeFswEstimate({ education_level: 'bachelors' });
    expect(result).toBeNull();
  });

  it('marks a strong profile as eligible', () => {
    const result = computeFswEstimate(STRONG_PROFILE);
    expect(result).not.toBeNull();
    expect(result!.eligible).toBe(true);
    expect(result!.score).toBeGreaterThanOrEqual(67);
    expect(result!.ineligibleReason).toBeNull();
  });

  it('scores max 12 age points for age 18-35', () => {
    const result = computeFswEstimate(STRONG_PROFILE);
    expect(result!.breakdown.age).toBe(12);
  });

  it('scores max language points (24) for all CLB 9', () => {
    const result = computeFswEstimate(STRONG_PROFILE);
    expect(result!.breakdown.language).toBe(24);
  });

  it('marks profile ineligible when below CLB 7', () => {
    const result = computeFswEstimate({
      ...STRONG_PROFILE,
      clb_speaking: 6,
    });
    expect(result!.eligible).toBe(false);
    expect(result!.ineligibleReason).toMatch(/CLB 7/);
  });

  it('marks TEER 4-5 occupation as ineligible', () => {
    const result = computeFswEstimate({
      ...STRONG_PROFILE,
      noc_teer_category: 4,
    });
    expect(result!.eligible).toBe(false);
    expect(result!.ineligibleReason).toMatch(/TEER 4/);
  });

  it('adds arranged employment points when has_canadian_job_offer is true', () => {
    const withJobOffer = computeFswEstimate({
      ...STRONG_PROFILE,
      has_canadian_job_offer: true,
    });
    const without = computeFswEstimate(STRONG_PROFILE);
    expect(withJobOffer!.breakdown.arrangedEmployment).toBe(10);
    expect(without!.breakdown.arrangedEmployment).toBe(0);
  });

  it('scores 0 work experience for under 1 year', () => {
    const result = computeFswEstimate({
      ...STRONG_PROFILE,
      canadian_work_years: 0,
      foreign_work_years: 0,
      years_experience: 0,
    });
    expect(result!.breakdown.experience).toBe(0);
  });

  it('caps adaptability at 10 pts even when multiple factors apply', () => {
    const result = computeFswEstimate({
      ...STRONG_PROFILE,
      canadian_work_years: 2,
      has_sibling_in_canada: true,
      has_canadian_job_offer: true,
    });
    expect(result!.breakdown.adaptability).toBeLessThanOrEqual(10);
  });

  it('marks a profile with score < 67 as ineligible', () => {
    const result = computeFswEstimate({
      date_of_birth: '1975-01-01',    // age 51 → 0 pts
      education_level: 'secondary',  // 5 pts
      clb_speaking: 7,
      clb_listening: 7,
      clb_reading: 7,
      clb_writing: 7,                // 16 pts
      canadian_work_years: 1,        // 9 pts + 10 pts adaptability
      noc_teer_category: 2,
    });
    // 0 + 5 + 16 + 9 + 0 + 10 = 40 pts — below 67
    expect(result!.eligible).toBe(false);
    expect(result!.score).toBeLessThan(67);
  });
});
