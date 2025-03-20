import { GraphData } from './graph-data.js';

// Create and initialize the graph data
let graphData;
let visualization;
let container;

// Initialize variables for edit mode and creation mode
let selectedNode = null;
let isEditMode = false;
let isCreationMode = false;
let pendingNodeText = '';
let pendingNodeCursor = null;
let creationHelpText = null;
let colorMap = {};

// Get the dimensions of the container
function getScreenDimensions() {
    const container = document.getElementById('central-screen');
    return {
        width: container.clientWidth,
        height: container.clientHeight
    };
}

// Calculate the centroid of the current graph
function calculateGraphCentroid() {
    // Safety check - ensure graphData is initialized
    if (!graphData) {
        console.error("graphData is not initialized in calculateGraphCentroid!");
        const { width, height } = getScreenDimensions();
        return { x: width / 2, y: height / 2 };
    }

    const nodes = graphData.getNodes();

    // If no nodes exist, return the center of the screen
    if (nodes.length === 0) {
        const { width, height } = getScreenDimensions();
        return { x: width / 2, y: height / 2 };
    }

    // Calculate the average position of all nodes
    let sumX = 0;
    let sumY = 0;

    // Only use nodes that have positions
    const positionedNodes = nodes.filter(node => node.x !== undefined && node.y !== undefined);

    // If no nodes have positions yet, return the center of the screen
    if (positionedNodes.length === 0) {
        const { width, height } = getScreenDimensions();
        return { x: width / 2, y: height / 2 };
    }

    // Sum up all x and y positions
    for (const node of positionedNodes) {
        sumX += node.x;
        sumY += node.y;
    }

    // Return the average position
    return {
        x: sumX / positionedNodes.length,
        y: sumY / positionedNodes.length
    };
}

// Calculate node size based on number of descendants
function getNodeSize(node) {
    // Base size for nodes without children
    const baseSize = node.parentID === null ? 18 : 15;

    // Safety check - ensure graphData is initialized
    if (!graphData) {
        console.error("graphData is not initialized in getNodeSize!");
        return baseSize;
    }

    // Count descendants
    const descendants = graphData.countDescendants(node.id);

    // Scale up based on descendants (with a max limit)
    const scaleFactor = Math.min(1 + (descendants * 0.15), 2.5);

    return baseSize * scaleFactor;
}

// Calculate font size based on node size
function getFontSize(node) {
    // Base font size
    const baseFontSize = 10;

    // Safety check - ensure graphData is initialized
    if (!graphData) {
        console.error("graphData is not initialized in getFontSize!");
        return baseFontSize;
    }

    // Count descendants
    const descendants = graphData.countDescendants(node.id);

    // Scale up based on descendants (with a max limit)
    const scaleFactor = Math.min(1 + (descendants * 0.1), 2);

    return baseFontSize * scaleFactor;
}

// Calculate text vertical position based on node size
function getTextOffset(node) {
    // Base offset
    const baseOffset = node.parentID === null ? 30 : 25;

    // Safety check - ensure graphData is initialized
    if (!graphData) {
        console.error("graphData is not initialized in getTextOffset!");
        return baseOffset;
    }

    // Get node size
    const nodeSize = getNodeSize(node);

    // Scale the offset based on the node size (add 10 for padding)
    return nodeSize + 10;
}

