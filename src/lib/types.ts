export type { User, Project, Task, NewUser, NewProject, NewTask } from '../../drizzle/schema.js';
export type { TaskWithAssignee } from './server/queries/tasks.js';

export type ProjectWithStats = {
	id: number;
	name: string;
	description: string | null;
	status: string;
	createdAt: Date;
	updatedAt: Date;
	totalTasks: number;
	doneTasks: number;
	lastTaskCompletedAt?: Date | null;
};
