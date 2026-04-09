// ---------------------------------------------------------------------------
// Shared TypeScript types for the Mailroom frontend
// ---------------------------------------------------------------------------

// --- Extraction (from AI or manual pipeline) ---

export interface WorkflowStep {
  title: string;
  description?: string;
  owner?: string;
  due_date?: string;
  priority?: string;
}

export interface ExtractedWorkflow {
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface Extraction {
  id: string;
  summary: string | null;
  next_steps: string[];
  tasks: {
    title: string;
    description?: string;
    owner?: string;
    due_date?: string;
    priority?: string;
  }[];
  workflows: ExtractedWorkflow[];
  blockers: string[];
  follow_ups: {
    description: string;
    owner?: string;
    due_date?: string;
  }[];
  priority: string;
}

// --- Capture ---

export interface CaptureItem {
  id: string;
  source: string;
  content_type: string;
  status: string;
  captured_at: string;
  normalized_text: string | null;
  extraction: Extraction | null;
}

export interface CaptureList {
  items: CaptureItem[];
  pagination: { total_count: number };
}

// --- Tasks ---

export interface SubTask {
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  source: string;
  capture_id: string | null;
  workflow_id: string | null;
  workflow_name: string | null;
  workflow_order: number | null;
  blocked_by_workflow_id: string | null;
  blocked_by_workflow_name: string | null;
  blocked_by_task_id: string | null;
  blocked_by_task_title: string | null;
  is_blocked: boolean;
  approved_at: string;
}

export interface TaskDetail extends Task {
  labels: string[];
  reminder: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface TaskList {
  items: Task[];
  pagination: { total_count: number };
}

// --- Workflows ---

export interface WorkflowTask {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  status: string;
  priority: string;
  workflow_order: number;
  depends_on_prior?: boolean;
  sub_tasks?: SubTask[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  capture_id: string | null;
  tasks: WorkflowTask[];
}

export interface WorkflowList {
  items: Workflow[];
  pagination: { total_count: number };
}

// --- Review ---

export interface ReviewDecision {
  item_type: string;
  item_index: number;
  action: "approve" | "reject" | "edit";
  edited_value?: Record<string, unknown>;
}
