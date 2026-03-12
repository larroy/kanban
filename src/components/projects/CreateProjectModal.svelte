<script lang="ts">
	import Modal from '../shared/Modal.svelte';

	let {
		open = $bindable(false),
		oncreated
	}: {
		open: boolean;
		oncreated: (project: { id: number; name: string }) => void;
	} = $props();

	let name = $state('');
	let description = $state('');
	let saving = $state(false);

	async function submit() {
		if (!name.trim()) return;
		saving = true;
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), description: description || null })
			});
			if (res.ok) {
				const project = await res.json();
				oncreated(project);
				name = '';
				description = '';
				open = false;
			}
		} finally {
			saving = false;
		}
	}
</script>

<Modal bind:open title="New Project">
	<div class="space-y-3">
		<div>
			<label class="block text-sm font-medium text-gray-700">Name *</label>
			<input
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				placeholder="Project name"
				bind:value={name}
			/>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Description</label>
			<textarea
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				rows="3"
				placeholder="Optional description"
				bind:value={description}
			></textarea>
		</div>
		<div class="pt-1">
			<button
				onclick={submit}
				disabled={saving || !name.trim()}
				class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{saving ? 'Creating…' : 'Create Project'}
			</button>
		</div>
	</div>
</Modal>
