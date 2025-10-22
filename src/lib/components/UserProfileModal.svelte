<script lang="ts">
	import { onMount } from 'svelte';

	interface UserProfile {
		display_name?: string;
		name?: string;
		about?: string;
		picture?: string;
		pubkey: string;
		nip05?: string;
		website?: string;
		bot?: boolean;
	}

	let { user, open = $bindable(false) }: { user: UserProfile; open: boolean } = $props();
	let closeBtn: HTMLButtonElement;

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

{#if open}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		aria-label="Close modal"
		onclick={close}
		onkeydown={handleOverlayKeydown}
	>
		<div class="modal" role="dialog" aria-labelledby="modal-title">
			<button class="close-btn" bind:this={closeBtn} onclick={close} aria-label="Close modal"
				>×</button
			>
			<div class="profile-header">
				{#if user.picture}
					<img src={user.picture} alt="" class="profile-picture" />
				{/if}
				<h2 id="modal-title">{user.display_name || user.name || 'User'}</h2>
			</div>
			<div class="profile-details">
				{#if user.name}
					<p><strong>Name:</strong> {user.name}</p>
				{/if}
				{#if user.about}
					<p><strong>About:</strong> {user.about}</p>
				{/if}
				{#if user.nip05}
					<p><strong>NIP-05:</strong> {user.nip05}</p>
				{/if}
				{#if user.website}
					<p>
						<strong>Website:</strong>
						<a href={user.website} target="_blank" rel="noopener noreferrer">{user.website}</a>
					</p>
				{/if}
				{#if user.bot !== undefined}
					<p><strong>Bot:</strong> {user.bot ? 'Yes' : 'No'}</p>
				{/if}
				<p><strong>Pubkey:</strong> <code>{user.pubkey}</code></p>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.modal {
		background: #1a1a1a;
		color: #ffffff;
		padding: 24px;
		border-radius: 12px;
		max-width: 400px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
		position: relative;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
		border: 1px solid #333;
	}

	.close-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		background: none;
		border: none;
		font-size: 24px;
		color: #ccc;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.close-btn:hover {
		background-color: #333;
		color: #fff;
	}

	.profile-header {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 20px;
	}

	.profile-picture {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid #555;
	}

	.profile-header h2 {
		margin: 0;
		font-size: 1.5em;
		font-weight: 600;
	}

	.profile-details p {
		margin: 8px 0;
		line-height: 1.5;
	}

	.profile-details strong {
		color: #aaa;
	}

	.profile-details code {
		background: #2a2a2a;
		padding: 2px 6px;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.9em;
		word-break: break-all;
	}
</style>