// Create the D3 visualization
function createVisualization() {
    // Safety check - ensure graphData is initialized
    if (!graphData) {
        console.error("graphData is not initialized!");
        return { svg, graphGroup, zoom };
    }

    console.log("Creating visualization, graphData:", graphData);

    const { width, height } = getScreenDimensions();
    console.log("Screen dimensions:", width, height);

    // Create the SVG element
    const svg = d3.create("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("class", "graph-svg");

    // Create a container group for all graph elements
    // This group will be transformed for zoom and pan
    const graphGroup = svg.append("g")
        .attr("class", "graph-container");

    // Add zoom behavior to the SVG
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4]) // Set min/max zoom scale
        .on("zoom", (event) => {
            // Apply the zoom transform to the graph group
            graphGroup.attr("transform", event.transform);
        });

    // Apply the zoom behavior to the SVG
    svg.call(zoom);

    // Add double-click to reset zoom
    svg.on("dblclick.zoom", () => {
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);
    });

    console.log("Initializing simulation with nodes:", graphData.getNodes());

    // Initialize the simulation
    const simulation = d3.forceSimulation(graphData.getNodes())
        .force("link", d3.forceLink(graphData.getLinks()).id(d => d.id).distance(d => {
            // Make distance between nodes proportional to their combined sizes
            const sourceSize = getNodeSize(d.source);
            const targetSize = getNodeSize(d.target);
            return 100 + sourceSize + targetSize;
        }))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => getNodeSize(d) + 5));

    console.log("Simulation initialized:", simulation);

    // Create link elements
    const link = graphGroup.append("g")
        .attr("class", "links")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(graphData.getLinks())
        .join("line")
        .attr("stroke-width", 1.5);

    // Add a group for each node
    const nodeGroup = graphGroup.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(graphData.getNodes())
        .join("g")
        .call(drag(simulation))
        .on("click", (event, d) => {
            // Prevent event propagation to avoid zoom interfering
            event.stopPropagation();

            // Toggle node selection
            toggleNodeSelection(d, svg);
        });

    // Add a circle for each node
    nodeGroup.append("circle")
        .attr("r", d => getNodeSize(d))
        .attr("fill", d => getNodeColor(d.type))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

    // Add text for each node
    nodeGroup.append("text")
        .text(d => d.name)
        .attr("font-size", d => `${getFontSize(d)}px`)
        .attr("text-anchor", "middle")
        .attr("dy", d => getTextOffset(d))
        .attr("fill", "#333");

    // Add tooltips
    nodeGroup.append("title")
        .text(d => {
            const descendants = graphData.countDescendants(d.id);
            const descendantsText = descendants > 0 ? `\nDescendants: ${descendants}` : '';
            return `${d.name}\n${d.description}${descendantsText}`;
        });

    // Update positions on simulation tick
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        nodeGroup.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

    // Setup the background click handler for edit mode and creation mode
    setupBackgroundClickHandler(svg);

    return { svg, graphGroup, simulation, link, nodeGroup, zoom };
}

// Get color based on node type
function getNodeColor(type) {

    // Check if type is in colorMap, if not, add it as new field and pick from the available colors at random
    if ( colorMap[type] ) {
        return colorMap[type]
    }
    else {
        // Assign a random pastel color to the type
        colorMap[type] = `hsl(${Object.keys(colorMap).length * 360 / 11}, 80%, 60%)`;
        debugger;
        return colorMap[type]
    }

    return colorMap[type] || "#9C27B0"; // Default to purple if type not defined
}

