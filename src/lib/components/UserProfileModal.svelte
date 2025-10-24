<script lang="ts">
	import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
	import { onMount } from 'svelte';

	let {
		user,
		open = $bindable(false)
	}: { user?: (NDKUserProfile & { pubkey: string }) | null; open: boolean } = $props();

	let closeBtn: HTMLButtonElement | undefined = $state();

	function close() {
		open = false;
	}

	function handleOverlayKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			close();
		}
	}

	onMount(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	});
</script>

{#if open && user}
	<div
		class="fixed inset-0 z-100 flex items-center justify-center bg-black/30 backdrop-blur-sm"
		role="button"
		tabindex="0"
		aria-label="Close modal"
		onclick={close}
		onkeydown={handleOverlayKeydown}
	>
		<div
			class="relative max-h-[80vh] w-11/12 max-w-md overflow-y-auto rounded-xl border border-gray-300 bg-white p-6 text-gray-900 shadow-2xl"
			role="dialog"
			aria-labelledby="modal-title"
		>
			<button
				class="absolute top-3 right-3 flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-none text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
				bind:this={closeBtn}
				onclick={close}
				aria-label="Close modal">×</button
			>
			<div class="mb-5 flex items-center gap-4">
				{#if user.picture}
					<img
						src={user.picture}
						alt=""
						class="h-15 w-15 rounded-full border-2 border-gray-300 object-cover"
					/>
				{/if}
				<h2 id="modal-title" class="m-0 text-xl font-semibold">
					{user.display_name || user.name || 'User'}
				</h2>
			</div>
			<div class="profile-details">
				{#if user.name}
					<p class="my-2 leading-relaxed">
						<strong class="text-gray-600">Name:</strong>
						{user.name}
					</p>
				{/if}
				{#if user.about}
					<p class="my-2 leading-relaxed">
						<strong class="text-gray-600">About:</strong>
						{user.about}
					</p>
				{/if}
				{#if user.nip05}
					<p class="my-2 leading-relaxed">
						<strong class="text-gray-600">NIP-05:</strong>
						{user.nip05}
					</p>
				{/if}
				{#if user.website}
					<p class="my-2 leading-relaxed">
						<strong class="text-gray-600">Website:</strong>
						<a href={user.website} target="_blank" rel="noopener noreferrer">{user.website}</a>
					</p>
				{/if}
				{#if user.bot !== undefined}
					<p class="my-2 leading-relaxed">
						<strong class="text-gray-600">Bot:</strong>
						{user.bot ? 'Yes' : 'No'}
					</p>
				{/if}
				<p class="my-2 leading-relaxed">
					<strong class="text-gray-600">Pubkey:</strong>
					<code class="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-sm break-all"
						>{user.pubkey}</code
					>
				</p>
			</div>
		</div>
	</div>
{/if}
