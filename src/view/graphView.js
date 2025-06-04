import {
    drag,
    toggleNodeSelection,
    highlightSelectedNode,
    unhighlightSelectedNode,
    createPendingNodeCursor,
    highlightPotentialParent,
    createOrphanNode,
    getNodeSize,
    getFontSize,
    getTextOffset,
    getNodeColor
} from './nodeView.js';
import {
    createNodeEditPanel,
    showNodeEditUI,
    hideNodeEditUI,
    showNotification,
    showCreationHelp,
    hideCreationHelp
} from './modals.js';
import { zoomToFitAllNodes } from './screenControls.js';
import { addZoomControls } from './buttons.js';

let dataSource = '../data/data.json';

// Create and initialize the graph data
export let graphModel;
export let visualization;
export let container;

// Initialize variables for edit mode and creation mode
export let selectedNode = null;
export let isEditMode = false;
export let isCreationMode = false;
export let pendingNodeText = '';
export let pendingNodeCursor = null;
let creationHelpText = null;
export let colorMap = {};

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
    // Safety check - ensure graphModel is initialized
    if (!graphModel) {
        console.error("graphModel is not initialized in calculateGraphCentroid!");
        const { width, height } = getScreenDimensions();
        return { x: width / 2, y: height / 2 };
    }

    const nodes = graphModel.getNodes();

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

// Create the D3 visualization
export function createVisualization() {
    // Safety check - ensure graphModel is initialized
    if (!graphModel) {
        console.error("graphModel is not initialized!");
        return { svg, graphGroup, zoom };
    }

    console.log("Creating visualization, graphModel:", graphModel);

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

    console.log("Initializing simulation with nodes:", graphModel.getNodes());

    // Initialize the simulation
    const simulation = d3.forceSimulation(graphModel.getNodes())
        .force("link", d3.forceLink(graphModel.getLinks()).id(d => d.id).distance(d => {
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
        .data(graphModel.getLinks())
        .join("line")
        .attr("stroke-width", 1.5);

    // Add a group for each node
    const nodeGroup = graphGroup.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(graphModel.getNodes())
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
            const descendants = graphModel.countDescendants(d.id);
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

// Enter edit mode
export function enterEditMode(node) {
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
export function exitEditMode() {
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

// Enter creation mode to select a parent or create an orphan
export function enterCreationMode(text) {
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
export function exitCreationMode() {
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
    hideCreationHelp();

    // Remove event listeners
    document.removeEventListener('mousemove', updateCursorPosition);
    document.removeEventListener('keydown', handleEscKeyPress);
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

// Redraw the graph
export function redrawGraph() {
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
export function setupBackgroundClickHandler(svg) {
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
        // Save to a central file
        graphModel.saveToFile(dataSource)
            .then(success => {
                if (success) {
                    showNotification(`Graph saved as ${dataSource}. Your changes have been saved to the downloaded file.`);
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

            graphModel.loadFromFile(file)
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

// Function to center the graph by temporarily increasing the center force
export function centerGraph(simulation) {
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