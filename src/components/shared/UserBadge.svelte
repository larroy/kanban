<script lang="ts">
	let {
		user,
		size = 'sm'
	}: {
		user: { name: string; color: string } | null;
		size?: 'sm' | 'md';
	} = $props();

	const initials = $derived(
		user ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : ''
	);
	const sizeClass = $derived(size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm');
</script>

{#if user}
	<div
		class="flex items-center justify-center rounded-full font-semibold text-white {sizeClass}"
		style="background-color: {user.color}"
		title={user.name}
	>
		{initials}
	</div>
{/if}