// Implement drag behavior for nodes
function drag(simulation) {
    function dragstarted(event, d) {
        // Don't start drag if we're in creation mode
        if (isCreationMode) {
            // event.preventDefault();
            return;
        }

        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        // Don't drag if we're in creation mode
        if (isCreationMode) return;

        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        // Don't end drag if we're in creation mode
        if (isCreationMode) return;

        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}

// Toggle node selection
function toggleNodeSelection(node, svg) {
    // If in creation mode, handle parent selection
    if (isCreationMode) {
        console.log('Node clicked in creation mode - creating child node with parent:', node.id);
        createNodeWithParent(node.id);
        return;
    }

    if (isEditMode && selectedNode && selectedNode.id === node.id) {
        // If already in edit mode and clicking the same node, exit edit mode
        exitEditMode();
    } else {
        // Enter edit mode with the selected node
        enterEditMode(node);
    }
}

// Enter edit mode
function enterEditMode(node) {
    // Set the selected node
    selectedNode = node;
    isEditMode = true;

    // Change background color
    document.getElementById('central-screen').classList.add('edit-mode');

    // Highlight the selected node
    highlightSelectedNode(node);

    // Add ESC key listener
    document.addEventListener('keydown', handleEscKeyPress);

    // Disable zoom temporarily to prevent interference with editing
    // This could be optional depending on your needs
    // visualization.svg.on('.zoom', null);

    // Show node info or editing UI
    showNodeEditUI(node);
}

// Exit edit mode
function exitEditMode() {
    if (!isEditMode) return;

    // Reset state
    isEditMode = false;

    // Remove background color
    document.getElementById('central-screen').classList.remove('edit-mode');

    // Remove node highlighting
    unhighlightSelectedNode();

    // Remove ESC key listener
    document.removeEventListener('keydown', handleEscKeyPress);

    // Re-enable zoom if previously disabled
    // visualization.svg.call(visualization.zoom);

    // Hide node editing UI
    hideNodeEditUI();

    selectedNode = null;
}

// Handle key presses for both edit and creation modes
function handleEscKeyPress(event) {
    if (event.key === 'Escape') {
        if (isEditMode) {
            exitEditMode();
        } else if (isCreationMode) {
            exitCreationMode();
        }
    }
}

// Highlight the selected node
function highlightSelectedNode(node) {
    // Find the node element in the DOM
    const nodeElements = document.querySelectorAll('.nodes > g');

    // Remove any existing highlights
    nodeElements.forEach(el => {
        el.classList.remove('selected');
    });

    // Find and highlight the selected node
    nodeElements.forEach(el => {
        const nodeData = d3.select(el).datum();
        if (nodeData && nodeData.id === node.id) {
            el.classList.add('selected');
        }
    });
}

// Remove highlighting from all nodes
function unhighlightSelectedNode() {
    const nodeElements = document.querySelectorAll('.nodes > g');
    nodeElements.forEach(el => {
        el.classList.remove('selected');
    });
}

// Show node editing UI
function showNodeEditUI(node) {
    const panel = document.getElementById('node-edit-panel');
    if (!panel) return;

    // Set input values
    document.getElementById('node-name').value = node.name || '';
    document.getElementById('node-description').value = node.description || '';

    // Set the type selector value
    const typeSelector = document.getElementById('node-type');
    if (typeSelector) {
        typeSelector.value = node.type || 'concept';
    }

    // Show the panel
    panel.classList.add('visible');

    // Focus on the name input
    setTimeout(() => {
        document.getElementById('node-name').focus();
    }, 100);
}

// Hide node editing UI
function hideNodeEditUI() {
    const panel = document.getElementById('node-edit-panel');
    if (panel) {
        panel.classList.remove('visible');
    }
}

// Enter creation mode to select a parent or create an orphan
function enterCreationMode(text) {
    // Log for debugging
    console.log('Entering creation mode with text:', text);

    // Ensure pendingNodeText is set globally if it was passed as a parameter
    if (text && text.trim() !== '') {
        pendingNodeText = text;
    }

    // Check if we have text to create a node
    if (!pendingNodeText || pendingNodeText.trim() === '') {
        console.error('No text provided for node creation');
        return;
    }

    if (isEditMode) {
        exitEditMode();
    }

    isCreationMode = true;

    // Change background color
    document.getElementById('central-screen').classList.add('creation-mode');

    // Create and show the cursor
    createPendingNodeCursor();

    // Show help text
    showCreationHelp();

    // Add mouse move listener
    document.addEventListener('mousemove', updateCursorPosition);

    // Add ESC key listener to cancel
    document.addEventListener('keydown', handleEscKeyPress);
}

// Exit creation mode
function exitCreationMode() {
    if (!isCreationMode) return;

    isCreationMode = false;
    pendingNodeText = '';

    // Remove background color
    document.getElementById('central-screen').classList.remove('creation-mode');

    // Remove potential parent highlights
    const nodeElements = document.querySelectorAll('.nodes > g');
    nodeElements.forEach(el => {
        el.classList.remove('potential-parent');
    });

    // Remove cursor
    if (pendingNodeCursor) {
        pendingNodeCursor.remove();
        pendingNodeCursor = null;
    }

    // Remove help text
    if (creationHelpText) {
        creationHelpText.remove();
        creationHelpText = null;
    }

    // Remove event listeners
    document.removeEventListener('mousemove', updateCursorPosition);
    document.removeEventListener('keydown', handleEscKeyPress);
}

// Create a pending node cursor that follows the mouse
function createPendingNodeCursor() {
    pendingNodeCursor = document.createElement('div');
    pendingNodeCursor.className = 'pending-node-cursor';
    pendingNodeCursor.id = 'pending-node-cursor';

    // Add to the container
    container.appendChild(pendingNodeCursor);
}

// Update cursor position based on mouse movement
function updateCursorPosition(event) {
    if (!pendingNodeCursor) return;

    // Get mouse position relative to container
    const containerRect = container.getBoundingClientRect();
    const x = event.clientX - containerRect.left;
    const y = event.clientY - containerRect.top;

    // Update cursor position
    pendingNodeCursor.style.left = `${x}px`;
    pendingNodeCursor.style.top = `${y}px`;

    // Highlight potential parent nodes
    highlightPotentialParent(event);
}

// Highlight node under cursor as potential parent
function highlightPotentialParent(event) {
    // Get mouse position
    const containerRect = container.getBoundingClientRect();
    const mouseX = event.clientX - containerRect.left;
    const mouseY = event.clientY - containerRect.top;

    // Remove any existing potential parent highlights
    const nodeElements = document.querySelectorAll('.nodes > g');
    nodeElements.forEach(el => {
        el.classList.remove('potential-parent');
    });

    // Find node under mouse
    let nodeUnderMouse = null;
    nodeElements.forEach(el => {
        const circleElement = el.querySelector('circle');
        if (circleElement) {
            // Get node position and radius
            const nodeData = d3.select(el).datum();
            if (nodeData && nodeData.x !== undefined && nodeData.y !== undefined) {
                const nodeX = nodeData.x;
                const nodeY = nodeData.y;
                const radius = parseInt(circleElement.getAttribute('r'), 10);

                // Transform based on current zoom
                const transform = d3.zoomTransform(visualization.svg.node());
                const transformedX = transform.applyX(nodeX);
                const transformedY = transform.applyY(nodeY);

                // Check if mouse is within circle
                const distance = Math.sqrt(
                    Math.pow(mouseX - transformedX, 2) +
                    Math.pow(mouseY - transformedY, 2)
                );

                if (distance <= radius) {
                    nodeUnderMouse = el;
                }
            }
        }
    });

    // Highlight the node under mouse
    if (nodeUnderMouse) {
        nodeUnderMouse.classList.add('potential-parent');
    }
}

// Create a new node with a parent
function createNodeWithParent(parentId) {
    console.log('Creating node with parent, text:', pendingNodeText, 'parentId:', parentId);

    if (!pendingNodeText) {
        console.error('No pending node text available');
        exitCreationMode();
        return;
    }

    // Get parent node position
    const parentNode = graphData.findNodeById(parentId);
    if (!parentNode) {
        console.error('Parent node not found with ID:', parentId);
        exitCreationMode();
        return;
    }

    // Calculate position slightly offset from parent
    const offsetX = parentNode.x + 50;
    const offsetY = parentNode.y + 50;

    // Create new node as child of parent
    const newNode = graphData.addNode(pendingNodeText, parentId, offsetX, offsetY);
    console.log('Created child node:', newNode);

    // Exit creation mode
    exitCreationMode();

    // Redraw the graph with appropriate sizing
    redrawGraph();

    // Show a notification about the new node
    showNotification('New node added. Press the save button to save your changes.');
}

// Create an orphan node at current cursor position
function createOrphanNode() {
    console.log('Creating orphan node, text:', pendingNodeText);

    if (!pendingNodeText) {
        console.error('No pending node text available');
        exitCreationMode();
        return;
    }

    // Get current cursor position
    const cursorElement = document.getElementById('pending-node-cursor');
    if (!cursorElement) {
        console.error('Cursor element not found');
        exitCreationMode();
        return;
    }

    // Get cursor position relative to container
    const containerRect = container.getBoundingClientRect();
    const mouseX = parseFloat(cursorElement.style.left);
    const mouseY = parseFloat(cursorElement.style.top);

    console.log('Cursor position:', mouseX, mouseY);

    // Convert screen coordinates to graph coordinates
    const transform = d3.zoomTransform(visualization.svg.node());
    const graphX = transform.invertX(mouseX);
    const graphY = transform.invertY(mouseY);

    console.log('Graph coordinates:', graphX, graphY);

    // Create new orphan node
    const newNode = graphData.addNode(pendingNodeText, null, graphX, graphY);
    console.log('Created orphan node:', newNode);

    // Exit creation mode
    exitCreationMode();

    // Redraw the graph with appropriate sizing
    redrawGraph();

    // Show a notification about the new node
    showNotification('New node added. Press the save button to save your changes.');
}

// Show help text for creation mode
function showCreationHelp() {
    creationHelpText = document.createElement('div');
    creationHelpText.className = 'creation-help-text';
    creationHelpText.innerHTML = 'Click on a node to <span>connect</span> or anywhere else to create <span>standalone</span> node. (Press ESC to cancel)';

    // Add to the container
    container.appendChild(creationHelpText);
}

// Redraw the graph
function redrawGraph() {
    // Clear the container
    container.innerHTML = '';

    // Create a new visualization
    visualization = createVisualization();
    container.appendChild(visualization.svg.node());

    // Recreate control elements
    addZoomControls(container, visualization);
    createNodeEditPanel(container);
    addFileControls(container);

    // Restart the simulation
    visualization.simulation.alpha(0.3).restart();

    // Automatically center and fit nodes after redrawing
    setTimeout(() => {
        // First center the graph
        centerGraph(visualization.simulation);

        // After centering, zoom to fit all nodes
        setTimeout(() => {
            zoomToFitAllNodes(visualization);
        }, 2500); // Wait for centering animation to complete
    }, 500); // Small delay to ensure visualization is fully rendered
}

// Background click handler to exit edit mode or create orphan nodes
function setupBackgroundClickHandler(svg) {
    svg.on("click", (event) => {
        // Skip if the click came from a node
        if (event.target.closest && event.target.closest('.nodes g')) {
            return;
        }

        if (isEditMode) {
            exitEditMode();
        } else if (isCreationMode) {
            // Only handle background clicks if we're not over a node
            if (document.querySelectorAll('.nodes > g.potential-parent').length === 0) {
                // Log for debugging
                console.log('Background click in creation mode - creating orphan node');
                createOrphanNode();
            }
        }
    });
}

// Add file controls for saving and loading the graph
function addFileControls(container) {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'file-controls';

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'file-btn save-btn';
    saveBtn.innerHTML = '💾';
    saveBtn.title = 'Save Graph';
    saveBtn.addEventListener('click', () => {
        // Save to a central data.json file
        graphData.saveToFile('data.json')
            .then(success => {
                if (success) {
                    showNotification('Graph saved as data.json. Your changes have been saved to the downloaded file.');
                } else {
                    showNotification('Failed to save graph', 'error');
                }
            });
    });

    // Load button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'file-btn load-btn';
    loadBtn.innerHTML = '📂';
    loadBtn.title = 'Load Graph';

    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    // When load button is clicked, trigger the file input dialog
    loadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // When a file is selected, load it
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];

            graphData.loadFromFile(file)
                .then(success => {
                    showNotification(`Graph loaded successfully from ${file.name}`, 'success');
                    redrawGraph();
                })
                .catch(error => {
                    showNotification(`Failed to load graph: ${error.message}`, 'error');
                });
        }
    });

    // Add buttons to container
    controlsContainer.appendChild(saveBtn);
    controlsContainer.appendChild(loadBtn);
    controlsContainer.appendChild(fileInput);

    // Add controls to the main container
    container.appendChild(controlsContainer);
}

