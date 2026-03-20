<script lang="ts">
	import type { TaskWithAssignee, User } from '$lib/types.js';
	import { board } from '$lib/board.svelte.js';
	import { sortable } from '$lib/sortable.js';
	import TaskCard from './TaskCard.svelte';
	import TaskModal from './TaskModal.svelte';
	import Modal from '../shared/Modal.svelte';
	import type { Project } from '$lib/types.js';

	let {
		status,
		label,
		color,
		tasks,
		users,
		projects
	}: {
		status: 'todo' | 'doing' | 'done';
		label: string;
		color: string;
		tasks: TaskWithAssignee[];
		users: User[];
		projects: Project[];
	} = $props();

	let selectedTask = $state<TaskWithAssignee | null>(null);
	let addOpen = $state(false);
	let newTitle = $state('');
	let newDesc = $state('');
	let newProjectId = $state<number | null>(null);
	let newAssigneeId = $state<number | null>(null);
	let adding = $state(false);

	// Group tasks by project, sorted by most recent task activity descending
	let groupedTasks = $derived.by(() => {
		const groups = new Map<number, TaskWithAssignee[]>();
		for (const task of tasks) {
			if (!groups.has(task.projectId)) {
				groups.set(task.projectId, []);
			}
			groups.get(task.projectId)!.push(task);
		}

		const result: { projectId: number; projectName: string; tasks: TaskWithAssignee[]; lastActivity: number }[] = [];
		for (const [projectId, groupTasks] of groups) {
			const project = projects.find(p => p.id === projectId);
			const maxUpdatedAt = Math.max(...groupTasks.map(t => new Date(t.updatedAt).getTime()));
			result.push({
				projectId,
				projectName: project?.name ?? 'Unknown',
				tasks: groupTasks,
				lastActivity: maxUpdatedAt
			});
		}

		result.sort((a, b) => b.lastActivity - a.lastActivity);
		return result;
	});

	/**
	 * Build the visual (grouped) order for a set of column tasks.
	 * Groups by project sorted by most-recent task activity, then by position within each group.
	 */
	function buildVisualOrder(columnTasks: TaskWithAssignee[]): TaskWithAssignee[] {
		const groups = new Map<number, TaskWithAssignee[]>();
		for (const t of columnTasks) {
			if (!groups.has(t.projectId)) groups.set(t.projectId, []);
			groups.get(t.projectId)!.push(t);
		}
		const sorted = [...groups.entries()]
			.map(([, gTasks]) => ({
				tasks: gTasks,
				lastActivity: Math.max(...gTasks.map(t => new Date(t.updatedAt).getTime()))
			}))
			.sort((a, b) => b.lastActivity - a.lastActivity);
		return sorted.flatMap(g => g.tasks);
	}

	function onEnd(evt: import('sortablejs').SortableEvent) {
		const id = parseInt(evt.item.dataset.id ?? '');
		const toStatus = evt.to.dataset.status as string;
		const visualIndex = evt.newDraggableIndex ?? evt.newIndex ?? 0;

		// Remove the dragged element and let Svelte recreate it from state.
		// The previous approach of reverting via insertBefore(children[oldIndex])
		// breaks for upward same-column moves: project headers shift children
		// indices so the revert puts the card outside its {#each} block boundary,
		// corrupting Svelte's reconciliation.
		evt.item.remove();

		if (isNaN(id)) return;

		// Build the target column's visual order (excluding the moved task)
		// so we can translate the visual index to the correct flat position.
		const targetTasks = board.tasks
			.filter(t => t.status === toStatus && t.id !== id)
			.sort((a, b) => a.position - b.position);
		const visualOrder = buildVisualOrder(targetTasks);

		let newPosition: number;
		if (visualOrder.length === 0 || visualIndex >= visualOrder.length) {
			newPosition = visualOrder.length > 0
				? Math.max(...visualOrder.map(t => t.position)) + 1
				: 0;
		} else {
			newPosition = visualOrder[visualIndex].position;
		}

		board.moveTask(id, toStatus, newPosition);
	}

	async function addTask() {
		if (!newTitle.trim() || !newProjectId) return;
		adding = true;
		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: newTitle.trim(),
					description: newDesc || null,
					projectId: newProjectId,
					status,
					assigneeId: newAssigneeId
				})
			});
			if (res.ok) {
				const task = await res.json();
				const assignee = users.find(u => u.id === newAssigneeId) ?? null;
				board.addTask({
					...task,
					assignee: assignee ? { id: assignee.id, name: assignee.name, color: assignee.color } : null
				});
				newTitle = '';
				newDesc = '';
				newAssigneeId = null;
				addOpen = false;
			}
		} finally {
			adding = false;
		}
	}
</script>

<div class="flex flex-1 min-w-64 flex-col rounded-xl bg-gray-50 p-3" data-testid="column-{status}">
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<span class="h-2.5 w-2.5 rounded-full {color}"></span>
			<h2 class="font-semibold text-gray-800">{label}</h2>
			<span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600" data-testid="column-count-{status}">
				{tasks.length}
			</span>
		</div>
		<button
			onclick={() => (addOpen = true)}
			class="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
			title="Add task"
			data-testid="add-task-btn-{status}"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>

	<div
		class="flex min-h-24 flex-col gap-2"
		data-status={status}
		data-testid="task-list-{status}"
		use:sortable={{ group: 'kanban', onEnd }}
	>
		{#each groupedTasks as group}
			<div class="flex items-center gap-1.5 pt-1 first:pt-0" data-project-header>
				<span class="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{group.projectName}</span>
				<span class="h-px flex-1 bg-gray-200"></span>
			</div>
			{#each group.tasks as task (task.id)}
				<TaskCard {task} onclick={(t) => (selectedTask = t)} />
			{/each}
		{/each}
	</div>
</div>

<TaskModal bind:task={selectedTask} {users} {projects} />

<Modal bind:open={addOpen} title="Add Task to {label}">
	<div class="space-y-3">
		<div>
			<label class="block text-sm font-medium text-gray-700">Title *</label>
			<input
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				placeholder="Task title"
				bind:value={newTitle}
			/>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Description</label>
			<textarea
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				rows="2"
				placeholder="Optional description"
				bind:value={newDesc}
			></textarea>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Project *</label>
			<select
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				bind:value={newProjectId}
			>
				<option value={null}>Select project…</option>
				{#each projects as p}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Assignee</label>
			<select
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				bind:value={newAssigneeId}
			>
				<option value={null}>Unassigned</option>
				{#each users as u}
					<option value={u.id}>{u.name}</option>
				{/each}
			</select>
		</div>
		<div class="flex gap-2 pt-1">
			<button
				onclick={addTask}
				disabled={adding || !newTitle.trim() || !newProjectId}
				class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{adding ? 'Adding…' : 'Add Task'}
			</button>
		</div>
	</div>
</Modal>
