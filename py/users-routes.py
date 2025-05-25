# routes/users.py
from fastapi import APIRouter, HTTPException, Depends, Body, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
import uuid

from db.database import get_db
from db.models import User, Topic
from schemas.user_schemas import UserCreate, UserRead, UserUpdate, UserPairResult

router = APIRouter()

@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
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

@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: str, db: Session = Depends(get_db)):
    """
    Get user details by ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserRead)
async def update_user(user_id: str, user_update: UserUpdate, db: Session = Depends(get_db)):
    """
    Update user details.
    """
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user fields
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, db: Session = Depends(get_db)):
    """
    Delete a user.
    """
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(db_user)
    db.commit()
    return {"status": "success"}

@router.post("/pair", response_model=UserPairResult)
async def pair_users(
    user1_id: str = Body(...), 
    user2_id: str = Body(...), 
    db: Session = Depends(get_db)
):
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

@router.get("/", response_model=List[UserRead])
async def get_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    Get a list of users with pagination.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users