// Show a notification message
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add to body
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.add('visible');
    }, 10);

    // Calculate display time based on message length
    const displayTime = message.length > 50 ? 5000 : 3000;

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('visible');

        // Remove element after fade out
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, displayTime);
}

// Add zoom control buttons to the container
function addZoomControls(container, visualization) {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'zoom-controls';

    // Zoom in button
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'zoom-btn zoom-in';
    zoomInBtn.innerHTML = '+';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.addEventListener('click', () => {
        visualization.svg.transition()
            .duration(300)
            .call(visualization.zoom.scaleBy, 1.3);
    });

    // Zoom out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'zoom-btn zoom-out';
    zoomOutBtn.innerHTML = '−'; // Unicode minus sign
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.addEventListener('click', () => {
        visualization.svg.transition()
            .duration(300)
            .call(visualization.zoom.scaleBy, 0.7);
    });

    // Reset view button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'zoom-btn reset-view';
    resetBtn.innerHTML = '⟲'; // Unicode refresh symbol
    resetBtn.title = 'Reset View';
    resetBtn.addEventListener('click', () => {
        visualization.svg.transition()
            .duration(750)
            .call(visualization.zoom.transform, d3.zoomIdentity);
    });

    // Center graph button
    const centerGraphBtn = document.createElement('button');
    centerGraphBtn.className = 'zoom-btn center-graph';
    centerGraphBtn.innerHTML = '⌖'; // Unicode target symbol
    centerGraphBtn.title = 'Group Nodes';
    centerGraphBtn.addEventListener('click', () => {
        centerGraph(visualization.simulation);
    });

    // Fit all nodes button
    const fitNodesBtn = document.createElement('button');
    fitNodesBtn.className = 'zoom-btn fit-nodes';
    fitNodesBtn.innerHTML = '⊡'; // Unicode containing symbol
    fitNodesBtn.title = 'Fit All Nodes';
    fitNodesBtn.addEventListener('click', () => {
        zoomToFitAllNodes(visualization);
    });

    // Add buttons to container
    controlsContainer.appendChild(zoomInBtn);
    controlsContainer.appendChild(zoomOutBtn);
    controlsContainer.appendChild(resetBtn);
    controlsContainer.appendChild(centerGraphBtn);
    controlsContainer.appendChild(fitNodesBtn);

    // Add controls to the main container
    container.appendChild(controlsContainer);
}

