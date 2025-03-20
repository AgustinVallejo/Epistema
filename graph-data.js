// Graph data management
import { NodeData } from './node-data.js';

export class GraphData {
    constructor(onLoadCallback) {
        // Initialize nodes and links arrays
        this.nodes = [];
        this.links = [];
        this.nextId = 1;

        // Store the callback
        this.onLoadCallback = onLoadCallback;

        try {
            console.log("Loading initial data in GraphData constructor");
            // Load sample data instead of trying to load from data.json
            this.loadInitialData();
        } catch (error) {
            console.error("Error in GraphData constructor:", error);
            if (typeof this.onLoadCallback === 'function') {
                console.log("Calling onLoadCallback with success=false");
                this.onLoadCallback(false);
            }
        }
    }

    // Load initial data from data.json - No longer used in constructor
    loadInitialData() {
        fetch('converted_data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load data.json');
                }
                return response.json();
            })
            .then(data => {
                if (this.loadFromData(data)) {
                    console.log('Successfully loaded data from data.json');
                    // Call the callback if provided
                    if (typeof this.onLoadCallback === 'function') {
                        this.onLoadCallback();
                    }
                } else {
                    this.loadSampleData();
                    // Call the callback if provided
                    if (typeof this.onLoadCallback === 'function') {
                        this.onLoadCallback();
                    }
                }

                // Call the callback if provided
                if (typeof this.onLoadCallback === 'function') {
                    console.log("Calling onLoadCallback with success=true");
                    this.onLoadCallback(true);
                }
            })
            .catch(error => {
                console.warn('Could not load data.json:', error);
                this.loadSampleData();
                // Call the callback if provided
                if (typeof this.onLoadCallback === 'function') {
                    this.onLoadCallback();
                }
            });
    }

    // Load sample data as fallback
    loadSampleData() {
        console.log("Loading sample data...");
        try {
            // Create sample nodes
            this.nodes = [
                new NodeData(1, "Tema", "The starting point", "concept", null, [2, 3]),
                new NodeData(2, "Child 1", "First child", "concept", 1, [4]),
                new NodeData(3, "Child 2", "Second child", "concept", 1, [5]),
                new NodeData(4, "Grandchild 1", "First grandchild", "concept", 2, []),
                new NodeData(5, "Grandchild 2", "Second grandchild", "concept", 3, [])
            ];

            console.log("Sample nodes created:", this.nodes.length);

            // Generate links based on parent-child relationships
            this.updateLinks();

            this.nextId = 6;
            console.log("Sample data loaded successfully, links:", this.links.length);
        } catch (error) {
            console.error("Error loading sample data:", error);
            // Create minimal fallback data in case of error
            this.nodes = [new NodeData(1, "Error Node", "Created after error", "concept", null, [])];
            this.links = [];
            this.nextId = 2;
        }
    }

    // Process data from JSON structure
    loadFromData(data) {
        try {
            // Check if data format is valid
            if (!data.nodes || !Array.isArray(data.nodes)) {
                throw new Error('Invalid data format: missing nodes array');
            }

            // Reset current data
            this.nodes = [];
            this.links = [];

            // Find the highest ID to set nextId correctly
            let maxId = 0;

            // Create NodeData objects from the loaded data
            for (const nodeData of data.nodes) {
                const node = new NodeData(
                    nodeData.id,
                    nodeData.name,
                    nodeData.description,
                    nodeData.type,
                    nodeData.parentID,
                    nodeData.childrenIDs || []
                );

                // Restore position if available
                if (nodeData.x !== undefined && nodeData.y !== undefined) {
                    node.x = nodeData.x;
                    node.y = nodeData.y;
                }

                this.nodes.push(node);

                // Track highest ID
                if (node.id > maxId) {
                    maxId = node.id;
                }
            }

            // Set next ID to be one higher than the maximum found
            this.nextId = maxId + 1;

            // Get nextId from metadata if available
            if (data.metadata && data.metadata.nextId !== undefined) {
                this.nextId = data.metadata.nextId;
            }

            // Regenerate links
            this.updateLinks();

            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            return false;
        }
    }

    // Load data from a JSON string
    loadFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.loadFromData(data);
        } catch (error) {
            console.error('Error loading data from JSON:', error);
            return false;
        }
    }

    // Export the current graph data to a JSON string
    exportToJSON() {
        try {
            // Create a serializable version of the nodes
            const serializableNodes = this.nodes.map(node => {
                return {
                    id: node.id,
                    name: node.name,
                    description: node.description,
                    type: node.type,
                    parentID: node.parentID,
                    childrenIDs: node.childrenIDs,
                    x: node.x,
                    y: node.y
                };
            });

            const data = {
                nodes: serializableNodes,
                metadata: {
                    exportDate: new Date().toISOString(),
                    nodeCount: this.nodes.length,
                    nextId: this.nextId
                }
            };

            return JSON.stringify(data, null, 2); // Pretty print with 2 spaces
        } catch (error) {
            console.error('Error exporting data to JSON:', error);
            return null;
        }
    }

    // Save the current graph data to a file
    saveToFile(filename = 'data.json') {
        const jsonData = this.exportToJSON();
        if (!jsonData) {
            return Promise.resolve(false);
        }

        // Create a blob with the JSON data
        const blob = new Blob([jsonData], { type: 'application/json' });

        // Create a download link and trigger it
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json'; // Always save as data.json
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        // Return a resolved promise for consistency with the previous API
        return Promise.resolve(true);
    }

    // Load graph data from a file
    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const jsonString = event.target.result;
                    const success = this.loadFromJSON(jsonString);
                    if (success) {
                        resolve(true);
                    } else {
                        reject(new Error('Failed to parse the file data'));
                    }
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsText(file);
        });
    }

    // Update links based on the current parent-child relationships
    updateLinks() {
        this.links = [];
        for (const node of this.nodes) {
            // If the node has a parent, create a link from parent to this node
            if (node.parentID !== null) {
                this.links.push({
                    source: node.parentID,
                    target: node.id
                });
            }

            // Create links to all children
            if (node.childrenIDs && node.childrenIDs.length > 0) {
                for (const childId of node.childrenIDs) {
                    // Only add if not already added (avoid duplicates)
                    if (!this.links.some(link =>
                        link.source === node.id && link.target === childId)) {
                        this.links.push({
                            source: node.id,
                            target: childId
                        });
                    }
                }
            }
        }
    }

    // Add a new node with the given text and connect it to a parent node
    addNode(text = "", parentId = null, initialX = null, initialY = null) {
        // Create a default description and type
        const description = text.length > 0 ? text : `Node ${this.nextId}`;

        // Determine node type - standalone nodes are "information" while connected ones are "concept"
        const type = parentId === null ? "information" : "concept";

        // Create the new node
        const newNode = new NodeData(
            this.nextId++,
            text.length > 0 ? text : `Node ${this.nextId - 1}`,
            description,
            type,
            parentId,
            []
        );

        // Set initial position if provided
        if (initialX !== null && initialY !== null) {
            newNode.x = initialX;
            newNode.y = initialY;
        }

        // Add it to our nodes collection
        this.nodes.push(newNode);

        // If a parent is specified, update the parent's children list
        if (parentId !== null) {
            const parentNode = this.findNodeById(parentId);
            if (parentNode) {
                parentNode.childrenIDs.push(newNode.id);
            }
        }

        // Update links
        this.updateLinks();

        return newNode;
    }

    // Find a node by its ID
    findNodeById(id) {
        return this.nodes.find(node => node.id === id);
    }

    // Get random node that's not the given node
    getRandomNodeExcept(excludeId) {
        const eligibleNodes = this.nodes.filter(node => node.id !== excludeId);
        if (eligibleNodes.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * eligibleNodes.length);
        return eligibleNodes[randomIndex];
    }

    getNodes() {
        try {
            return this.nodes;
        } catch (error) {
            console.error("Error in getNodes:", error);
            return [];
        }
    }

    getLinks() {
        try {
            return this.links;
        } catch (error) {
            console.error("Error in getLinks:", error);
            return [];
        }
    }

    // Add a link between two nodes and update their parent-child relationships
    addLink(sourceId, targetId) {
        // Check if nodes exist
        const sourceNode = this.findNodeById(sourceId);
        const targetNode = this.findNodeById(targetId);

        if (!sourceNode || !targetNode) return;

        // Update parent-child relationship
        targetNode.parentID = sourceId;
        if (!sourceNode.childrenIDs.includes(targetId)) {
            sourceNode.childrenIDs.push(targetId);
        }

        // Update links
        this.updateLinks();
    }

    // Connect two existing nodes
    connectNodes(sourceId, targetId) {
        // Check if both nodes exist
        const sourceNode = this.findNodeById(sourceId);
        const targetNode = this.findNodeById(targetId);

        if (!sourceNode || !targetNode) return false;

        // Update parent-child relationship
        if (targetNode.parentID !== null) {
            // If target already has a parent, remove this node from the old parent's children
            const oldParent = this.findNodeById(targetNode.parentID);
            if (oldParent) {
                oldParent.childrenIDs = oldParent.childrenIDs.filter(id => id !== targetId);
            }
        }

        // Set new parent
        targetNode.parentID = sourceId;

        // Add to new parent's children if not already there
        if (!sourceNode.childrenIDs.includes(targetId)) {
            sourceNode.childrenIDs.push(targetId);
        }

        // Update links
        this.updateLinks();

        return true;
    }

    // Count the total number of descendants for a node (including children, grandchildren, etc.)
    countDescendants(nodeId) {
        const node = this.findNodeById(nodeId);
        if (!node || !node.childrenIDs || node.childrenIDs.length === 0) {
            return 0;
        }

        // Start with direct children count
        let count = node.childrenIDs.length;

        // Add all descendants of each child
        for (const childId of node.childrenIDs) {
            count += this.countDescendants(childId);
        }

        return count;
    }
} 