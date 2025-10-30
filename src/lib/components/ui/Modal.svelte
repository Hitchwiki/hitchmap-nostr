<script lang="ts">
	import Button from './Button.svelte';

	const {
		onconfirm,
		oncancel,
		open = $bindable(),
		title,
		children,
		...props
	} = $props<{
		open: boolean;
		title?: string;
		onconfirm: () => void;
		oncancel: () => void;
		children: () => unknown;
	}>();

	function handleConfirm() {
		onconfirm();
	}

	function handleCancel() {
		oncancel();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-1000 flex items-center justify-center bg-black/40 backdrop-blur-sm"
		onclick={handleBackdropClick}
		role="dialog"
		tabindex="0"
		onkeydown={(e) => {
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
				handleCancel();
			}
		}}
		aria-modal="true"
	>
		<div
			class="flex max-w-[90vw] min-w-[320px] flex-col overflow-hidden rounded-lg bg-white shadow-lg"
		>
			{#if title}
				<div class="p-4">
					<h2 class="text-lg font-semibold">{title}</h2>
				</div>
			{/if}
			<div class="p-4">
				{@render children()}
			</div>
			<div class="flex justify-end gap-2 border-gray-200 p-4">
				<Button
					type="button"
					class="bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
					onclick={handleCancel}
				>
					Cancel
				</Button>
				<Button
					type="button"
					class="bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
					onclick={handleConfirm}
				>
					Confirm
				</Button>
			</div>
		</div>
	</div>
{/if}