// Function to center the graph by temporarily increasing the center force
function centerGraph(simulation) {
    // Get the current center force
    const centerForce = simulation.force("center");
    const { width, height } = getScreenDimensions();

    // Store original strength
    const originalChargeStrength = simulation.force("charge").strength();

    // Create a pulsing effect by strengthening forces

    // Step 2: After a short delay, strengthen the center force to pull nodes in
    setTimeout(() => {
        // Create a new stronger center force
        simulation
            .force("center", d3.forceCenter(width / 2, height / 2).strength(0.15))
            .force("charge", d3.forceManyBody().strength(-400))
            .alpha(1.0)
            .restart();

        // Add a temporary x and y forces to pull nodes toward center
        simulation
            .force("x", d3.forceX(width / 2).strength(0.15))
            .force("y", d3.forceY(height / 2).strength(0.15));

        // Visual indicator that the centering is active
        const button = document.querySelector('.center-graph');
        if (button) button.classList.add('active');
    }, 500);
}

// Create the node edit panel
function createNodeEditPanel(container) {
    // Create the panel element
    const panel = document.createElement('div');
    panel.className = 'node-edit-panel';
    panel.id = 'node-edit-panel';

    // Add panel content
    panel.innerHTML = `
    <h3>Edit Node</h3>
    <div class="edit-field">
      <label for="node-name">Name</label>
      <input type="text" id="node-name" placeholder="Node name">
    </div>
    <div class="edit-field">
      <label for="node-description">Description</label>
      <textarea id="node-description" placeholder="Node description"></textarea>
    </div>
    <div class="edit-field">
      <label for="node-type">Type</label>
      <select id="node-type">
        <option value="concept">Concept</option>
        <option value="information">Information</option>
        <option value="question">Question</option>
        <option value="answer">Answer</option>
      </select>
    </div>
    <div class="edit-actions">
      <button class="btn-cancel" id="cancel-edit">Cancel</button>
      <button class="btn-save" id="save-edit">Save</button>
    </div>
  `;

    // Add the panel to the container
    container.appendChild(panel);

    // Prevent click events on the panel from bubbling up
    panel.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // Add event listeners for the buttons
    document.getElementById('cancel-edit').addEventListener('click', exitEditMode);
    document.getElementById('save-edit').addEventListener('click', saveNodeEdits);
}

