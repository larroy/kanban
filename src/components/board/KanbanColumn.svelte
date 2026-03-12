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

	function onEnd(evt: import('sortablejs').SortableEvent) {
		const id = parseInt(evt.item.dataset.id ?? '');
		const toStatus = evt.to.dataset.status as string;
		const newIndex = evt.newIndex ?? 0;

		// Revert SortableJS's DOM change — let Svelte's reactivity own the DOM
		if (evt.from !== evt.to) {
			// Cross-column: remove entirely so Svelte recreates in the right column
			evt.item.remove();
		} else {
			// Same-column: revert to original position
			evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex ?? 0] ?? null);
		}

		if (!isNaN(id)) {
			board.moveTask(id, toStatus, newIndex);
		}
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

<div class="flex w-80 shrink-0 flex-col rounded-xl bg-gray-50 p-3" data-testid="column-{status}">
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
		{#each tasks as task (task.id)}
			<TaskCard {task} onclick={(t) => (selectedTask = t)} />
		{/each}
	</div>
</div>

<TaskModal bind:task={selectedTask} {users} />

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
