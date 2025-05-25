from fastapi import FastAPI, HTTPException, Depends, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field, EmailStr
import datetime
import uuid

# Database models would be defined here or imported
from db.database import get_db
from db.models import User, Topic, KnowledgeNode, KnowledgeEdge
from services.graph_service import text_to_graph, generate_knowledge_map
from services.llm_service import generate_topic_connection

# Pydantic models for request/response validation
class UserBase(BaseModel):
    username: str
    email: EmailStr
    
class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: str
    created_at: datetime.datetime
    
    class Config:
        orm_mode = True

class TopicBase(BaseModel):
    name: str
    description: Optional[str] = None

class TopicCreate(TopicBase):
    pass

class TopicRead(TopicBase):
    id: str
    created_by: str
    created_at: datetime.datetime
    
    class Config:
        orm_mode = True

class KnowledgeNodeBase(BaseModel):
    label: str
    description: Optional[str] = None
    mastery_level: Optional[float] = 0.0
    
class KnowledgeNodeCreate(KnowledgeNodeBase):
    topic_id: str

class KnowledgeNodeRead(KnowledgeNodeBase):
    id: str
    topic_id: str
    
    class Config:
        orm_mode = True

class KnowledgeEdgeBase(BaseModel):
    source_id: str
    target_id: str
    relationship_type: str = "prerequisite"  # Default to prerequisite relationship
    strength: Optional[float] = 1.0

class KnowledgeEdgeCreate(KnowledgeEdgeBase):
    topic_id: str

class KnowledgeEdgeRead(KnowledgeEdgeBase):
    id: str
    topic_id: str
    
    class Config:
        orm_mode = True

class GraphData(BaseModel):
    nodes: List[KnowledgeNodeCreate]
    edges: List[KnowledgeEdgeCreate]

class KnowledgeInput(BaseModel):
    topic_id: str
    content_type: str = "text"  # Could be "text" or "graph"
    text_content: Optional[str] = None
    graph_content: Optional[GraphData] = None

class UserPairResult(BaseModel):
    user1_id: str
    user2_id: str
    similarity_score: float
    common_topics: List[str]
    unique_to_user1: List[str]
    unique_to_user2: List[str]

class TopicConnectionRequest(BaseModel):
    topic1_id: str
    topic2_id: str

class TopicConnectionResponse(BaseModel):
    topic1_name: str
    topic2_name: str
    connection_text: str

# Initialize FastAPI app
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