// Save node edits
function saveNodeEdits() {
    if (!selectedNode) return;

    // Get values from inputs
    const newName = document.getElementById('node-name').value.trim();
    const newDescription = document.getElementById('node-description').value.trim();
    const newType = document.getElementById('node-type').value;

    // Track if changes were made
    let changesWereMade = false;

    // Update the node if values changed
    if (newName && newName !== selectedNode.name) {
        selectedNode.name = newName;
        changesWereMade = true;
    }

    if (newDescription !== selectedNode.description) {
        selectedNode.description = newDescription;
        changesWereMade = true;
    }

    if (newType && newType !== selectedNode.type) {
        selectedNode.type = newType;
        changesWereMade = true;
    }

    // Update the visualization to reflect changes
    if (changesWereMade) {
        updateNodeVisual(selectedNode);

        // Show notification about changes
        showNotification('Node updated. Press the save button to save your changes.');
    }

    // Exit edit mode
    exitEditMode();
}

// Update node visualization after editing
function updateNodeVisual(node) {
    // Find the node element
    const nodeElements = document.querySelectorAll('.nodes > g');

    nodeElements.forEach(el => {
        const nodeData = d3.select(el).datum();
        if (nodeData && nodeData.id === node.id) {
            // Update the node text
            const textElement = el.querySelector('text');
            if (textElement) {
                textElement.textContent = node.name;
                textElement.setAttribute('font-size', `${getFontSize(node)}px`);
                textElement.setAttribute('dy', getTextOffset(node));
            }

            // Update the node circle size
            const circleElement = el.querySelector('circle');
            if (circleElement) {
                circleElement.setAttribute('r', getNodeSize(node));
                circleElement.setAttribute('fill', getNodeColor(node.type));
            }

            // Update tooltip
            const titleElement = el.querySelector('title');
            if (titleElement) {
                const descendants = graphData.countDescendants(node.id);
                const descendantsText = descendants > 0 ? `\nDescendants: ${descendants}` : '';
                titleElement.textContent = `${node.name}\n${node.description}${descendantsText}`;
            }
        }
    });
}

