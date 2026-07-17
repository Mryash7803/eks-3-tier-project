import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  Edit3, 
  Plus, 
  AlertCircle, 
  RefreshCw, 
  Database 
} from 'lucide-react';

// Use an explicit API URL when provided during the Vite build.
// Otherwise, use the same origin as the frontend.
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }

  return '';
};

const API_BASE = getApiUrl();

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed'
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all', 'high', 'medium', 'low'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending'
  });

  // Fetch tasks and check DB health
  const fetchData = async () => {
    setLoading(true);
    await checkDbHealth();
    try {
      const response = await fetch(`${API_BASE}/api/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data || []);
      } else {
        console.error('Failed to fetch tasks');
      }
    } catch (err) {
      console.error('API Server unavailable:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkDbHealth = async () => {
    setHealthChecking(true);
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setDbConnected(data.status === 'healthy');
      } else {
        setDbConnected(false);
      }
    } catch (err) {
      setDbConnected(false);
    } finally {
      setHealthChecking(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Periodically poll for DB health and tasks every 15 seconds
    const interval = setInterval(() => {
      checkDbHealth();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const openAddModal = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      status: 'pending'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      let response;
      if (editingTask) {
        // Update task
        response = await fetch(`${API_BASE}/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        // Create task
        response = await fetch(`${API_BASE}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response.ok) {
        fetchData();
        closeModal();
      } else {
        alert('Error saving task');
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      alert('Failed to contact backend API server');
    }
  };

  const handleToggleStatus = async (task) => {
    const updatedStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...task,
          status: updatedStatus
        })
      });

      if (response.ok) {
        // Optimistic UI update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: updatedStatus } : t));
      } else {
        fetchData();
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Optimistic UI update
        setTasks(prev => prev.filter(t => t.id !== id));
      } else {
        fetchData();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Filter tasks based on status and priority
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = 
      filter === 'all' || 
      (filter === 'completed' && task.status === 'completed') || 
      (filter === 'pending' && task.status === 'pending');
      
    const matchesPriority = 
      priorityFilter === 'all' || 
      task.priority === priorityFilter;

    return matchesStatus && matchesPriority;
  });

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = totalTasks - completedTasks;
  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="app-header glass-panel">
        <div className="logo-section">
          <Layers className="logo-icon" size={32} />
          <h1>Aether Task Cloud</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            className="action-btn edit" 
            onClick={fetchData} 
            disabled={loading || healthChecking}
            title="Refresh database data"
          >
            <RefreshCw className={loading || healthChecking ? "animate-spin" : ""} size={18} />
          </button>
          <div className={`db-status ${dbConnected ? 'connected' : 'disconnected'}`}>
            <Database size={16} />
            <span className="status-dot"></span>
            <span>{dbConnected ? 'Database Connected' : 'Database Offline'}</span>
          </div>
        </div>
      </header>

      {/* Statistics Row */}
      <section className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <h3>Total Tasks</h3>
            <div className="stat-value">{totalTasks}</div>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info">
            <h3>Completed</h3>
            <div className="stat-value">{completedTasks}</div>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <Circle size={24} />
          </div>
          <div className="stat-info">
            <h3>Pending</h3>
            <div className="stat-value">{pendingTasks}</div>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>Urgent (High)</h3>
            <div className="stat-value">{highPriorityTasks}</div>
          </div>
        </div>
      </section>

      {/* Control Panel: Filters and Add Button */}
      <section className="control-panel glass-panel">
        <div className="filter-group">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Tasks
          </button>
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button 
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>

        <div className="filter-group">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Priority:</span>
          <button 
            className={`filter-btn ${priorityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${priorityFilter === 'high' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('high')}
          >
            High
          </button>
          <button 
            className={`filter-btn ${priorityFilter === 'medium' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('medium')}
          >
            Medium
          </button>
          <button 
            className={`filter-btn ${priorityFilter === 'low' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('low')}
          >
            Low
          </button>
        </div>

        <button className="btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          <span>Add New Task</span>
        </button>
      </section>

      {/* Tasks List */}
      {loading && tasks.length === 0 ? (
        <div className="empty-state glass-panel">
          <RefreshCw className="animate-spin empty-icon" size={48} />
          <h3>Loading dashboard data...</h3>
          <p>Connecting to backend API & verifying PostgreSQL service availability.</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-state glass-panel">
          <AlertCircle className="empty-icon" size={48} />
          <h3>No Tasks Found</h3>
          <p>
            {tasks.length === 0 
              ? "Your task list is empty. Get started by creating your first task!" 
              : "No tasks match your selected filter criteria."}
          </p>
          {tasks.length === 0 && (
            <button className="btn-primary" onClick={openAddModal} style={{ marginTop: '1.5rem' }}>
              <Plus size={18} />
              <span>Create Task</span>
            </button>
          )}
        </div>
      ) : (
        <div className="tasks-grid">
          {filteredTasks.map((task) => (
            <div 
              key={task.id} 
              className={`task-card glass-panel ${task.status === 'completed' ? 'completed' : ''}`}
            >
              <div>
                <div className="task-header">
                  <h2 className="task-title">{task.title}</h2>
                  <span className={`priority-badge ${task.priority}`}>
                    {task.priority}
                  </span>
                </div>
                <p className="task-desc">{task.description || "No description provided."}</p>
              </div>

              <div className="task-footer">
                <span className="task-date">{formatDate(task.created_at)}</span>
                <div className="task-actions">
                  <button 
                    className={`action-btn toggle ${task.status === 'completed' ? 'completed' : ''}`}
                    onClick={() => handleToggleStatus(task)}
                    title={task.status === 'completed' ? "Mark as Pending" : "Mark as Completed"}
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>
                  <button 
                    className="action-btn edit"
                    onClick={() => openEditModal(task)}
                    title="Edit Task"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDeleteTask(task.id)}
                    title="Delete Task"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTask ? 'Edit Task' : 'Create Task'}</h2>
              <button className="close-btn" onClick={closeModal}>
                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="title">Task Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    className="form-control"
                    placeholder="Enter task title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    className="form-control"
                    placeholder="Provide details about the task..."
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <div className="priority-selector">
                    <div className="priority-option">
                      <input
                        type="radio"
                        id="prio-low"
                        name="priority"
                        value="low"
                        checked={formData.priority === 'low'}
                        onChange={handleInputChange}
                      />
                      <label htmlFor="prio-low" className="priority-label low">Low</label>
                    </div>
                    <div className="priority-option">
                      <input
                        type="radio"
                        id="prio-medium"
                        name="priority"
                        value="medium"
                        checked={formData.priority === 'medium'}
                        onChange={handleInputChange}
                      />
                      <label htmlFor="prio-medium" className="priority-label medium">Medium</label>
                    </div>
                    <div className="priority-option">
                      <input
                        type="radio"
                        id="prio-high"
                        name="priority"
                        value="high"
                        checked={formData.priority === 'high'}
                        onChange={handleInputChange}
                      />
                      <label htmlFor="prio-high" className="priority-label high">High</label>
                    </div>
                  </div>
                </div>

                {editingTask && (
                  <div className="form-group">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      name="status"
                      className="form-control"
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
