from sqlalchemy import create_engine, Column, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)  # Would be hashed in production
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    topics = relationship("Topic", back_populates="creator")
    knowledge_nodes = relationship("KnowledgeNode", back_populates="creator")

class Topic(Base):
    __tablename__ = "topics"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    creator = relationship("User", back_populates="topics")
    nodes = relationship("KnowledgeNode", back_populates="topic")
    edges = relationship("KnowledgeEdge", back_populates="topic")

class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"
    
    id = Column(String, primary_key=True)
    topic_id = Column(String, ForeignKey("topics.id"))
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    mastery_level = Column(Float, default=0.0)  # Ranges from 0.0 to 1.0
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    topic = relationship("Topic", back_populates="nodes")
    creator = relationship("User", back_populates="knowledge_nodes")
    
    # Relationships for edges
    outgoing_edges = relationship(
        "KnowledgeEdge", 
        foreign_keys="KnowledgeEdge.source_id", 
        back_populates="source_node"
    )
    incoming_edges = relationship(
        "KnowledgeEdge", 
        foreign_keys="KnowledgeEdge.target_id", 
        back_populates="target_node"
    )

class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"
    
    id = Column(String, primary_key=True)
    topic_id = Column(String, ForeignKey("topics.id"))
    source_id = Column(String, ForeignKey("knowledge_nodes.id"))
    target_id = Column(String, ForeignKey("knowledge_nodes.id"))
    relationship_type = Column(String, default="prerequisite")  # e.g., prerequisite, related, etc.
    strength = Column(Float, default=1.0)  # Relationship strength/weight
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    topic = relationship("Topic", back_populates="edges")
    source_node = relationship("KnowledgeNode", foreign_keys=[source_id], back_populates="outgoing_edges")
    target_node = relationship("KnowledgeNode", foreign_keys=[target_id], back_populates="incoming_edges")

# Database connection
SQLALCHEMY_DATABASE_URL = "sqlite:///./epistema.db"  # Using SQLite for simplicity
# For production, you'd use something like:
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/dbname"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
