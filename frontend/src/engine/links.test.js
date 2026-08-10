import { describe, it, expect } from 'vitest'
import { detectHyperlink, isAutoLinkText } from './links.js'

describe('detectHyperlink', () => {
	it('accepts full http(s) URLs as-is', () => {
		expect(detectHyperlink('https://trivena.io/')).toBe('https://trivena.io/')
		expect(detectHyperlink('http://example.com/a?b=1#c')).toBe('http://example.com/a?b=1#c')
		expect(detectHyperlink('  https://trivena.io  ')).toBe('https://trivena.io')
	})

	it('prefixes www. and bare common-TLD domains with https://', () => {
		expect(detectHyperlink('www.trivena.io')).toBe('https://www.trivena.io')
		expect(detectHyperlink('trivena.io')).toBe('https://trivena.io')
		expect(detectHyperlink('trivena.io/sheets?x=1')).toBe('https://trivena.io/sheets?x=1')
		expect(detectHyperlink('sub.domain.google.com')).toBe('https://sub.domain.google.com')
	})

	it('keeps URLs with @ in the path when a scheme is present', () => {
		expect(detectHyperlink('https://medium.com/@user/post')).toBe('https://medium.com/@user/post')
	})

	it('rejects non-URL cell values', () => {
		expect(detectHyperlink('hello world')).toBe(null)          // spaces
		expect(detectHyperlink('see trivena.io today')).toBe(null)  // not whole-cell
		expect(detectHyperlink('=HYPERLINK("https://x.com")')).toBe(null)
		expect(detectHyperlink('3.14')).toBe(null)                 // numeric
		expect(detectHyperlink('file.txt')).toBe(null)             // uncommon TLD
		expect(detectHyperlink('v1.2.3')).toBe(null)
		expect(detectHyperlink('')).toBe(null)
		expect(detectHyperlink(42)).toBe(null)
		expect(detectHyperlink(null)).toBe(null)
	})

	it('rejects emails and schemeless userinfo tricks', () => {
		expect(detectHyperlink('user@gmail.com')).toBe(null)
		expect(detectHyperlink('evil.com@127.0.0.1')).toBe(null)
	})

	it('rejects non-http schemes', () => {
		expect(detectHyperlink('javascript:alert(1)')).toBe(null)
		expect(detectHyperlink('ftp://host/file')).toBe(null)
	})
})

describe('isAutoLinkText', () => {
	it('true when the text is exactly the URL the link points at', () => {
		expect(isAutoLinkText('https://trivena.io/', 'https://trivena.io/')).toBe(true)
		expect(isAutoLinkText('trivena.io', 'https://trivena.io')).toBe(true)
		expect(isAutoLinkText('www.trivena.io', 'https://www.trivena.io')).toBe(true)
	})

	it('false for custom display text or a different target', () => {
		expect(isAutoLinkText('Frappe website', 'https://trivena.io/')).toBe(false)
		expect(isAutoLinkText('trivena.io', 'https://other.com')).toBe(false)
		expect(isAutoLinkText('', 'https://trivena.io/')).toBe(false)
		expect(isAutoLinkText('https://trivena.io/', null)).toBe(false)
	})
})
