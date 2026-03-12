import Sortable from 'sortablejs';

export type SortableOptions = {
	group: string;
	onEnd: (evt: Sortable.SortableEvent) => void;
};

export function sortable(node: HTMLElement, options: SortableOptions) {
	const instance = Sortable.create(node, {
		group: options.group,
		animation: 150,
		ghostClass: 'opacity-40',
		dragClass: 'shadow-xl',
		onEnd: options.onEnd
	});

	return {
		destroy() {
			instance.destroy();
		},
		update(newOptions: SortableOptions) {
			instance.option('onEnd', newOptions.onEnd);
		}
	};
}
