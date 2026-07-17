package db

import (
	"database/sql"
	"log"
)

// RunMigrations initializes the database schema by running migrations.
func RunMigrations(db *sql.DB) error {
	createTableQuery := `
	CREATE TABLE IF NOT EXISTS tasks (
		id SERIAL PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		description TEXT,
		status VARCHAR(50) NOT NULL DEFAULT 'pending',
		priority VARCHAR(50) NOT NULL DEFAULT 'medium',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);`
	_, err := db.Exec(createTableQuery)
	if err != nil {
		return err
	}
	log.Println("Database schema is initialized.")
	return nil
}
