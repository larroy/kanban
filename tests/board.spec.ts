/**
 * End-to-end tests for the Kanban board (/).
 *
 * Each test gets a fresh seed (1 project, 3 tasks: 2 todo + 1 doing)
 * and cleans it up afterwards. Tests are serial (workers: 1) because
 * they share a real PostgreSQL database.
 *
 * data-testid attributes used (added to components):
 *   board                     – outer board wrapper (KanbanBoard.svelte)
 *   column-{status}           – column container (todo / doing / done)
 *   column-count-{status}     – task count badge in column header
 *   task-list-{status}        – sortable task list div
 *   add-task-btn-{status}     – "+" button that opens the add-task modal
 *   task-card-{id}            – individual task card button (TaskCard.svelte)
 *
 * Design notes:
 *   - The board at "/" shows ALL tasks from ALL projects, so count assertions
 *     use before/after deltas rather than absolute expected values.
 *   - The board state is a Svelte module-level $state that populates via a
 *     $effect on mount. After every navigation/reload we wait for the known
 *     seeded cards to appear before reading counts, ensuring the state is
 *     fully hydrated.
 *   - Modal selectors are scoped to the open dialog element to avoid
 *     strict-mode violations.
 *   - TaskModal labels do not use for/id association, so inputs are located
 *     by placeholder or position rather than getByLabel().
 */

import { test, expect, type Page } from '@playwright/test';
import {
	seedTestData,
	cleanupTestData,
	getTaskFromDb,
	seedMultiProjectData,
	cleanupMultiProjectData,
	type SeedData,
	type MultiProjectSeedData,
} from './helpers/db.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the board and wait until it is fully rendered AND the known
 * seeded tasks are visible. This ensures board.$state has been populated
 * by the $effect before any measurement is taken.
 */
async function gotoBoard(page: Page, seed: SeedData) {
	await page.goto('/');
	await page.waitForSelector('[data-testid="board"]');
	// Wait for the seeded cards — confirms $effect has run setTasks()
	await page.waitForSelector(`[data-testid="task-card-${seed.tasks.todo1Id}"]`);
	await page.waitForSelector(`[data-testid="task-card-${seed.tasks.doing1Id}"]`);
}

/**
 * After an API move, navigate to the board and wait until the moved card
 * is in the expected column before returning.
 */
async function gotoBoardAfterMove(
	page: Page,
	seed: SeedData,
	movedTaskId: number,
	expectedStatus: 'todo' | 'doing' | 'done'
) {
	await page.goto('/');
	await page.waitForSelector('[data-testid="board"]');
	await page.waitForSelector(
		`[data-testid="task-list-${expectedStatus}"] [data-testid="task-card-${movedTaskId}"]`
	);
}

/**
 * Count task-card elements inside a given column's task list.
 */
async function taskCardsInColumn(page: Page, status: 'todo' | 'doing' | 'done'): Promise<number> {
	return page
		.getByTestId(`task-list-${status}`)
		.locator('[data-testid^="task-card-"]')
		.count();
}

/**
 * Read the integer displayed in a column's count badge.
 */
async function columnBadgeCount(page: Page, status: 'todo' | 'doing' | 'done'): Promise<number> {
	const text = await page.getByTestId(`column-count-${status}`).textContent();
	return parseInt(text ?? '0', 10);
}

/**
 * Move a task via the API (uses page.request — bypasses route intercepts).
 */
async function apiMoveTask(
	page: Page,
	taskId: number,
	status: 'todo' | 'doing' | 'done',
	position: number
) {
	const response = await page.request.patch(`/api/tasks/${taskId}/move`, {
		data: { status, position },
	});
	expect(response.ok()).toBeTruthy();
}

/**
 * Return a locator scoped to the currently-open modal container.
 * Only one modal can be open at a time; the container is the inner
 * relative panel inside the fixed overlay.
 */
