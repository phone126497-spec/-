export interface Todo {
  id: string;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
  created_at: string;
}

export type FilterType = 'all' | 'active' | 'completed';
