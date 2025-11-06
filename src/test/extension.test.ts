import * as assert from 'assert';

// This test file is purposely minimal and does not import the 'vscode' module
// so it can run in a plain Node environment (used by the unit-test runner).
suite('Extension Test Suite', () => {
	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});
