from typing import Optional, List, Dict, Any
import os
import json
import openai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

class LLMService:
    """
    Service for interacting with Large Language Models (LLMs)
    for various Epistema AI capabilities.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the LLM service.
        
        Args:
            api_key: Optional API key for the LLM provider
        """
        if api_key:
            openai.api_key = api_key
        elif not openai.api_key:
            raise ValueError("No API key provided for LLM service")
    
    def generate_topic_connection(self, topic1: str, topic2: str) -> str:
        """
        Generate a creative description of how two topics might be connected.
        
        Args:
            topic1: First topic name
            topic2: Second topic name
            
        Returns:
            A paragraph describing potential connections between the topics
        """
        prompt = f"""
        Imagine an interesting and thought-provoking connection between the following two topics:
        
        Topic 1: {topic1}
        Topic 2: {topic2}
        
        Generate a creative and insightful paragraph that reveals a non-obvious relationship or 
        connection between these topics. Think about how understanding one topic might enhance 
        understanding of the other, or how they might share underlying principles or applications.
        
        Your response should be intellectually stimulating and should inspire new ways of thinking 
        about both topics. Focus on making a meaningful connection rather than a superficial one.
        """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert in interdisciplinary thinking, able to identify profound connections between seemingly unrelated topics."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
        except Exception as e:
            # Fallback response in case of API error
            return f"Connection between {topic1} and {topic2}: Both topics represent areas of knowledge that can be interconnected in an educational context. By exploring both fields, learners can develop a more holistic understanding of complex systems and interdisciplinary thinking."
    
    def analyze_concept_structure(self, text: str) -> Dict[str, Any]:
        """
        Analyze text to identify key concepts and their relationships.
        
        Args:
            text: Text content to analyze
            
        Returns:
            Dictionary with concepts and relationships
        """
        prompt = f"""
        Analyze the following text and identify:
        1. Key concepts (maximum 7)
        2. Prerequisite relationships between those concepts (which concepts are prerequisites for understanding other concepts)
        3. Brief description of each concept (1-2 sentences)
        
        Format the response as a JSON object with the following structure:
        {{
            "concepts": [
                {{"name": "concept_name", "description": "brief description"}},
                ...
            ],
            "relationships": [
                {{"source": "prerequisite_concept", "target": "dependent_concept"}},
                ...
            ]
        }}
        
        Text to analyze:
        {text}
        """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4",  # Using GPT-4 for better structured reasoning
                messages=[
                    {"role": "system", "content": "You are an expert in knowledge engineering and concept mapping."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.3
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Extract JSON from response (in case there's explanatory text)
            json_start = result_text.find('{')
            json_end = result_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = result_text[json_start:json_end]
                try:
                    return json.loads(json_str)
                except:
                    pass
            
            # If JSON parsing fails, return a simple structured response
            return {
                "concepts": [
                    {"name": "Main Topic", "description": "The central topic of the analyzed text."}
                ],
                "relationships": []
            }
        except Exception as e:
            # Fallback structure in case of API error
            return {
                "concepts": [
                    {"name": "Main Topic", "description": "The central topic of the analyzed text."}
                ],
                "relationships": []
            }
    
    def improve_concept_description(self, concept_name: str, current_description: Optional[str] = None) -> str:
        """
        Generate or improve a concept description.
        
        Args:
            concept_name: Name of the concept
            current_description: Optional current description to improve
            
        Returns:
            Improved concept description
        """
        if current_description:
            prompt = f"""
            Improve the following description of the concept "{concept_name}":
            
            Current description: {current_description}
            
            Create a concise, clear, and informative description that would help a learner 
            understand this concept. The description should be 2-3 sentences long and should 
            highlight the most important aspects of the concept.
            """
        else:
            prompt = f"""
            Create a concise, clear, and informative description of the concept "{concept_name}".
            
            The description should be 2-3 sentences long and should highlight the most important 
            aspects of the concept, aiming to help a learner understand what this concept is about.
            """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert educator skilled at creating clear, concise concept explanations."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.4
            )
            
            return response.choices[0].message.content.strip()
        except Exception as e:
            # Fallback response
            return current_description or f"{concept_name} is an important concept in this knowledge domain."

    def suggest_learning_path(self, topic_name: str, concept_graph: Dict[str, Any], user_mastery: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Suggest a personalized learning path based on the concept graph and user's current mastery levels.
        
        Args:
            topic_name: The main topic name
            concept_graph: The knowledge graph structure
            user_mastery: Dictionary mapping concept IDs to mastery levels (0.0 to 1.0)
            
        Returns:
            Ordered list of concepts to learn next
        """
        # Prepare the graph data for the prompt
        concepts_str = json.dumps([{
            "id": node["id"],
            "name": node["label"],
            "mastery": user_mastery.get(node["id"], 0.0)
        } for node in concept_graph["nodes"]])
        
        relationships_str = json.dumps([{
            "source": edge["source"],
            "target": edge["target"],
            "type": edge["type"]
        } for edge in concept_graph["edges"]])
        
        prompt = f"""
        Based on the following knowledge graph for the topic "{topic_name}" and the user's current mastery levels,
        suggest an optimal learning path of 3-5 concepts for the user to focus on next.
        
        Consider the prerequisite relationships and prioritize concepts where:
        1. All prerequisites have high mastery (above 0.7)
        2. The concept itself has low mastery (below 0.3)
        3. The concept is important (has many dependent concepts)
        
        Concepts (with current mastery levels):
        {concepts_str}
        
        Relationships (prerequisites):
        {relationships_str}
        
        Format your response as a JSON array of objects with the following structure:
        [
            {{"id": "concept_id", "name": "concept_name", "reason": "reason for recommending this concept"}},
            ...
        ]
        
        Order the concepts in the recommended learning sequence.
        """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an adaptive learning system expert who can analyze knowledge graphs and determine optimal learning paths."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            json_start = result_text.find('[')
            json_end = result_text.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = result_text[json_start:json_end]
                try:
                    return json.loads(json_str)
                except:
                    pass
            
            # Fallback to a simple recommendation
            return [
                {"id": "concept_with_lowest_mastery", "name": "Recommended Concept", "reason": "This concept is recommended based on your current knowledge state."}
            ]
        except Exception as e:
            # Fallback recommendation
            return [
                {"id": "concept_with_lowest_mastery", "name": "Recommended Concept", "reason": "This concept is recommended based on your current knowledge state."}
            ]

# Create a singleton instance for the service
llm_service = LLMService()

def generate_topic_connection(topic1: str, topic2: str) -> str:
    """
    Generate a creative description of how two topics might be connected.
    
    Args:
        topic1: First topic name
        topic2: Second topic name
        
    Returns:
        A paragraph describing potential connections between the topics
    """
    return llm_service.generate_topic_connection(topic1, topic2)

def analyze_concept_structure(text: str) -> Dict[str, Any]:
    """
    Analyze text to identify key concepts and their relationships.
    
    Args:
        text: Text content to analyze
        
    Returns:
        Dictionary with concepts and relationships
    """
    return llm_service.analyze_concept_structure(text)

def improve_concept_description(concept_name: str, current_description: Optional[str] = None) -> str:
    """
    Generate or improve a concept description.
    
    Args:
        concept_name: Name of the concept
        current_description: Optional current description to improve
        
    Returns:
        Improved concept description
    """
    return llm_service.improve_concept_description(concept_name, current_description)

def suggest_learning_path(topic_name: str, concept_graph: Dict[str, Any], user_mastery: Dict[str, float]) -> List[Dict[str, Any]]:
    """
    Suggest a personalized learning path based on the concept graph and user's current mastery levels.
    
    Args:
        topic_name: The main topic name
        concept_graph: The knowledge graph structure
        user_mastery: Dictionary mapping concept IDs to mastery levels (0.0 to 1.0)
        
    Returns:
        Ordered list of concepts to learn next
    """
    return llm_service.suggest_learning_path(topic_name, concept_graph, user_mastery)
