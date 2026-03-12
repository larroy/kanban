import type { TaskWithAssignee } from './types.js';

type BoardState = {
	tasks: TaskWithAssignee[];
	loading: boolean;
	dragging: boolean;
};

const state = $state<BoardState>({
	tasks: [],
	loading: false,
	dragging: false
});

export const board = {
	get tasks() { return state.tasks; },
	get loading() { return state.loading; },
	get dragging() { return state.dragging; },

	get todo() {
		return state.tasks
			.filter(t => t.status === 'todo')
			.sort((a, b) => a.position - b.position);
	},
	get doing() {
		return state.tasks
			.filter(t => t.status === 'doing')
			.sort((a, b) => a.position - b.position);
	},
	get done() {
		return state.tasks
			.filter(t => t.status === 'done')
			.sort((a, b) => a.position - b.position);
	},

	setTasks(tasks: TaskWithAssignee[]) {
		state.tasks = tasks;
	},

	addTask(task: TaskWithAssignee) {
		state.tasks = [...state.tasks, task];
	},

	updateTask(updated: Partial<TaskWithAssignee> & { id: number }) {
		state.tasks = state.tasks.map(t =>
			t.id === updated.id ? { ...t, ...updated } : t
		);
	},

	removeTask(id: number) {
		state.tasks = state.tasks.filter(t => t.id !== id);
	},

	async moveTask(id: number, newStatus: string, newPosition: number) {
		// Optimistic update
		const prev = state.tasks.map(t => ({ ...t }));
		const task = state.tasks.find(t => t.id === id);
		if (!task) return;

		const oldStatus = task.status;
		const oldPosition = task.position;

		// Apply optimistic reorder
		state.tasks = state.tasks.map(t => {
			if (t.id === id) return { ...t, status: newStatus, position: newPosition };

			if (oldStatus === newStatus) {
				if (oldPosition < newPosition && t.status === newStatus && t.position > oldPosition && t.position <= newPosition) {
					return { ...t, position: t.position - 1 };
				}
				if (oldPosition > newPosition && t.status === newStatus && t.position >= newPosition && t.position < oldPosition) {
					return { ...t, position: t.position + 1 };
				}
			} else {
				if (t.status === oldStatus && t.position > oldPosition) {
					return { ...t, position: t.position - 1 };
				}
				if (t.status === newStatus && t.position >= newPosition) {
					return { ...t, position: t.position + 1 };
				}
			}
			return t;
		});

		try {
			const res = await fetch(`/api/tasks/${id}/move`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: newStatus, position: newPosition })
			});
			if (!res.ok) throw new Error('move failed');
		} catch {
			// Rollback
			state.tasks = prev;
		}
	}
};
