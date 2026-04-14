/**
 * Unit tests for the Poisson-based probability engine.
 * Pure math — no DB, no Firebase, no network.
 */

function poissonProb(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let p = Math.exp(-lambda)
  for (let i = 0; i < k; i++) p *= lambda / (i + 1)
  return p
}

function overProb(lambda, threshold) {
  let cumP = 0
  for (let k = 0; k <= threshold; k++) cumP += poissonProb(lambda, k)
  return Math.round(Math.max(0, Math.min(1, 1 - cumP)) * 100)
}

function scoreToOutcome(totalScore) {
  const x       = totalScore / 18
  const rawHome = 1 / (1 + Math.exp(-x * 1.5))
  const rawAway = 1 / (1 + Math.exp(x  * 1.5))
  const drawPk  = Math.exp(-(x * x) * 2.5) * 0.30
  const total   = rawHome + rawAway + drawPk
  const home    = Math.round(rawHome / total * 100)
  const away    = Math.round(rawAway / total * 100)
  return { home, draw: Math.max(0, 100 - home - away), away }
}

function formPoints(form) {
  if (!form) return 0
  return [...form].reduce((acc, c) => acc + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0)
}

describe('poissonProb', () => {
  test('P(0 goals | λ=0) = 1', () => expect(poissonProb(0, 0)).toBe(1))
  test('P(1+ goals | λ=0) = 0', () => {
    expect(poissonProb(0, 1)).toBe(0)
    expect(poissonProb(0, 3)).toBe(0)
  })
  test('P(0 goals | λ=1.5) ≈ 0.223', () => expect(poissonProb(1.5, 0)).toBeCloseTo(0.2231, 3))
  test('P(1 goal | λ=1.5) ≈ 0.335',  () => expect(poissonProb(1.5, 1)).toBeCloseTo(0.3347, 3))
  test('P(2 goals | λ=1.5) ≈ 0.251', () => expect(poissonProb(1.5, 2)).toBeCloseTo(0.2510, 3))
  test('probabilities sum close to 1', () => {
    let total = 0
    for (let k = 0; k <= 20; k++) total += poissonProb(2.5, k)
    expect(total).toBeCloseTo(1, 4)
  })
})

describe('overProb', () => {
  test('over 0.5 with λ=2.5 is very high (≥90%)', () => expect(overProb(2.5, 0)).toBeGreaterThanOrEqual(90))
  test('over 2.5 with λ=1.0 is low (<30%)',        () => expect(overProb(1.0, 2)).toBeLessThan(30))
  test('over 2.5 with λ=3.0 is high (>55%)',       () => expect(overProb(3.0, 2)).toBeGreaterThan(55))
  test('over 3.5 always ≤ over 2.5 for same lambda', () => {
    expect(overProb(2.5, 3)).toBeLessThanOrEqual(overProb(2.5, 2))
  })
  test('result is clamped 0–100', () => {
    expect(overProb(0,   2)).toBeGreaterThanOrEqual(0)
    expect(overProb(100, 2)).toBeLessThanOrEqual(100)
  })
  test('over 1.5 ≥ over 2.5 ≥ over 3.5 for any lambda', () => {
    for (const lambda of [0.5, 1.5, 2.5, 3.5]) {
      expect(overProb(lambda, 1)).toBeGreaterThanOrEqual(overProb(lambda, 2))
      expect(overProb(lambda, 2)).toBeGreaterThanOrEqual(overProb(lambda, 3))
    }
  })
})

describe('scoreToOutcome', () => {
  test('balanced match (score 0) → home ≈ away, sum = 100', () => {
    const { home, draw, away } = scoreToOutcome(0)
    expect(home + draw + away).toBe(100)
    expect(Math.abs(home - away)).toBeLessThanOrEqual(5)
  })
  test('strong home advantage (score 20) → home > 70%', () => {
    const { home, draw, away } = scoreToOutcome(20)
    expect(home + draw + away).toBe(100)
    expect(home).toBeGreaterThan(70)
  })
  test('strong away advantage (score -20) → away > 70%', () => {
    const { home, draw, away } = scoreToOutcome(-20)
    expect(home + draw + away).toBe(100)
    expect(away).toBeGreaterThan(70)
  })
  test('probabilities always sum to 100', () => {
    for (const s of [-30, -15, 0, 15, 30]) {
      const { home, draw, away } = scoreToOutcome(s)
      expect(home + draw + away).toBe(100)
    }
  })
})

describe('formPoints', () => {
  test('WWWWW = 15', () => expect(formPoints('WWWWW')).toBe(15))
  test('LLLLL = 0',  () => expect(formPoints('LLLLL')).toBe(0))
  test('WDWDW = 11', () => expect(formPoints('WDWDW')).toBe(11))
  test('WWDLL = 7',  () => expect(formPoints('WWDLL')).toBe(7))
  test('empty/null = 0', () => {
    expect(formPoints('')).toBe(0)
    expect(formPoints(null)).toBe(0)
    expect(formPoints(undefined)).toBe(0)
  })
})

describe('BTTS probability', () => {
  test('high lambdas produce higher BTTS than low lambdas', () => {
    const bttsHigh = (1 - Math.exp(-2.5)) * (1 - Math.exp(-2.0))
    const bttsLow  = (1 - Math.exp(-0.5)) * (1 - Math.exp(-0.5))
    expect(bttsHigh).toBeGreaterThan(bttsLow)
    expect(bttsHigh).toBeGreaterThan(0.7)
    expect(bttsLow).toBeLessThan(0.4)
  })
})