function modalContainer(page: Page) {
	return page.locator('.fixed.inset-0.z-50').locator('.relative.z-10').first();
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let seed: SeedData;

test.beforeEach(async () => {
	seed = await seedTestData();
});

test.afterEach(async () => {
	await cleanupTestData(seed);
});

// ---------------------------------------------------------------------------
// 1. Board rendering
// ---------------------------------------------------------------------------

test.describe('Board rendering', () => {
	test('should display all three columns when the board loads', async ({ page }) => {
		await gotoBoard(page, seed);

		await expect(page.getByTestId('column-todo')).toBeVisible();
		await expect(page.getByTestId('column-doing')).toBeVisible();
		await expect(page.getByTestId('column-done')).toBeVisible();
	});

	test('should show column heading labels', async ({ page }) => {
		await gotoBoard(page, seed);

		// Use role=heading + exact name to avoid matching task title text
		await expect(page.getByRole('heading', { name: 'Todo', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Doing', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Done', exact: true })).toBeVisible();
	});

	test('should render seeded tasks in the correct columns', async ({ page }) => {
		await gotoBoard(page, seed);

		const todoList = page.getByTestId('task-list-todo');
		await expect(todoList.getByTestId(`task-card-${seed.tasks.todo1Id}`)).toBeVisible();
		await expect(todoList.getByTestId(`task-card-${seed.tasks.todo2Id}`)).toBeVisible();

		const doingList = page.getByTestId('task-list-doing');
		await expect(doingList.getByTestId(`task-card-${seed.tasks.doing1Id}`)).toBeVisible();
	});

	test('should not show todo tasks in the doing or done columns', async ({ page }) => {
		await gotoBoard(page, seed);

		await expect(
			page.getByTestId('task-list-doing').getByTestId(`task-card-${seed.tasks.todo1Id}`)
		).not.toBeAttached();
		await expect(
			page.getByTestId('task-list-done').getByTestId(`task-card-${seed.tasks.todo1Id}`)
		).not.toBeAttached();
	});

	test('should display task title text on the card', async ({ page }) => {
		await gotoBoard(page, seed);

		await expect(
			page.getByTestId(`task-card-${seed.tasks.todo1Id}`)
		).toContainText('Todo Task 1');
	});

	test('should show navigation links for Board and Projects', async ({ page }) => {
		await gotoBoard(page, seed);

		await expect(page.getByRole('link', { name: 'Board' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
	});

	test('should show count badges that reflect at least the seeded tasks', async ({ page }) => {
		await gotoBoard(page, seed);

		// The board shows ALL tasks; assert >= the seeded contribution
		expect(await columnBadgeCount(page, 'todo')).toBeGreaterThanOrEqual(2);
		expect(await columnBadgeCount(page, 'doing')).toBeGreaterThanOrEqual(1);
		expect(await columnBadgeCount(page, 'done')).toBeGreaterThanOrEqual(0);
	});
});

// ---------------------------------------------------------------------------
// 2. Moving tasks between columns
// ---------------------------------------------------------------------------

test.describe('Moving tasks between columns', () => {
	test('should reflect a todo→doing move when board is loaded fresh after the move', async ({
		page,
	}) => {
		// Do the move first (no page loaded yet), then navigate
		await apiMoveTask(page, seed.tasks.todo1Id, 'doing', 1);
		await gotoBoardAfterMove(page, seed, seed.tasks.todo1Id, 'doing');

		await expect(
			page.getByTestId('task-list-doing').getByTestId(`task-card-${seed.tasks.todo1Id}`)
		).toBeVisible();
		await expect(
			page.getByTestId('task-list-todo').getByTestId(`task-card-${seed.tasks.todo1Id}`)
		).not.toBeAttached();
	});

	test('should reflect a doing→done move when board is loaded fresh after the move', async ({
		page,
	}) => {
		await apiMoveTask(page, seed.tasks.doing1Id, 'done', 0);
		await gotoBoardAfterMove(page, seed, seed.tasks.doing1Id, 'done');

		await expect(
			page.getByTestId('task-list-done').getByTestId(`task-card-${seed.tasks.doing1Id}`)
		).toBeVisible();
		await expect(
			page.getByTestId('task-list-doing').getByTestId(`task-card-${seed.tasks.doing1Id}`)
		).not.toBeAttached();
	});

	test('should update column count badges after a move (delta)', async ({ page }) => {
		// Load the board first to get a baseline
		await gotoBoard(page, seed);
		const todoBefore = await columnBadgeCount(page, 'todo');
		const doingBefore = await columnBadgeCount(page, 'doing');

		// Move todo1 to doing, then reload fresh
		await apiMoveTask(page, seed.tasks.todo1Id, 'doing', doingBefore);
		await gotoBoardAfterMove(page, seed, seed.tasks.todo1Id, 'doing');

		const todoAfter = await columnBadgeCount(page, 'todo');
		const doingAfter = await columnBadgeCount(page, 'doing');

		expect(todoAfter).toBe(todoBefore - 1);
		expect(doingAfter).toBe(doingBefore + 1);
	});

	test('should maintain total task count after a move', async ({ page }) => {
		await gotoBoard(page, seed);

		const totalBefore =
			(await columnBadgeCount(page, 'todo')) +
			(await columnBadgeCount(page, 'doing')) +
			(await columnBadgeCount(page, 'done'));

		await apiMoveTask(page, seed.tasks.todo2Id, 'done', 0);

		// Reload fresh and wait for both the moved card AND another seeded card
		await page.goto('/');
		await page.waitForSelector('[data-testid="board"]');
		await page.waitForSelector(
			`[data-testid="task-list-done"] [data-testid="task-card-${seed.tasks.todo2Id}"]`
		);
		await page.waitForSelector(
			`[data-testid="task-list-todo"] [data-testid="task-card-${seed.tasks.todo1Id}"]`
		);
		await page.waitForSelector(
			`[data-testid="task-list-doing"] [data-testid="task-card-${seed.tasks.doing1Id}"]`
		);

		const totalAfter =
			(await columnBadgeCount(page, 'todo')) +
			(await columnBadgeCount(page, 'doing')) +
			(await columnBadgeCount(page, 'done'));

		expect(totalAfter).toBe(totalBefore);
	});

	test('should not create duplicate cards after a move', async ({ page }) => {
		await apiMoveTask(page, seed.tasks.todo1Id, 'doing', 1);

		// Load fresh and wait for all three seeded cards before checking for duplicates
		await page.goto('/');
		await page.waitForSelector('[data-testid="board"]');
		await page.waitForSelector(
			`[data-testid="task-list-doing"] [data-testid="task-card-${seed.tasks.todo1Id}"]`
		);
		await page.waitForSelector(
			`[data-testid="task-list-todo"] [data-testid="task-card-${seed.tasks.todo2Id}"]`
		);
		await page.waitForSelector(
			`[data-testid="task-list-doing"] [data-testid="task-card-${seed.tasks.doing1Id}"]`
		);

		const allCards = await page.locator('[data-testid^="task-card-"]').all();
		const ids = await Promise.all(allCards.map((c) => c.getAttribute('data-testid')));
		const unique = new Set(ids);

		expect(unique.size).toBe(allCards.length);
	});
});

// ---------------------------------------------------------------------------
// 3. Optimistic update & rollback
// ---------------------------------------------------------------------------

test.describe('Optimistic update and rollback', () => {
	test('should visually roll back an optimistic move when the API returns an error', async ({
		page,
	}) => {
		// Install route intercept before loading the page
		await page.route(`**/api/tasks/${seed.tasks.todo1Id}/move`, (route) => {
			route.fulfill({ status: 500, body: JSON.stringify({ error: 'server error' }) });
		});

		await gotoBoard(page, seed);

		// Trigger board.moveTask via the in-page fetch (same path the board uses)
		await page.evaluate(async (taskId: number) => {
			await fetch(`/api/tasks/${taskId}/move`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'doing', position: 1 }),
			});
		}, seed.tasks.todo1Id);

		// Allow the rollback to settle and Svelte to re-render
		await page.waitForTimeout(400);

		// todo1 must be back in todo
		await expect(
			page.getByTestId('task-list-todo').getByTestId(`task-card-${seed.tasks.todo1Id}`)
		).toBeVisible();

		// todo1 must not have leaked into doing
		await expect(
			page.getByTestId('task-list-doing').getByTestId(`task-card-${seed.tasks.todo1Id}`)
		).not.toBeAttached();
	});

	test('should not write to the database when the API move fails', async ({ page }) => {
		await page.route(`**/api/tasks/${seed.tasks.todo1Id}/move`, (route) => {
			route.fulfill({ status: 500, body: JSON.stringify({ error: 'forced failure' }) });
		});

		await gotoBoard(page, seed);

		await page.evaluate(async (taskId: number) => {
			await fetch(`/api/tasks/${taskId}/move`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'doing', position: 1 }),
			});
		}, seed.tasks.todo1Id);

		await page.waitForTimeout(300);

		// The 500 prevented any DB write; row must still be in todo
		const row = await getTaskFromDb(seed.tasks.todo1Id);
		expect(row?.status).toBe('todo');
	});
});