# User Endpoints
@app.post("/users/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user in the system.
    """
    # Check if user with email already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user (password would be hashed in a real implementation)
    new_user = User(
        id=str(uuid.uuid4()),
        username=user.username,
        email=user.email,
        password=user.password,  # In real app, this would be hashed
        created_at=datetime.datetime.now()
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: str, db: Session = Depends(get_db)):
    """
    Get user details by ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Topic Endpoints
@app.post("/topics/", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
def create_topic(topic: TopicCreate, user_id: str = Body(...), db: Session = Depends(get_db)):
    """
    Create a new topic.
    """
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create new topic
    new_topic = Topic(
        id=str(uuid.uuid4()),
        name=topic.name,
        description=topic.description,
        created_by=user_id,
        created_at=datetime.datetime.now()
    )
    
    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    return new_topic

@app.get("/topics/", response_model=List[TopicRead])
def get_topics(user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Get all topics, optionally filtered by user.
    """
    if user_id:
        topics = db.query(Topic).filter(Topic.created_by == user_id).all()
    else:
        topics = db.query(Topic).all()
    return topics

@app.get("/topics/{topic_id}", response_model=TopicRead)
def get_topic(topic_id: str, db: Session = Depends(get_db)):
    """
    Get topic details by ID.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic

# Knowledge Management Endpoints
@app.post("/knowledge/", status_code=status.HTTP_201_CREATED)
def add_knowledge(knowledge: KnowledgeInput, user_id: str = Body(...), db: Session = Depends(get_db)):
    """
    Add knowledge to a topic, either as text or a graph structure.
    """
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify topic exists
    topic = db.query(Topic).filter(Topic.id == knowledge.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Process based on content type
    if knowledge.content_type == "text" and knowledge.text_content:
        # Convert text to graph structure
        graph_data = text_to_graph(knowledge.text_content)
        
        # Save nodes and edges
        for node in graph_data.nodes:
            new_node = KnowledgeNode(
                id=str(uuid.uuid4()),
                topic_id=knowledge.topic_id,
                label=node.label,
                description=node.description,
                mastery_level=node.mastery_level,
                created_by=user_id,
                created_at=datetime.datetime.now()
            )
            db.add(new_node)
        
        db.commit()  # Commit nodes first to have their IDs
        
        # Now add edges with the newly created nodes
        # This would require mapping from temp IDs in graph_data to real DB IDs
        # Simplified here but would need implementation
        for edge in graph_data.edges:
            new_edge = KnowledgeEdge(
                id=str(uuid.uuid4()),
                topic_id=knowledge.topic_id,
                source_id=edge.source_id,  # Would need mapping
                target_id=edge.target_id,  # Would need mapping
                relationship_type=edge.relationship_type,
                strength=edge.strength,
                created_at=datetime.datetime.now()
            )
            db.add(new_edge)
        
        db.commit()
        
    elif knowledge.content_type == "graph" and knowledge.graph_content:
        # Direct graph data provided
        for node in knowledge.graph_content.nodes:
            new_node = KnowledgeNode(
                id=str(uuid.uuid4()),
                topic_id=knowledge.topic_id,
                label=node.label,
                description=node.description,
                mastery_level=node.mastery_level,
                created_by=user_id,
                created_at=datetime.datetime.now()
            )
            db.add(new_node)
        
        db.commit()  # Commit nodes first
        
        # Same issue with mapping IDs as above
        for edge in knowledge.graph_content.edges:
            new_edge = KnowledgeEdge(
                id=str(uuid.uuid4()),
                topic_id=knowledge.topic_id,
                source_id=edge.source_id,
                target_id=edge.target_id,
                relationship_type=edge.relationship_type,
                strength=edge.strength,
                created_at=datetime.datetime.now()
            )
            db.add(new_edge)
        
        db.commit()
    else:
        raise HTTPException(
            status_code=400, 
            detail="Invalid content type or missing content"
        )
    
    return {"status": "success", "message": "Knowledge added successfully"}

@app.get("/knowledge/{topic_id}")
def get_knowledge(topic_id: str, db: Session = Depends(get_db)):
    """
    Get knowledge graph for a specific topic.
    """
    # Verify topic exists
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get all nodes and edges for the topic
    nodes = db.query(KnowledgeNode).filter(KnowledgeNode.topic_id == topic_id).all()
    edges = db.query(KnowledgeEdge).filter(KnowledgeEdge.topic_id == topic_id).all()
    
    # Format for response
    node_data = [
        {
            "id": node.id,
            "label": node.label,
            "description": node.description,
            "mastery_level": node.mastery_level
        }
        for node in nodes
    ]
    
    edge_data = [
        {
            "id": edge.id,
            "source": edge.source_id,
            "target": edge.target_id,
            "type": edge.relationship_type,
            "strength": edge.strength
        }
        for edge in edges
    ]
    
    return {
        "topic": {
            "id": topic.id,
            "name": topic.name,
            "description": topic.description
        },
        "graph": {
            "nodes": node_data,
            "edges": edge_data
        }
    }

# Text to Graph Conversion Endpoint
@app.post("/tools/text-to-graph")
def convert_text_to_graph(text_content: str = Body(..., embed=True)):
    """
    Convert text content to a knowledge graph structure.
    """
    try:
        graph_data = text_to_graph(text_content)
        return graph_data
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error converting text to graph: {str(e)}"
        )

# User Pairing Endpoint
@app.post("/users/pair", response_model=UserPairResult)
def pair_users(user1_id: str = Body(...), user2_id: str = Body(...), db: Session = Depends(get_db)):
    """
    Analyze two users and find similarities in their knowledge topics.
    """
    # Verify both users exist
    user1 = db.query(User).filter(User.id == user1_id).first()
    user2 = db.query(User).filter(User.id == user2_id).first()
    
    if not user1 or not user2:
        raise HTTPException(status_code=404, detail="One or both users not found")
    
    # Get topics for each user
    user1_topics = db.query(Topic).filter(Topic.created_by == user1_id).all()
    user2_topics = db.query(Topic).filter(Topic.created_by == user2_id).all()
    
    # Create sets of topic IDs for easy comparison
    user1_topic_ids = {topic.id for topic in user1_topics}
    user2_topic_ids = {topic.id for topic in user2_topics}
    
    # Find common and unique topics
    common_topic_ids = user1_topic_ids.intersection(user2_topic_ids)
    unique_to_user1 = user1_topic_ids - user2_topic_ids
    unique_to_user2 = user2_topic_ids - user1_topic_ids
    
    # Calculate a simple similarity score
    total_topics = len(user1_topic_ids.union(user2_topic_ids))
    similarity_score = len(common_topic_ids) / total_topics if total_topics > 0 else 0
    
    # Get topic names instead of IDs for better readability
    topic_id_to_name = {
        topic.id: topic.name 
        for topic in db.query(Topic).filter(
            Topic.id.in_(user1_topic_ids.union(user2_topic_ids))
        ).all()
    }
    
    common_topics = [topic_id_to_name.get(tid) for tid in common_topic_ids]
    user1_unique = [topic_id_to_name.get(tid) for tid in unique_to_user1]
    user2_unique = [topic_id_to_name.get(tid) for tid in unique_to_user2]
    
    return UserPairResult(
        user1_id=user1_id,
        user2_id=user2_id,
        similarity_score=similarity_score,
        common_topics=common_topics,
        unique_to_user1=user1_unique,
        unique_to_user2=user2_unique
    )

# Topic Connection "Dream" Endpoint
@app.post("/tools/dream-connection", response_model=TopicConnectionResponse)
def dream_connection(request: TopicConnectionRequest, db: Session = Depends(get_db)):
    """
    Generate a creative paragraph connecting two topics together.
    """
    # Verify both topics exist
    topic1 = db.query(Topic).filter(Topic.id == request.topic1_id).first()
    topic2 = db.query(Topic).filter(Topic.id == request.topic2_id).first()
    
    if not topic1 or not topic2:
        raise HTTPException(status_code=404, detail="One or both topics not found")
    
    # Call LLM service to generate connection
    connection_text = generate_topic_connection(topic1.name, topic2.name)
    
    return TopicConnectionResponse(
        topic1_name=topic1.name,
        topic2_name=topic2.name,
        connection_text=connection_text
    )

# Example service implementation stubs (would be in separate files)
def get_db():
    """Dependency for database session."""
    db = None
    try:
        # This would connect to the actual database
        db = "database_session"
        yield db
    finally:
        if db:
            # Close database connection
            pass
