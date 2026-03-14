import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Bell, 
  Edit3, 
  X, 
  Filter,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast, { Toaster } from 'react-hot-toast';
import { Todo, FilterType } from './types';
import { supabase } from './supabase';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Fetch todos from local API
  const fetchTodos = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/todos');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setTodos(data || []);
      localStorage.setItem('taskflow_server_connected', 'true');
    } catch (error: any) {
      console.error('Error fetching todos:', error.message);
      localStorage.setItem('taskflow_server_connected', 'false');
      const saved = localStorage.getItem('taskflow_todos');
      setTodos(saved ? JSON.parse(saved) : []);
      if (!silent) toast.error('서버 연결 실패. 로컬 모드로 작동합니다.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const isServerActive = () => localStorage.getItem('taskflow_server_connected') === 'true';

  useEffect(() => {
    fetchTodos();
  }, []);

  // Save to localStorage as backup
  useEffect(() => {
    if (!isServerActive()) {
      localStorage.setItem('taskflow_todos', JSON.stringify(todos));
    }
  }, [todos]);

  // Notification check
  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date();
      todos.forEach(todo => {
        if (!todo.completed && todo.due_date) {
          const due = parseISO(todo.due_date);
          if (isToday(due) && now.getHours() === 9 && now.getMinutes() === 0) {
            toast(`오늘 마감인 할일이 있습니다: ${todo.title}`, {
              icon: '🔔',
              duration: 5000,
            });
          }
        }
      });
    };

    const interval = setInterval(checkNotifications, 60000);
    return () => clearInterval(interval);
  }, [todos]);

  const filteredTodos = useMemo(() => {
    return todos
      .filter(todo => {
        const matchesSearch = todo.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (todo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        
        if (hideCompleted && todo.completed) return false;
        
        const matchesFilter = filter === 'all' ? true : 
                            filter === 'completed' ? todo.completed : !todo.completed;
        return matchesSearch && matchesFilter;
      });
  }, [todos, searchQuery, filter, hideCompleted]);

  const handleAddOrUpdateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const serverActive = isServerActive();

    try {
      if (editingTodo) {
        if (serverActive) {
          const response = await fetch(`/api/todos/${editingTodo.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, due_date: dueDate || null }),
          });
          if (!response.ok) throw new Error('Update failed');
        } else {
          setTodos(todos.map(t => t.id === editingTodo.id ? {
            ...t,
            title,
            description,
            due_date: dueDate || null,
          } : t));
        }
        toast.success('할일이 수정되었습니다.');
      } else {
        if (serverActive) {
          const response = await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, due_date: dueDate || null, completed: false }),
          });
          if (!response.ok) throw new Error('Create failed');
        } else {
          const newTodo: Todo = {
            id: crypto.randomUUID(),
            title,
            description,
            due_date: dueDate || null,
            completed: false,
            created_at: new Date().toISOString(),
          };
          setTodos([newTodo, ...todos]);
        }
        toast.success('새로운 할일이 등록되었습니다.');
      }
      if (serverActive) fetchTodos(true);
      closeModal();
    } catch (error: any) {
      console.error('Error saving todo:', error.message);
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    const serverActive = isServerActive();
    try {
      if (serverActive) {
        const response = await fetch(`/api/todos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !currentStatus }),
        });
        if (!response.ok) throw new Error('Toggle failed');
      }
      
      setTodos(todos.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
      if (!currentStatus) {
        toast.success('할일을 완료했습니다! 🎉');
      }
    } catch (error: any) {
      console.error('Error toggling todo:', error.message);
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const deleteTodo = async (id: string) => {
    const serverActive = isServerActive();
    try {
      if (serverActive) {
        const response = await fetch(`/api/todos/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Delete failed');
      }
      
      setTodos(todos.filter(t => t.id !== id));
      toast.error('할일이 삭제되었습니다.');
    } catch (error: any) {
      console.error('Error deleting todo:', error.message);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const openModal = (todo?: Todo) => {
    if (todo) {
      setEditingTodo(todo);
      setTitle(todo.title);
      setDescription(todo.description || '');
      setDueDate(todo.due_date || '');
    } else {
      setEditingTodo(null);
      setTitle('');
      setDescription('');
      setDueDate('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTodo(null);
    setTitle('');
    setDescription('');
    setDueDate('');
  };

  const stats = {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-zinc-900 mb-2"
          >
            TaskFlow
          </motion.h1>
          <p className="text-zinc-500 font-medium">
            {isServerActive() ? '서버 저장소와 함께하는 스마트한 할일 관리.' : '로컬 저장소 모드 (서버 연결 확인 필요)'}
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {!isServerActive() && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
              <AlertCircle size={12} />
              서버 연결에 문제가 있습니다
            </div>
          )}
          <button 
            onClick={() => openModal()}
            className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg hover:shadow-zinc-200 active:scale-95"
          >
            <Plus size={20} />
            새 할일 추가
          </button>
        </div>
      </header>

      {/* Stats & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">진행 중</p>
            <p className="text-2xl font-bold text-zinc-900">{stats.active}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">완료됨</p>
            <p className="text-2xl font-bold text-zinc-900">{stats.completed}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600">
            <Filter size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">전체</p>
            <p className="text-2xl font-bold text-zinc-900">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text"
            placeholder="할일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
            <div 
              onClick={() => setHideCompleted(!hideCompleted)}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                hideCompleted ? 'bg-zinc-900' : 'bg-zinc-200'
              }`}
            >
              <motion.div 
                animate={{ x: hideCompleted ? 18 : 2 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </div>
            <span className="text-sm font-bold text-zinc-600 group-hover:text-zinc-900 transition-colors">
              완료 숨기기
            </span>
          </label>

          <div className="flex bg-zinc-100 p-1 rounded-2xl">
            {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filter === f 
                    ? 'bg-white text-zinc-900 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {f === 'all' ? '전체' : f === 'active' ? '진행 중' : '완료'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Todo List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-medium">데이터를 불러오는 중...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTodos.length > 0 ? (
              filteredTodos.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`glass-card p-5 rounded-2xl flex items-start gap-4 group transition-all ${
                    todo.completed ? 'opacity-60' : ''
                  }`}
                >
                  <button 
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className={`mt-1 transition-colors ${
                      todo.completed ? 'text-emerald-500' : 'text-zinc-300 hover:text-zinc-400'
                    }`}
                  >
                    {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-bold leading-tight mb-1 ${
                      todo.completed ? 'line-through text-zinc-400' : 'text-zinc-900'
                    }`}>
                      {todo.title}
                    </h3>
                    {todo.description && (
                      <p className="text-zinc-500 text-sm mb-3 line-clamp-2">{todo.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-3 items-center">
                      {todo.due_date && (
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${
                          !todo.completed && isPast(parseISO(todo.due_date)) && !isToday(parseISO(todo.due_date))
                            ? 'bg-red-50 text-red-600'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          <Calendar size={14} />
                          {format(parseISO(todo.due_date), 'yyyy년 MM월 dd일', { locale: ko })}
                          {!todo.completed && isPast(parseISO(todo.due_date)) && !isToday(parseISO(todo.due_date)) && (
                            <span className="ml-1">(연체)</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-lg">
                        <Clock size={14} />
                        {format(parseISO(todo.created_at), 'HH:mm')}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openModal(todo)}
                      className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => deleteTodo(todo.id)}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-100 text-zinc-300 mb-4">
                  <AlertCircle size={40} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-1">할일이 없습니다</h3>
                <p className="text-zinc-500">새로운 할일을 추가하여 하루를 시작해보세요.</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-zinc-900">
                  {editingTodo ? '할일 수정' : '새 할일 추가'}
                </h2>
                <button 
                  onClick={closeModal}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-all text-zinc-400"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddOrUpdateTodo} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">제목</label>
                  <input 
                    autoFocus
                    type="text"
                    required
                    placeholder="무엇을 해야 하나요?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">설명 (선택)</label>
                  <textarea 
                    placeholder="상세 내용을 입력하세요..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">마감일 (선택)</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 rounded-2xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 rounded-2xl font-bold text-white bg-zinc-900 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    {editingTodo ? '저장하기' : '등록하기'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Notification Info */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-4">
        {!isServerActive() && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-amber-900 text-white p-4 rounded-2xl shadow-2xl max-w-xs text-xs border border-amber-800"
          >
            <div className="flex items-center gap-2 mb-2 font-bold text-amber-400">
              <AlertCircle size={14} />
              클라우드 저장 비활성
            </div>
            <p className="leading-relaxed opacity-90">
              서버와의 연결이 원활하지 않습니다. 현재 데이터는 브라우저의 로컬 저장소에만 저장됩니다.
            </p>
          </motion.div>
        )}
        <div className="group relative">
          <div className="bg-white p-3 rounded-full shadow-xl border border-zinc-100 text-zinc-400 hover:text-zinc-900 transition-all cursor-help">
            <Bell size={24} />
          </div>
          <div className="absolute bottom-full right-0 mb-4 w-64 p-4 bg-zinc-900 text-white rounded-2xl text-xs opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl">
            <p className="font-bold mb-1">스마트 알림</p>
            <p className="text-zinc-400">매일 오전 9시에 오늘 마감인 할일을 알려드립니다. (브라우저가 열려있어야 합니다)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