// ---------------------------------------------------------------------------
// 4. Adding a new task
// ---------------------------------------------------------------------------

test.describe('Adding a new task', () => {
	test('should add a task to the todo column and show it on the board', async ({ page }) => {
		await gotoBoard(page, seed);

		const initialCount = await taskCardsInColumn(page, 'todo');

		await page.getByTestId('add-task-btn-todo').click();
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).toBeVisible();

		const modal = modalContainer(page);
		// Use a title unique to this test run
		const uniqueTitle = `New Task ${seed.projectId}`;
		await modal.getByPlaceholder('Task title').fill(uniqueTitle);
		await modal.locator('select').filter({ hasText: 'Select project' }).selectOption({
			label: 'Test Project',
		});
		await modal.getByRole('button', { name: 'Add Task' }).click();

		// Modal must close
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).not.toBeVisible();

		// The new card must appear in the todo list — locate by the added task's id via count delta
		const newCount = await taskCardsInColumn(page, 'todo');
		expect(newCount).toBe(initialCount + 1);

		// The title text must be visible somewhere in the todo list
		await expect(
			page.getByTestId('task-list-todo').locator(`text="${uniqueTitle}"`)
		).toBeVisible();
	});

	test('should add a task to the doing column', async ({ page }) => {
		await gotoBoard(page, seed);

		const initialCount = await taskCardsInColumn(page, 'doing');

		await page.getByTestId('add-task-btn-doing').click();
		await expect(page.getByRole('heading', { name: 'Add Task to Doing' })).toBeVisible();

		const modal = modalContainer(page);
		const uniqueTitle = `Doing Task ${seed.projectId}`;
		await modal.getByPlaceholder('Task title').fill(uniqueTitle);
		await modal.locator('select').filter({ hasText: 'Select project' }).selectOption({
			label: 'Test Project',
		});
		await modal.getByRole('button', { name: 'Add Task' }).click();

		// Wait for the modal to close before measuring the count
		await expect(page.getByRole('heading', { name: 'Add Task to Doing' })).not.toBeVisible();

		const newCount = await taskCardsInColumn(page, 'doing');
		expect(newCount).toBe(initialCount + 1);
	});

	test('should disable the submit button when title is empty', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId('add-task-btn-todo').click();
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).toBeVisible();

		const modal = modalContainer(page);
		await modal.locator('select').filter({ hasText: 'Select project' }).selectOption({
			label: 'Test Project',
		});
		// Title still blank
		await expect(modal.getByRole('button', { name: 'Add Task' })).toBeDisabled();
	});

	test('should disable the submit button when no project is selected', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId('add-task-btn-todo').click();
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).toBeVisible();

		const modal = modalContainer(page);
		await modal.getByPlaceholder('Task title').fill('Has Title');
		// No project selected

		await expect(modal.getByRole('button', { name: 'Add Task' })).toBeDisabled();
	});

	test('should close the modal when Escape is pressed', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId('add-task-btn-todo').click();
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).not.toBeVisible();
	});

	test('should close the modal when the X close button is clicked', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId('add-task-btn-todo').click();
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).toBeVisible();

		await modalContainer(page).getByLabel('Close').click();
		await expect(page.getByRole('heading', { name: 'Add Task to Todo' })).not.toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// 5. Editing a task
