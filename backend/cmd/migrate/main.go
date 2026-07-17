package main

import (
	"log"
	"os"

	"eks-3-tier-project/backend/internal/db"
)

func main() {
	log.Println("Starting database migration...")

	database, err := db.Connect()
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
		os.Exit(1)
	}
	defer database.Close()

	err = db.RunMigrations(database)
	if err != nil {
		log.Printf("Failed to run migrations: %v", err)
		os.Exit(1)
	}

	log.Println("Database migration completed successfully!")
	os.Exit(0)
}
