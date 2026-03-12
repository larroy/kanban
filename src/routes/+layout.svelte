<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';
	import Modal from '$components/shared/Modal.svelte';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let userModalOpen = $state(false);
	let newUserName = $state('');
	let newUserColor = $state('#6366f1');
	let users = $state(data.users);
	let saving = $state(false);

	$effect(() => {
		users = data.users;
	});

	async function createUser() {
		if (!newUserName.trim()) return;
		saving = true;
		try {
			const res = await fetch('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newUserName.trim(), color: newUserColor })
			});
			if (res.ok) {
				const user = await res.json();
				users = [...users, user];
				newUserName = '';
				newUserColor = '#6366f1';
				userModalOpen = false;
			}
		} finally {
			saving = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-100">
	<nav class="border-b border-gray-200 bg-white shadow-sm">
		<div class="flex items-center justify-between px-6 py-3">
			<div class="flex items-center gap-6">
				<span class="text-lg font-bold text-indigo-600">Kanban</span>
				<div class="flex gap-1">
					<a
						href="/"
						class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
					>
						Board
					</a>
					<a
						href="/projects"
						class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
					>
						Projects
					</a>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<div class="flex -space-x-1">
					{#each users.slice(0, 5) as u}
						<div
							class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white"
							style="background-color: {u.color}"
							title={u.name}
						>
							{u.name[0].toUpperCase()}
						</div>
					{/each}
				</div>
				<button
					onclick={() => (userModalOpen = true)}
					class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					+ User
				</button>
			</div>
		</div>
	</nav>

	{@render children()}
</div>

<Modal bind:open={userModalOpen} title="New User">
	<div class="space-y-3">
		<div>
			<label class="block text-sm font-medium text-gray-700">Name *</label>
			<input
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				placeholder="User name"
				bind:value={newUserName}
			/>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Color</label>
			<div class="mt-1 flex items-center gap-3">
				<input type="color" class="h-9 w-16 rounded border border-gray-300 p-0.5" bind:value={newUserColor} />
				<span class="text-sm text-gray-500">{newUserColor}</span>
			</div>
		</div>
		<div class="pt-1">
			<button
				onclick={createUser}
				disabled={saving || !newUserName.trim()}
				class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{saving ? 'Creating…' : 'Create User'}
			</button>
		</div>
	</div>
</Modal>
