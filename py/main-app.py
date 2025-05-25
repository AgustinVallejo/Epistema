from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

# Import services
from services.graph_service import text_to_graph, generate_knowledge_map
from services.llm_service import generate_topic_connection, analyze_concept_structure, improve_concept_description, suggest_learning_path

# Import API route modules
from routes.users import router as users_router
from routes.topics import router as topics_router
from routes.knowledge import router as knowledge_router
from routes.tools import router as tools_router

# Create FastAPI app
app = FastAPI(
    title="Epistema API",
    description="API for Epistema - an adaptive learning application leveraging AI to generate interactive knowledge maps",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users_router, prefix="/users", tags=["Users"])
app.include_router(topics_router, prefix="/topics", tags=["Topics"])
app.include_router(knowledge_router, prefix="/knowledge", tags=["Knowledge"])
app.include_router(tools_router, prefix="/tools", tags=["Tools"])

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint providing API information.
    """
    return {
        "message": "Welcome to the Epistema API",
        "version": "0.1.0",
        "description": "An adaptive learning application leveraging AI to generate interactive knowledge maps",
        "documentation": "/docs",
    }

# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint to verify API is running.
    """
    return {"status": "healthy"}
