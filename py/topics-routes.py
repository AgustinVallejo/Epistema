# routes/topics.py
from fastapi import APIRouter, HTTPException, Depends, Body, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
import uuid

from db.database import get_db
from db.models import User, Topic
from schemas.user_schemas import TopicCreate, TopicRead, TopicUpdate

router = APIRouter()

@router.post("/", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
async def create_topic(
    topic: TopicCreate, 
    user_id: str = Body(...), 
    db: Session = Depends(get_db)
):
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

@router.get("/", response_model=List[TopicRead])
async def get_topics(
    user_id: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    Get all topics, optionally filtered by user.
    """
    if user_id:
        topics = db.query(Topic).filter(Topic.created_by == user_id).offset(skip).limit(limit).all()
    else:
        topics = db.query(Topic).offset(skip).limit(limit).all()
    return topics

@router.get("/{topic_id}", response_model=TopicRead)
async def get_topic(topic_id: str, db: Session = Depends(get_db)):
    """
    Get topic details by ID.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic

@router.put("/{topic_id}", response_model=TopicRead)
async def update_topic(
    topic_id: str, 
    topic_update: TopicUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update a topic.
    """
    db_topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Update topic fields
    for key, value in topic_update.dict(exclude_unset=True).items():
        setattr(db_topic, key, value)
    
    db.commit()
    db.refresh(db_topic)
    return db_topic

@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(topic_id: str, db: Session = Depends(get_db)):
    """
    Delete a topic.
    """
    db_topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    db.delete(db_topic)
    db.commit()
    return {"status": "success"}

@router.get("/{topic_id}/related", response_model=List[TopicRead])
async def get_related_topics(
    topic_id: str, 
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """
    Get topics that may be related to the specified topic.
    
    This is a placeholder implementation that would use more sophisticated 
    algorithms in a production system.
    """
    # Verify topic exists
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Simple implementation: get other topics from the same creator
    related_topics = db.query(Topic).filter(
        Topic.created_by == topic.created_by,
        Topic.id != topic_id
    ).limit(limit).all()
    
    return related_topics
