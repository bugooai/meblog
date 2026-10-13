import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

async function assertOk(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert.equal(response.status, 200, `${pathname} should return 200`);
}

test('homepage is available', async () => {
  await assertOk('/');
});

test('tags list page is available', async () => {
  await assertOk('/tags');
});

test('known tag page is available', async () => {
  await assertOk('/tag/backend');
});

test('known post page is available', async () => {
  await assertOk('/post/ai-blog-from-zero-to-one');
});

test('known project page is available', async () => {
  await assertOk('/project/ai-engineering');
});
