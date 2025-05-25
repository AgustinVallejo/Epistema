import numpy as np
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
import networkx as nx

# Pydantic models for graph structure
class NodeData(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    mastery_level: float = 0.0

class EdgeData(BaseModel):
    id: str
    source: str
    target: str
    type: str = "prerequisite"
    strength: float = 1.0

class GraphData(BaseModel):
    nodes: List[NodeData]
    edges: List[EdgeData]

# Load NLP model for text processing
try:
    nlp = spacy.load("en_core_web_md")
except:
    # Fallback to a smaller model if the medium model isn't available
    try:
        nlp = spacy.load("en_core_web_sm")
    except:
        import spacy.cli
        spacy.cli.download("en_core_web_sm")
        nlp = spacy.load("en_core_web_sm")

def extract_concepts(text: str) -> List[Dict[str, Any]]:
    """
    Extract key concepts from text using NLP techniques.
    
    Args:
        text: The input text to analyze
        
    Returns:
        List of extracted concepts with their details
    """
    # Process the text with spaCy
    doc = nlp(text)
    
    # Extract noun phrases as potential concepts
    concepts = []
    seen_phrases = set()
    
    # Get noun chunks (noun phrases)
    for chunk in doc.noun_chunks:
        if chunk.text.lower() not in seen_phrases and len(chunk.text.split()) <= 4:
            # Simple filtering to avoid very long phrases
            concepts.append({
                "text": chunk.text,
                "start": chunk.start_char,
                "end": chunk.end_char,
                "importance": 0.5  # Default importance
            })
            seen_phrases.add(chunk.text.lower())
    
    # Extract key terms (nouns with high tf-idf)
    sentences = [sent.text for sent in doc.sents]
    if len(sentences) > 1:
        vectorizer = TfidfVectorizer(
            max_df=0.9, 
            min_df=1, 
            stop_words='english'
        )
        try:
            tfidf_matrix = vectorizer.fit_transform(sentences)
            feature_names = vectorizer.get_feature_names_out()
            
            # For each word in our vocabulary, find its average tf-idf score
            word_scores = {}
            for i, feature in enumerate(feature_names):
                word_scores[feature] = np.mean([tfidf_matrix[doc_idx, i] for doc_idx in range(tfidf_matrix.shape[0]) if tfidf_matrix[doc_idx, i] > 0])
            
            # Update importance scores for concepts based on tf-idf
            for concept in concepts:
                for word in concept["text"].lower().split():
                    if word in word_scores:
                        concept["importance"] = max(concept["importance"], word_scores[word] * 2)  # Scale up
        except:
            # Fallback if tf-idf fails (e.g., with very short texts)
            pass
    
    return concepts

def identify_relationships(concepts: List[Dict[str, Any]], text: str) -> List[Dict[str, Any]]:
    """
    Identify potential relationships between concepts.
    
    Args:
        concepts: List of concepts extracted from the text
        text: The original text
        
    Returns:
        List of relationships between concepts
    """
    # Create a span map for quick lookup of concepts by their position in text
    span_map = {}
    for i, concept in enumerate(concepts):
        span_map[(concept["start"], concept["end"])] = i
    
    # Process the text to identify dependencies
    doc = nlp(text)
    
    # Track relationships
    relationships = []
    
    # Simple heuristic: concepts mentioned earlier are prerequisites of concepts mentioned later
    # This is a simplified approach - in a real system, more sophisticated analysis would be used
    
    # Sort concepts by their appearance in the text
    sorted_concepts = sorted(concepts, key=lambda x: x["start"])
    
    # Create potential prerequisite relationships
    for i in range(len(sorted_concepts)):
        for j in range(i+1, min(i+5, len(sorted_concepts))):  # Look at the next few concepts as potential dependents
            # Calculate a confidence score based on proximity and importance
            distance = sorted_concepts[j]["start"] - sorted_concepts[i]["end"]
            max_distance = 500  # Characters
            proximity_score = max(0, 1 - (distance / max_distance))
            
            # Consider very close concepts with similar importance as related, not prerequisites
            if proximity_score > 0.8 and abs(sorted_concepts[i]["importance"] - sorted_concepts[j]["importance"]) < 0.2:
                rel_type = "related"
            else:
                rel_type = "prerequisite"
            
            # Calculate strength based on importance and proximity
            strength = proximity_score * (sorted_concepts[i]["importance"] + sorted_concepts[j]["importance"]) / 2
            
            if strength > 0.2:  # Threshold to avoid weak connections
                relationships.append({
                    "source": i,
                    "target": j,
                    "type": rel_type,
                    "strength": min(1.0, strength)  # Cap at 1.0
                })
    
    return relationships

def text_to_graph(text: str) -> GraphData:
    """
    Convert text content to a knowledge graph structure.
    
    Args:
        text: The input text to analyze
        
    Returns:
        GraphData containing nodes and edges
    """
    # Extract concepts from text
    concepts = extract_concepts(text)
    
    # Identify relationships between concepts
    relationships = identify_relationships(concepts, text)
    
    # Create graph data structure
    nodes = []
    for i, concept in enumerate(concepts):
        nodes.append(NodeData(
            id=f"n{i}",
            label=concept["text"],
            description=f"Extracted from text at position {concept['start']}-{concept['end']}",
            mastery_level=0.0  # Initial mastery level is zero
        ))
    
    edges = []
    for i, rel in enumerate(relationships):
        edges.append(EdgeData(
            id=f"e{i}",
            source=f"n{rel['source']}",
            target=f"n{rel['target']}",
            type=rel["type"],
            strength=rel["strength"]
        ))
    
    # Ensure the graph is acyclic for prerequisites
    if edges:
        G = nx.DiGraph()
        G.add_nodes_from([node.id for node in nodes])
        
        # Add edges and resolve cycles
        for edge in edges:
            if edge.type == "prerequisite":
                # Check if adding this edge would create a cycle
                if not nx.has_path(G, edge.target, edge.source):
                    G.add_edge(edge.source, edge.target)
            else:
                # Non-prerequisite relationships don't need cycle checking
                G.add_edge(edge.source, edge.target)
        
        # Rebuild edges from the acyclic graph
        edges = [
            EdgeData(
                id=f"e{i}",
                source=source,
                target=target,
                type=G.edges[source, target].get("type", "prerequisite"),
                strength=G.edges[source, target].get("strength", 1.0)
            )
            for i, (source, target) in enumerate(G.edges)
        ]
    
    return GraphData(nodes=nodes, edges=edges)

def generate_knowledge_map(topic_name: str, description: str = None) -> GraphData:
    """
    Generate an initial knowledge map for a topic.
    
    Args:
        topic_name: The name of the topic
        description: Optional description of the topic
        
    Returns:
        GraphData containing nodes and edges for the initial knowledge map
    """
    # If description is provided, use it to generate the graph
    if description:
        return text_to_graph(description)
    
    # Otherwise, create a simple starter graph with just the topic as the central node
    return GraphData(
        nodes=[
            NodeData(
                id="n0",
                label=topic_name,
                description=f"Central concept: {topic_name}",
                mastery_level=0.0
            )
        ],
        edges=[]
    )
