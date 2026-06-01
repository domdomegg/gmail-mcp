import {
	describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import {
	htmlToText, selectSignature, applySignature, getSignature,
} from './signature.js';

describe('htmlToText', () => {
	it('converts breaks and block tags to newlines and strips markup', () => {
		expect(htmlToText('<div>Pontus Bergkvist<br>CTO</div>')).toBe('Pontus Bergkvist\nCTO');
	});

	it('decodes common HTML entities', () => {
		expect(htmlToText('Ponty &amp; Co &lt;3 &quot;hej&quot;')).toBe('Ponty & Co <3 "hej"');
	});
});

describe('selectSignature', () => {
	const sendAs = [
		{
			sendAsEmail: 'primary@ponty.se', isPrimary: true, isDefault: true, signature: '<div>Primary</div>',
		},
		{sendAsEmail: 'alias@ponty.se', signature: '<div>Alias</div>'},
	];

	it('matches the requested from-address', () => {
		expect(selectSignature(sendAs, 'Pontus <alias@ponty.se>').html).toBe('<div>Alias</div>');
	});

	it('falls back to the default/primary send-as', () => {
		expect(selectSignature(sendAs).html).toBe('<div>Primary</div>');
		expect(selectSignature(sendAs, 'unknown@ponty.se').html).toBe('<div>Primary</div>');
	});

	it('returns empty when there is no signature', () => {
		expect(selectSignature([])).toEqual({html: '', text: ''});
		expect(selectSignature([{sendAsEmail: 'x@ponty.se', isPrimary: true, signature: '   '}])).toEqual({html: '', text: ''});
	});
});

describe('applySignature', () => {
	const sig = {html: '<div>Sig</div>', text: 'Sig'};

	it('appends to both plain text and HTML bodies', () => {
		const result = applySignature({body: 'Hello', htmlBody: '<p>Hello</p>'}, sig);
		expect(result.body).toBe('Hello\n\nSig');
		expect(result.htmlBody).toBe('<p>Hello</p><br><br><div>Sig</div>');
	});

	it('only touches the bodies that are present', () => {
		expect(applySignature({body: 'Hello'}, sig)).toEqual({body: 'Hello\n\nSig'});
		expect(applySignature({htmlBody: '<p>Hi</p>'}, sig)).toEqual({htmlBody: '<p>Hi</p><br><br><div>Sig</div>'});
	});

	it('is a no-op for an empty signature', () => {
		const parts = {body: 'Hello', htmlBody: '<p>Hello</p>'};
		expect(applySignature(parts, {html: '', text: ''})).toEqual(parts);
	});
});

describe('getSignature', () => {
	const mockFetch = vi.fn();
	const originalFetch = global.fetch;

	beforeEach(() => {
		global.fetch = mockFetch;
		mockFetch.mockReset();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('returns the selected signature from the sendAs settings', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => JSON.stringify({sendAs: [{sendAsEmail: 'me@ponty.se', isPrimary: true, signature: '<div>Me</div>'}]}),
		});

		const sig = await getSignature('token');
		expect(sig).toEqual({html: '<div>Me</div>', text: 'Me'});
	});

	it('degrades to an empty signature when the lookup fails', async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 403,
			statusText: 'Forbidden',
			text: async () => 'no access',
		});

		expect(await getSignature('token')).toEqual({html: '', text: ''});
	});
});
