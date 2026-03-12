-- Auto-update updated_at on tasks and projects
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-complete projects when all tasks are done
CREATE OR REPLACE FUNCTION check_project_completion()
RETURNS TRIGGER AS $$
DECLARE
  proj_id INTEGER;
  total_tasks INTEGER;
  done_tasks INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    proj_id := OLD.project_id;
  ELSE
    proj_id := NEW.project_id;
  END IF;

  SELECT COUNT(*) INTO total_tasks FROM tasks WHERE project_id = proj_id;
  SELECT COUNT(*) INTO done_tasks FROM tasks WHERE project_id = proj_id AND status = 'done';

  IF total_tasks > 0 AND total_tasks = done_tasks THEN
    UPDATE projects SET status = 'done' WHERE id = proj_id;
  ELSE
    UPDATE projects SET status = 'active' WHERE id = proj_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tasks_project_completion
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION check_project_completion();
