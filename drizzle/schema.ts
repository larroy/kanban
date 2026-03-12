import { pgTable, serial, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	color: text('color').notNull().default('#6366f1'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const projects = pgTable('projects', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	status: text('status').notNull().default('active'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const tasks = pgTable(
	'tasks',
	{
		id: serial('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		status: text('status').notNull().default('todo'),
		position: integer('position').notNull().default(0),
		projectId: integer('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('tasks_status_position_idx').on(table.status, table.position),
		index('tasks_project_id_idx').on(table.projectId)
	]
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type NewProject = typeof projects.$inferInsert;
export type NewTask = typeof tasks.$inferInsert;
