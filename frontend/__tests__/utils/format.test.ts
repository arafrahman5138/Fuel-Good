import {
  fmtScore,
  fmtGrams,
  fmtCal,
  fmtCalParts,
  pluralize,
} from '../../utils/format';

describe('fmtScore', () => {
  it('renders em dash for nullish', () => {
    expect(fmtScore(null)).toBe('—');
    expect(fmtScore(undefined)).toBe('—');
    expect(fmtScore(NaN)).toBe('—');
  });

  it('rounds to integer', () => {
    expect(fmtScore(87.4)).toBe('87');
    expect(fmtScore(87.5)).toBe('88');
    expect(fmtScore(0)).toBe('0');
    expect(fmtScore(100)).toBe('100');
  });
});

describe('fmtGrams', () => {
  it('renders em dash for nullish', () => {
    expect(fmtGrams(null)).toBe('—');
    expect(fmtGrams(undefined)).toBe('—');
  });

  it('rounds and appends space-free g suffix', () => {
    expect(fmtGrams(142)).toBe('142g');
    expect(fmtGrams(141.6)).toBe('142g');
    expect(fmtGrams(0.4)).toBe('0g');
    expect(fmtGrams(0)).toBe('0g');
  });

  it('honors decimals option', () => {
    expect(fmtGrams(1.25, { decimals: 1 })).toBe('1.3g');
    expect(fmtGrams(5, { decimals: 1 })).toBe('5.0g');
  });
});

describe('fmtCal', () => {
  it('renders em dash for nullish', () => {
    expect(fmtCal(null)).toBe('—');
    expect(fmtCal(undefined)).toBe('—');
  });

  it('groups thousands and appends " cal"', () => {
    expect(fmtCal(2459)).toBe('2,459 cal');
    expect(fmtCal(2459.4)).toBe('2,459 cal');
    expect(fmtCal(950)).toBe('950 cal');
    expect(fmtCal(0)).toBe('0 cal');
    expect(fmtCal(1234567)).toBe('1,234,567 cal');
  });
});

describe('fmtCalParts', () => {
  it('splits value and unit so callers never concat', () => {
    expect(fmtCalParts(2459)).toEqual({ value: '2,459', unit: 'cal' });
    expect(fmtCalParts(80)).toEqual({ value: '80', unit: 'cal' });
  });

  it('renders em dash value for nullish', () => {
    expect(fmtCalParts(null)).toEqual({ value: '—', unit: 'cal' });
    expect(fmtCalParts(undefined)).toEqual({ value: '—', unit: 'cal' });
  });

  it('stays consistent with fmtCal', () => {
    const { value, unit } = fmtCalParts(2459);
    expect(`${value} ${unit}`).toBe(fmtCal(2459));
  });
});

describe('pluralize', () => {
  it('uses singular at exactly 1', () => {
    expect(pluralize(1, 'day')).toBe('1 day');
    expect(pluralize(1, 'person', 'people')).toBe('1 person');
  });

  it('defaults plural to singular + s', () => {
    expect(pluralize(0, 'day')).toBe('0 days');
    expect(pluralize(2, 'week')).toBe('2 weeks');
  });

  it('supports irregular plurals', () => {
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
    expect(pluralize(0, 'person', 'people')).toBe('0 people');
  });
});
