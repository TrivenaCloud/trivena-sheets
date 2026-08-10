import { describe, it, expect } from 'vitest'
import { packSheet, packSheetChunked, unpackSheet, boundsOf } from './sheet-codec.js'

const roundtrip = (snap) => unpackSheet(JSON.parse(JSON.stringify(packSheet(snap))))

describe('sheet-codec pack/unpack', () => {
  it('round-trips a simple sheet', () => {
    const snap = { current: 'Sheet1', sheets: { Sheet1: { A1: 'Date', B1: 'Day', A2: '2013-11-26', B2: '26' } } }
    expect(roundtrip(snap)).toEqual(snap)
  })

  it('round-trips multiple sheets and a non-default current', () => {
    const snap = {
      current: 'Data',
      sheets: { Sheet1: { A1: 'x' }, Data: { C3: 'hi', AA10: 'wide' } },
    }
    expect(roundtrip(snap)).toEqual(snap)
  })

  it('preserves formulas and unicode verbatim', () => {
    const snap = { current: 'Sheet1', sheets: { Sheet1: { A1: '=SUM(B1:B9)', B1: 'héllo 🌍' } } }
    expect(roundtrip(snap)).toEqual(snap)
  })

  it('drops empty / nullish cells rather than materialising them', () => {
    const snap = { current: 'Sheet1', sheets: { Sheet1: { A1: 'keep', B1: '', C1: null } } }
    expect(roundtrip(snap)).toEqual({ current: 'Sheet1', sheets: { Sheet1: { A1: 'keep' } } })
  })

  it('handles sparse columns via holes without inventing cells', () => {
    // Only column C populated → row array has holes at A/B that must not
    // reappear as empty cells on the way back.
    const packed = packSheet({ current: 'Sheet1', sheets: { Sheet1: { C1: 'x' } } })
    expect(packed.sheets.Sheet1.rows['0']).toEqual([undefined, undefined, 'x'])
    expect(unpackSheet(JSON.parse(JSON.stringify(packed)))).toEqual({
      current: 'Sheet1',
      sheets: { Sheet1: { C1: 'x' } },
    })
  })

  it('tags the envelope with a version marker', () => {
    expect(packSheet({ current: 'Sheet1', sheets: {} }).v).toBe(2)
  })

  it('passes legacy (unversioned) payloads through unpack unchanged', () => {
    const legacy = { current: 'Sheet1', sheets: { Sheet1: { A1: 'old' } } }
    expect(unpackSheet(legacy)).toBe(legacy)
  })

  it('passes null/garbage through unpack without throwing', () => {
    expect(unpackSheet(null)).toBe(null)
    expect(unpackSheet('legacy-string')).toBe('legacy-string')
  })

  it('boundsOf derives each sheet extent from the packed payload', () => {
    const packed = packSheet({
      current: 'Sheet1',
      sheets: { Sheet1: { A1: 'x', C5: 'y' }, Two: { B2: 'z' } },
    })
    expect(boundsOf(packed)).toEqual({
      Sheet1: { maxRow: 4, maxCol: 2 },  // C5 → row 4, col 2
      Two:    { maxRow: 1, maxCol: 1 },  // B2 → row 1, col 1
    })
  })

  it('boundsOf returns null for legacy / non-packed input', () => {
    expect(boundsOf({ current: 'Sheet1', sheets: { Sheet1: { A1: 'x' } } })).toBe(null)
    expect(boundsOf(null)).toBe(null)
  })

  it('packSheetChunked is byte-identical to packSheet (even across yields)', async () => {
    const snap = {
      current: 'Sheet1',
      sheets: {
        Sheet1: Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`A${i + 1}`, `v${i}`])),
        Two:    { C3: 'x', AA10: 'wide', B1: '=SUM(A1:A9)' },
      },
    }
    // yieldEvery:10 forces many event-loop yields mid-pack.
    const chunked = await packSheetChunked(snap, { yieldEvery: 10 })
    expect(chunked).toEqual(packSheet(snap))
    expect(unpackSheet(JSON.parse(JSON.stringify(chunked)))).toEqual(snap)
  })
})
