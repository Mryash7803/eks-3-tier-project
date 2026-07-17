package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// Connect connects to the database with a retry loop using credentials from environment variables.
func Connect() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "db")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPass := getEnv("DB_PASSWORD", "postgres_password")
	dbName := getEnv("DB_NAME", "tasks_db")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPass, dbName, dbSSLMode)

	var db *sql.DB
	var err error
	maxRetries := 10
	for i := 1; i <= maxRetries; i++ {
		log.Printf("Connecting to database (attempt %d/%d)...", i, maxRetries)
		db, err = sql.Open("postgres", connStr)
		if err == nil {
			err = db.Ping()
			if err == nil {
				db.SetMaxOpenConns(5)
				db.SetMaxIdleConns(2)
				db.SetConnMaxLifetime(5 * time.Minute)
				db.SetConnMaxIdleTime(2 * time.Minute)
				log.Println("Successfully connected to the database!")
				return db, nil
			}
		}

		log.Printf("Database not ready: %v. Retrying in 3 seconds...", err)
		time.Sleep(3 * time.Second)
	}

	return nil, fmt.Errorf("could not connect to database after %d attempts: %w", maxRetries, err)
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
