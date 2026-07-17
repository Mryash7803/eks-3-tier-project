package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	dbpkg "eks-3-tier-project/backend/internal/db"
	"eks-3-tier-project/backend/internal/metrics"
)

// Task represents the database schema and JSON representation of a task
type Task struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`   // "pending", "completed"
	Priority    string    `json:"priority"` // "low", "medium", "high"
	CreatedAt   time.Time `json:"created_at"`
}

var db *sql.DB

func main() {
	log.Println("Starting backend server...")

	// Connect to Database
	var err error
	db, err = dbpkg.Connect()
	if err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}
	defer db.Close()

	// Set up HTTP Server and Routes
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/tasks", tasksHandler)
	mux.HandleFunc("/api/tasks/", taskHandler)
	mux.Handle("/metrics", promhttp.Handler())

	// Wrap in CORS and metrics middleware
	port := getEnv("PORT", "8080")
	serverAddr := fmt.Sprintf("0.0.0.0:%s", port)
	log.Printf("Server listening on %s", serverAddr)
	log.Fatal(http.ListenAndServe(serverAddr, corsMiddleware(metrics.Middleware(mux))))
}

// getEnv helper to read environment variable or return default
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// corsMiddleware wraps handler to add CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight OPTIONS request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// healthHandler handles GET /api/health requests
func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := db.Ping(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "unhealthy",
			"database": "disconnected",
			"error":    err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"database":  "connected",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// tasksHandler handles GET /api/tasks and POST /api/tasks
func tasksHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query("SELECT id, title, description, status, priority, created_at FROM tasks ORDER BY created_at DESC")
		if err != nil {
			log.Printf("Error querying tasks: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		tasks := []Task{}
		for rows.Next() {
			var t Task
			err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.CreatedAt)
			if err != nil {
				log.Printf("Error scanning task row: %v", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			tasks = append(tasks, t)
		}

		json.NewEncoder(w).Encode(tasks)

	case http.MethodPost:
		var t Task
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			http.Error(w, "Invalid input data", http.StatusBadRequest)
			return
		}

		if t.Title == "" {
			http.Error(w, "Title is required", http.StatusBadRequest)
			return
		}
		if t.Status == "" {
			t.Status = "pending"
		}
		if t.Priority == "" {
			t.Priority = "medium"
		}

		query := `
		INSERT INTO tasks (title, description, status, priority)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at`

		err := db.QueryRow(query, t.Title, t.Description, t.Status, t.Priority).Scan(&t.ID, &t.CreatedAt)
		if err != nil {
			log.Printf("Error inserting task: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		metrics.TasksCreatedTotal.Inc()
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(t)

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// taskHandler handles PUT /api/tasks/{id} and DELETE /api/tasks/{id}
func taskHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse ID from URL path (e.g. /api/tasks/123 -> "123")
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 || pathParts[3] == "" {
		http.Error(w, "Task ID is required", http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(pathParts[3])
	if err != nil {
		http.Error(w, "Invalid Task ID format", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodPut:
		var t Task
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			http.Error(w, "Invalid input data", http.StatusBadRequest)
			return
		}

		if t.Title == "" {
			http.Error(w, "Title is required", http.StatusBadRequest)
			return
		}

		query := `
		UPDATE tasks
		SET title = $1, description = $2, status = $3, priority = $4
		WHERE id = $5`

		result, err := db.Exec(query, t.Title, t.Description, t.Status, t.Priority, id)
		if err != nil {
			log.Printf("Error updating task: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			http.Error(w, "Task not found", http.StatusNotFound)
			return
		}

		t.ID = id
		json.NewEncoder(w).Encode(t)

	case http.MethodDelete:
		query := "DELETE FROM tasks WHERE id = $1"
		result, err := db.Exec(query, id)
		if err != nil {
			log.Printf("Error deleting task: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			http.Error(w, "Task not found", http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": fmt.Sprintf("Task with ID %d successfully deleted", id),
			"id":      id,
		})

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}