// Function to zoom out to fit all nodes in the viewport
function zoomToFitAllNodes(visualization) {
    // Safety check
    if (!visualization || !visualization.nodeGroup || !graphData || graphData.getNodes().length === 0) {
        console.warn("Cannot zoom to fit: visualization or nodes not available");
        return;
    }

    const nodes = graphData.getNodes();

    // Find the bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
            const nodeSize = getNodeSize(node);
            minX = Math.min(minX, node.x - nodeSize);
            minY = Math.min(minY, node.y - nodeSize);
            maxX = Math.max(maxX, node.x + nodeSize);
            maxY = Math.max(maxY, node.y + nodeSize);
        }
    });

    // If we couldn't determine bounds, return
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
        console.warn("Cannot determine node bounds for zooming");
        return;
    }

    // Get the dimensions of the container
    const { width, height } = getScreenDimensions();

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Calculate the scale
    const dx = maxX - minX;
    const dy = maxY - minY;
    const scale = Math.min(width / dx, height / dy, 1); // Cap at 1x to prevent excessive zoom in

    // Calculate the translate
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const translateX = width / 2 - scale * centerX;
    const translateY = height / 2 - scale * centerY;

    // Apply the transform
    visualization.svg.transition()
        .duration(750)
        .call(
            visualization.zoom.transform,
            d3.zoomIdentity
                .translate(translateX, translateY)
                .scale(scale)
        );
}

// Initialize the application when the DOM is loaded
function initApp() {
    console.log("Initializing application...");

    try {
        container = document.getElementById("central-screen");
        if (!container) {
            throw new Error("Could not find #central-screen element!");
        }

        console.log("Creating GraphData...");

        // Create GraphData with a callback to initialize visualization when data is loaded
        graphData = new GraphData((success) => {
            console.log("GraphData callback executed, success:", success);

            // Only create the visualization after the data has been loaded
            if (!visualization && success) {
                visualization = createVisualization();
                container.appendChild(visualization.svg.node());

                // Add controls after visualization is created
                addZoomControls(container, visualization);
                createNodeEditPanel(container);
                addFileControls(container);

                // Automatically center the graph and fit all nodes
                setTimeout(() => {
                    // First center the graph
                    centerGraph(visualization.simulation);

                    // After centering, zoom to fit all nodes
                    setTimeout(() => {
                        zoomToFitAllNodes(visualization);
                    }, 2500); // Wait for centering animation to complete
                }, 500); // Small delay to ensure visualization is fully rendered
            }
        });

        // Handle send button click
        document.querySelector('.send-button').addEventListener('click', () => {
            // Specifically target the input in the footer rather than any input
            const input = document.querySelector('footer input[type="text"]');
            const text = input.value.trim();

            console.log('Send button clicked, text:', text);

            if (text) {
                // Store the text for later use
                pendingNodeText = text;

                // Enter creation mode
                enterCreationMode(pendingNodeText);

                // Clear the input field
                input.value = '';
            }
        });

        // Handle Enter key in input
        document.querySelector('footer input[type="text"]').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.querySelector('.send-button').click();
            }
        });
    } catch (error) {
        console.error("Error initializing app:", error);
    }
}

// Start the application when the DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOM content loaded, initializing app...");
        initApp();
    } catch (error) {
        console.error("Error initializing app:", error);
    }
}); 