from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
import datetime

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    
class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class UserRead(UserBase):
    id: str
    created_at: datetime.datetime
    
    class Config:
        orm_mode = True

class UserPairResult(BaseModel):
    user1_id: str
    user2_id: str
    similarity_score: float
    common_topics: List[str]
    unique_to_user1: List[str]
    unique_to_user2: List[str]

# Topic schemas
class TopicBase(BaseModel):
    name: str
    description: Optional[str] = None

class TopicCreate(TopicBase):
    pass

class TopicUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class TopicRead(TopicBase):
    id: str
    created_by: str
    created_at: datetime.datetime
    
    class Config:
        orm_mode = True

# Knowledge node schemas
class KnowledgeNodeBase(BaseModel):
    label: str
    description: Optional[str] = None
    mastery_level: Optional[float] = 0.0
    
class KnowledgeNodeCreate(KnowledgeNodeBase):
    topic_id: str

class KnowledgeNodeUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    mastery_level: Optional[float] = None

class KnowledgeNodeRead(KnowledgeNodeBase):
    id: str
    topic_id: str
    created_by: str
    created_at: datetime.datetime
    
    class Config:
        orm_mode = True

# Knowledge edge schemas
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
    created_at: datetime.datetime
    
    class Config:
        orm_mode = True

# Graph data schemas
class GraphData(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

# Knowledge input schemas
class KnowledgeInput(BaseModel):
    topic_id: str
    content_type: str = "text"  # Could be "text" or "graph"
    text_content: Optional[str] = None
    graph_content: Optional[GraphData] = None

# Topic connection schemas
class TopicConnectionRequest(BaseModel):
    topic1_id: str
    topic2_id: str

class TopicConnectionResponse(BaseModel):
    topic1_name: str
    topic2_name: str
    connection_text: str

# User mastery schemas
class UserMasteryUpdate(BaseModel):
    user_id: str
    concept_id: str
    mastery_level: float = Field(..., ge=0.0, le=1.0)  # Between 0 and 1

# Learning path schemas
class LearningPathRequest(BaseModel):
    user_id: str
    topic_id: str

class LearningPathItem(BaseModel):
    id: str
    name: str
    reason: str

class LearningPathResponse(BaseModel):
    topic_id: str
    topic_name: str
    path: List[LearningPathItem]