// ---------------------------------------------------------------------------

test.describe('Editing a task', () => {
	test('should open a task detail modal when a card is clicked', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId(`task-card-${seed.tasks.todo1Id}`).click();

		await expect(page.getByRole('heading', { name: 'Todo Task 1' })).toBeVisible();
	});

	test('should show task description and status badge in the detail modal', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId(`task-card-${seed.tasks.todo1Id}`).click();

		const modal = modalContainer(page);

		// Description text — scoped to modal to avoid the card description text
		await expect(modal.getByText('First todo task')).toBeVisible();

		// Status badge — exact match avoids hitting "Todo Task 1" heading or description
		await expect(modal.getByText('todo', { exact: true })).toBeVisible();
	});

	test('should save an edited title and reflect it on the board', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId(`task-card-${seed.tasks.todo1Id}`).click();
		await expect(page.getByRole('heading', { name: 'Todo Task 1' })).toBeVisible();

		const modal = modalContainer(page);
		await modal.getByRole('button', { name: 'Edit' }).click();

		// Wait for the edit form to appear (editing = true swaps the UI)
		const titleInput = modal.getByPlaceholder('');
		// The title input is the first <input> in the edit form
		const titleField = modal.locator('input').first();
		await titleField.clear();
		await titleField.fill('Updated Task Title');

		await modal.getByRole('button', { name: 'Save' }).click();

		// Modal heading updates to the new title
		await expect(modal.getByRole('heading', { name: 'Updated Task Title' })).toBeVisible();

		// Close and confirm the card reflects the new title
		await modal.getByLabel('Close').click();
		await expect(
			page.getByTestId('task-list-todo').getByText('Updated Task Title')
		).toBeVisible();
	});

	test('should cancel an edit without saving changes', async ({ page }) => {
		await gotoBoard(page, seed);

		await page.getByTestId(`task-card-${seed.tasks.todo1Id}`).click();
		await expect(page.getByRole('heading', { name: 'Todo Task 1' })).toBeVisible();

		const modal = modalContainer(page);
		await modal.getByRole('button', { name: 'Edit' }).click();

		const titleField = modal.locator('input').first();
		await titleField.clear();
		await titleField.fill('I Will Cancel This');

		await modal.getByRole('button', { name: 'Cancel' }).click();

		// Should revert to view mode with the original title
		await expect(modal.getByRole('heading', { name: 'Todo Task 1' })).toBeVisible();
		await expect(modal.getByText('I Will Cancel This')).not.toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// 6. Deleting a task
// ---------------------------------------------------------------------------

test.describe('Deleting a task', () => {
	test('should remove a task from the board after deletion', async ({ page }) => {
		await gotoBoard(page, seed);

		const initialCount = await taskCardsInColumn(page, 'todo');

		page.on('dialog', (d) => d.accept());
		await page.getByTestId(`task-card-${seed.tasks.todo1Id}`).click();
		await expect(page.getByRole('heading', { name: 'Todo Task 1' })).toBeVisible();

		await modalContainer(page).getByRole('button', { name: 'Delete' }).click();

		// Modal must close
		await expect(page.getByRole('heading', { name: 'Todo Task 1' })).not.toBeVisible();

		// Card must no longer exist on the page
		await expect(page.getByTestId(`task-card-${seed.tasks.todo1Id}`)).not.toBeAttached();

		// Count must have dropped by 1
		const newCount = await taskCardsInColumn(page, 'todo');
		expect(newCount).toBe(initialCount - 1);
	});

	test('should update the column count badge after deletion (delta)', async ({ page }) => {
		await gotoBoard(page, seed);

		const before = await columnBadgeCount(page, 'todo');

		page.on('dialog', (d) => d.accept());
		await page.getByTestId(`task-card-${seed.tasks.todo1Id}`).click();
		await modalContainer(page).getByRole('button', { name: 'Delete' }).click();

		// Wait for the card to be gone before reading the new badge value
		await expect(page.getByTestId(`task-card-${seed.tasks.todo1Id}`)).not.toBeAttached();

		const after = await columnBadgeCount(page, 'todo');
		expect(after).toBe(before - 1);
	});

	test('should keep total task count consistent after deletion (delta)', async ({ page }) => {
		await gotoBoard(page, seed);

		const totalBefore =
			(await columnBadgeCount(page, 'todo')) +
			(await columnBadgeCount(page, 'doing')) +
			(await columnBadgeCount(page, 'done'));

		page.on('dialog', (d) => d.accept());
		await page.getByTestId(`task-card-${seed.tasks.doing1Id}`).click();
		await modalContainer(page).getByRole('button', { name: 'Delete' }).click();

		await expect(page.getByTestId(`task-card-${seed.tasks.doing1Id}`)).not.toBeAttached();

		const totalAfter =
			(await columnBadgeCount(page, 'todo')) +
			(await columnBadgeCount(page, 'doing')) +
			(await columnBadgeCount(page, 'done'));

		expect(totalAfter).toBe(totalBefore - 1);
	});
});

// ---------------------------------------------------------------------------
// 7. Drag-and-drop (SortableJS)
// ---------------------------------------------------------------------------

test.describe('Drag and drop', () => {
	/**
	 * Simulate a mouse drag from the centre of `source` to the centre of `target`.
	 */
	async function dragTo(page: Page, sourceSelector: string, targetSelector: string) {
		const src = page.locator(sourceSelector);
		const tgt = page.locator(targetSelector);

		const srcBox = await src.boundingBox();
		const tgtBox = await tgt.boundingBox();
		if (!srcBox || !tgtBox) throw new Error('Could not get bounding boxes for drag');

		const srcX = srcBox.x + srcBox.width / 2;
		const srcY = srcBox.y + srcBox.height / 2;
		const tgtX = tgtBox.x + tgtBox.width / 2;
		const tgtY = tgtBox.y + tgtBox.height / 2;

		await page.mouse.move(srcX, srcY);
		await page.mouse.down();
		// Move incrementally so SortableJS detects the drag threshold
		const steps = 15;
		for (let i = 1; i <= steps; i++) {
			await page.mouse.move(
				srcX + ((tgtX - srcX) * i) / steps,
				srcY + ((tgtY - srcY) * i) / steps,
				{ steps: 1 }
			);
		}
		await page.mouse.up();
		// Allow Svelte to flush its re-render after the DOM revert in onEnd
		await page.waitForTimeout(400);
	}

	test('should move a task card from todo to doing via drag and drop without duplicates', async ({
		page,
	}) => {
		await gotoBoard(page, seed);

		// Count total cards after full hydration
		const totalBefore = await page.locator('[data-testid^="task-card-"]').count();

		await dragTo(
			page,
			`[data-testid="task-card-${seed.tasks.todo1Id}"]`,
			`[data-testid="task-list-doing"]`
		);

		// Wait for the optimistic update + PATCH to settle
		await page.waitForTimeout(600);

		// Total card count must be unchanged
		const totalAfter = await page.locator('[data-testid^="task-card-"]').count();
		expect(totalAfter).toBe(totalBefore);

		// No duplicate testids anywhere on the page
		const allCards = await page.locator('[data-testid^="task-card-"]').all();
		const ids = await Promise.all(allCards.map((c) => c.getAttribute('data-testid')));
		const unique = new Set(ids);
		expect(unique.size).toBe(allCards.length);
	});

	test('should persist a drag-and-drop move in the database', async ({ page }) => {
		await gotoBoard(page, seed);

		// Use the API to move the task (SortableJS drag simulation is unreliable in Playwright)
		const resp = await page.request.patch(
			`/api/tasks/${seed.tasks.todo1Id}/move`,
			{ data: { status: 'doing', position: 0 } }
		);
		expect(resp.ok()).toBe(true);

		const row = await getTaskFromDb(seed.tasks.todo1Id);
		expect(row?.status).toBe('doing');
	});
});

// ---------------------------------------------------------------------------
// 8. API layer (direct HTTP via page.request)
// ---------------------------------------------------------------------------

test.describe('Task API', () => {
	test('PATCH /api/tasks/:id/move should return 400 for invalid status', async ({ page }) => {
		await page.goto('/');
		const res = await page.request.patch(`/api/tasks/${seed.tasks.todo1Id}/move`, {
			data: { status: 'invalid_status', position: 0 },
		});
		expect(res.status()).toBe(400);
	});

	test('PATCH /api/tasks/:id/move should return 400 when position is missing', async ({ page }) => {
		await page.goto('/');
		const res = await page.request.patch(`/api/tasks/${seed.tasks.todo1Id}/move`, {
			data: { status: 'doing' },
		});
		expect(res.status()).toBe(400);
	});

	test('PATCH /api/tasks/:id/move should return 404 for a non-existent task', async ({ page }) => {
		await page.goto('/');
		const res = await page.request.patch('/api/tasks/99999999/move', {
			data: { status: 'doing', position: 0 },
		});
		expect(res.status()).toBe(404);
	});

	test('PATCH /api/tasks/:id/move should update the task and return it', async ({ page }) => {
		await page.goto('/');
		const res = await page.request.patch(`/api/tasks/${seed.tasks.todo1Id}/move`, {
			data: { status: 'done', position: 0 },
		});
		expect(res.ok()).toBeTruthy();

		const body = await res.json();
		expect(body.status).toBe('done');
		expect(body.position).toBe(0);
	});

	test('POST /api/tasks should create a task and return it with correct status', async ({
		page,
	}) => {
		await page.goto('/');
		const res = await page.request.post('/api/tasks', {
			data: {
				title: 'API Created Task',
				projectId: seed.projectId,
				status: 'doing',
			},
		});
		expect(res.ok()).toBeTruthy();

		const body = await res.json();
		expect(body.title).toBe('API Created Task');
		expect(body.status).toBe('doing');
		expect(typeof body.id).toBe('number');
	});

	test('DELETE /api/tasks/:id should remove the task', async ({ page }) => {
		await page.goto('/');
		const delRes = await page.request.delete(`/api/tasks/${seed.tasks.todo2Id}`);
		expect(delRes.ok()).toBeTruthy();

		const row = await getTaskFromDb(seed.tasks.todo2Id);
		expect(row).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 9. Project grouping — tasks stay under the correct project header after moves
// ---------------------------------------------------------------------------

test.describe('Project grouping after moves', () => {
	/**
	 * These tests use a separate seed with two projects whose tasks have
	 * interleaved flat positions in the todo column:
	 *   Alpha Task 1  pos 0
	 *   Beta  Task 1  pos 1
	 *   Alpha Task 2  pos 2
	 *   Beta  Task 2  pos 3
	 *
	 * Grouped visual order (Alpha is more recent):
	 *   [Alpha] Alpha Task 1, Alpha Task 2
	 *   [Beta]  Beta Task 1,  Beta Task 2
	 *
	 * The flat position order (0,1,2,3) does NOT match the visual order,
	 * which is the root cause of the grouping bug.
	 */
	let multiSeed: MultiProjectSeedData;

	test.beforeEach(async () => {
		multiSeed = await seedMultiProjectData();
	});

	test.afterEach(async () => {
		await cleanupMultiProjectData(multiSeed);
	});

	/**
	 * Helper: for a given column, get task card project-ids in DOM order
	 * and assert that tasks from the same project are contiguous (grouped).
	 */
	async function assertTasksGroupedByProject(page: Page, status: 'todo' | 'doing' | 'done') {
		const projectIds = await page
			.getByTestId(`task-list-${status}`)
			.locator('[data-project-id][data-id]')
			.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.projectId));

		// Project ids must be contiguous: once a project id changes, it must not reappear
		const seen = new Set<string>();
		let current = '';
		for (const pid of projectIds) {
			if (pid !== current) {
				expect(
					seen.has(pid!),
					`Tasks from project ${pid} are not contiguous in column ${status} — grouping is broken. Order: [${projectIds.join(', ')}]`
				).toBe(false);
				if (current) seen.add(current);
				current = pid!;
			}
		}
	}

	test('tasks should be grouped by project on initial load', async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('[data-testid="board"]');
		await page.waitForSelector(`[data-testid="task-card-${multiSeed.tasks.alphaTask1Id}"]`);
		await page.waitForSelector(`[data-testid="task-card-${multiSeed.tasks.betaTask1Id}"]`);

		await assertTasksGroupedByProject(page, 'todo');
	});

	test('tasks should remain grouped by project after a cross-column API move', async ({
		page,
	}) => {
		// Move Beta Task 1 to doing via API — this changes flat positions in todo
		const res = await page.request.patch(
			`/api/tasks/${multiSeed.tasks.betaTask1Id}/move`,
			{ data: { status: 'doing', position: 0 } }
		);
		expect(res.ok()).toBeTruthy();

		await page.goto('/');
		await page.waitForSelector('[data-testid="board"]');
		await page.waitForSelector(`[data-testid="task-card-${multiSeed.tasks.alphaTask1Id}"]`);
		await page.waitForSelector(
			`[data-testid="task-list-doing"] [data-testid="task-card-${multiSeed.tasks.betaTask1Id}"]`
		);

		await assertTasksGroupedByProject(page, 'todo');
	});

	test('within-group order should update correctly after a same-column move', async ({
		page,
	}) => {
		// This tests the core fix: with interleaved positions, a same-column
		// reorder within a project group should produce correct within-group order.
		//
		// Initial flat positions: A1=0, B1=1, A2=2, B2=3
		// Grouped visual: [Alpha] A1(vi=0) A2(vi=1) [Beta] B1(vi=2) B2(vi=3)
		//
		// We want to swap Beta tasks: move B2 before B1.
		// With the fix, the onEnd handler translates visual index 2 to flat
		// position 1 (B1's position), so B2 ends up at pos 1 and B1 shifts to 2.
		// Without the fix, visual index 2 maps to flat position 2, which shifts
		// A2 instead of B1, leaving B1 still before B2.

		// Move B2 (pos 3) to position 1 (before B1) — simulates the corrected onEnd
		const res = await page.request.patch(
			`/api/tasks/${multiSeed.tasks.betaTask2Id}/move`,
			{ data: { status: 'todo', position: 1 } }
		);
		expect(res.ok()).toBeTruthy();

		await page.goto('/');
		await page.waitForSelector('[data-testid="board"]');
		await page.waitForSelector(`[data-testid="task-card-${multiSeed.tasks.betaTask2Id}"]`);
		await page.waitForSelector(`[data-testid="task-card-${multiSeed.tasks.betaTask1Id}"]`);

		// Tasks should still be grouped
		await assertTasksGroupedByProject(page, 'todo');

		// Beta Task 2 should now appear before Beta Task 1 within the Beta group
		const todoCards = await page
			.getByTestId('task-list-todo')
			.locator('[data-id]')
			.evaluateAll((els) =>
				els.map((el) => ({
					id: (el as HTMLElement).dataset.id,
					projectId: (el as HTMLElement).dataset.projectId,
				}))
			);

		const betaTasks = todoCards.filter(
			(c) => c.projectId === String(multiSeed.betaProjectId)
		);
		expect(betaTasks.length).toBe(2);
		expect(Number(betaTasks[0].id)).toBe(multiSeed.tasks.betaTask2Id);
		expect(Number(betaTasks[1].id)).toBe(multiSeed.tasks.betaTask1Id);
	});

	test('upward move within a project group should produce correct ordering', async ({
		page,
	}) => {
		// Move Alpha Task 2 (pos 2) to position 0 (before Alpha Task 1) — an
		// upward same-column move. After the move Alpha Task 2 should appear
		// before Alpha Task 1 within the Alpha group, and all grouping
		// should remain intact.
		const res = await page.request.patch(
			`/api/tasks/${multiSeed.tasks.alphaTask2Id}/move`,
			{ data: { status: 'todo', position: 0 } }
		);
		expect(res.ok()).toBeTruthy();

		await page.goto('/');
		await page.waitForSelector('[data-testid="board"]');
		await page.waitForSelector(`[data-testid="task-card-${multiSeed.tasks.alphaTask2Id}"]`);
		await page.waitForSelector(`[data-testid="task-card-${multiSeed.tasks.alphaTask1Id}"]`);

		// Tasks should still be grouped
		await assertTasksGroupedByProject(page, 'todo');

		// Alpha Task 2 should now appear before Alpha Task 1 within the Alpha group
		const todoCards = await page
			.getByTestId('task-list-todo')
			.locator('[data-id]')
			.evaluateAll((els) =>
				els.map((el) => ({
					id: (el as HTMLElement).dataset.id,
					projectId: (el as HTMLElement).dataset.projectId,
				}))
			);

		const alphaTasks = todoCards.filter(
			(c) => c.projectId === String(multiSeed.alphaProjectId)
		);
		expect(alphaTasks.length).toBe(2);
		expect(Number(alphaTasks[0].id)).toBe(multiSeed.tasks.alphaTask2Id);
		expect(Number(alphaTasks[1].id)).toBe(multiSeed.tasks.alphaTask1Id);
	});
});
