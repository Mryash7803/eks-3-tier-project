package metrics

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HttpRequestsTotal counts the total HTTP requests processed.
	HttpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests processed",
		},
		[]string{"method", "path", "status"},
	)

	// HttpRequestDuration tracks request latency in seconds.
	HttpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// HttpRequestsInProgress tracks HTTP requests currently in progress.
	HttpRequestsInProgress = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "http_requests_in_progress",
			Help: "Number of HTTP requests currently in progress",
		},
		[]string{"method", "path"},
	)

	// TasksCreatedTotal counts the total number of tasks created successfully.
	TasksCreatedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "tasks_created_total",
			Help: "Total tasks successfully created",
		},
	)
)

// responseWriter is a custom response writer that captures the status code of the HTTP response.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// normalizePath maps path patterns to avoid high cardinality metrics.
func normalizePath(path string) string {
	if path == "/api/health" {
		return "/api/health"
	}
	if path == "/api/tasks" {
		return "/api/tasks"
	}
	if strings.HasPrefix(path, "/api/tasks/") {
		return "/api/tasks/{id}"
	}
	return path
}

// Middleware instruments HTTP requests with Prometheus metrics.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Exclude metrics endpoint from tracking
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}

		path := normalizePath(r.URL.Path)
		method := r.Method

		// Increment in-progress gauge
		HttpRequestsInProgress.WithLabelValues(method, path).Inc()
		defer HttpRequestsInProgress.WithLabelValues(method, path).Dec()

		start := time.Now()

		rw := newResponseWriter(w)
		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()

		// Record duration and total requests
		HttpRequestDuration.WithLabelValues(method, path).Observe(duration)
		HttpRequestsTotal.WithLabelValues(method, path, strconv.Itoa(rw.statusCode)).Inc()
	})
}
