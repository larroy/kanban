<script lang="ts">
	import Modal from '../shared/Modal.svelte';
	import type { TaskWithAssignee, User, Project } from '$lib/types.js';
	import { board } from '$lib/board.svelte.js';

	let {
		task = $bindable<TaskWithAssignee | null>(null),
		users,
		projects,
		onclose
	}: {
		task: TaskWithAssignee | null;
		users: User[];
		projects: Project[];
		onclose?: () => void;
	} = $props();

	let projectName = $derived(
		task ? (projects.find(p => p.id === task!.projectId)?.name ?? 'Unknown') : ''
	);

	let open = $derived(task !== null);
	let editing = $state(false);
	let editTitle = $state('');
	let editDesc = $state('');
	let editAssigneeId = $state<number | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (task) {
			editTitle = task.title;
			editDesc = task.description ?? '';
			editAssigneeId = task.assigneeId ?? null;
			editing = false;
		}
	});

	async function saveEdit() {
		if (!task) return;
		saving = true;
		try {
			const res = await fetch(`/api/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle,
					description: editDesc || null,
					assigneeId: editAssigneeId
				})
			});
			if (res.ok) {
				const updated = await res.json();
				const assignee = users.find(u => u.id === editAssigneeId) ?? null;
				board.updateTask({
					...updated,
					assignee: assignee ? { id: assignee.id, name: assignee.name, color: assignee.color } : null
				});
				task = { ...task, ...updated, assignee: assignee ? { id: assignee.id, name: assignee.name, color: assignee.color } : null };
				editing = false;
			}
		} finally {
			saving = false;
		}
	}

	async function deleteTask() {
		if (!task) return;
		if (!confirm('Delete this task?')) return;
		await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
		board.removeTask(task.id);
		task = null;
		onclose?.();
	}

	function handleOpenChange() {
		if (!open) {
			task = null;
			onclose?.();
		}
	}

	$effect(() => {
		if (!open) handleOpenChange();
	});
</script>

<Modal bind:open title={task?.title ?? ''}>
	{#if task}
		<div class="space-y-4">
			{#if editing}
				<div class="space-y-3">
					<div>
						<label class="block text-sm font-medium text-gray-700">Title</label>
						<input
							class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							bind:value={editTitle}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">Description</label>
						<textarea
							class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							rows="3"
							bind:value={editDesc}
						></textarea>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">Assignee</label>
						<select
							class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							bind:value={editAssigneeId}
						>
							<option value={null}>Unassigned</option>
							{#each users as u}
								<option value={u.id}>{u.name}</option>
							{/each}
						</select>
					</div>
					<div class="flex gap-2 pt-1">
						<button
							onclick={saveEdit}
							disabled={saving}
							class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
						<button
							onclick={() => (editing = false)}
							class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium
						{task.status === 'todo' ? 'bg-gray-100 text-gray-700' :
						 task.status === 'doing' ? 'bg-blue-100 text-blue-700' :
						 'bg-green-100 text-green-700'}">
						{task.status}
					</span>
					<span class="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
						{projectName}
					</span>
				</div>
				{#if task.description}
					<p class="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
				{:else}
					<p class="text-sm italic text-gray-400">No description</p>
				{/if}
				{#if task.assignee}
					<div class="flex items-center gap-2 text-sm text-gray-600">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
							style="background-color: {task.assignee.color}"
						>
							{task.assignee.name[0].toUpperCase()}
						</div>
						{task.assignee.name}
					</div>
				{/if}
				<div class="flex items-center justify-between pt-2">
					<button
						onclick={() => (editing = true)}
						class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Edit
					</button>
					<button
						onclick={deleteTask}
						class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
					>
						Delete
					</button>
				</div>
			{/if}
		</div>
	{/if}
</Modal>
