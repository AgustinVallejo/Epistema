import {
  exitEditMode,
  exitCreationMode,
  redrawGraph,
  graphModel,
  visualization,
  container,
  isCreationMode,
  isEditMode,
  pendingNodeText,
  selectedNode
} from './graphView.js';
import { showNotification } from './modals.js';

// Save node edits
export function saveNodeEdits() {
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
export function updateNodeVisual(node) {
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
              const descendants = graphModel.countDescendants(node.id);
              const descendantsText = descendants > 0 ? `\nDescendants: ${descendants}` : '';
              titleElement.textContent = `${node.name}\n${node.description}${descendantsText}`;
          }
      }
  });
}


// Calculate node size based on number of descendants
export function getNodeSize(node) {
  // Base size for nodes without children
  const baseSize = node.parentID === null ? 18 : 15;

  // Safety check - ensure graphModel is initialized
  if (!graphModel) {
      console.error("graphModel is not initialized in getNodeSize!");
      return baseSize;
  }

  // Count descendants
  const descendants = graphModel.countDescendants(node.id);

  // Scale up based on descendants (with a max limit)
  const scaleFactor = Math.min(1 + (descendants * 0.15), 2.5);

  return baseSize * scaleFactor;
}

// Calculate font size based on node size
export function getFontSize(node) {
  // Base font size
  const baseFontSize = 10;

  // Safety check - ensure graphModel is initialized
  if (!graphModel) {
      console.error("graphModel is not initialized in getFontSize!");
      return baseFontSize;
  }

  // Count descendants
  const descendants = graphModel.countDescendants(node.id);

  // Scale up based on descendants (with a max limit)
  const scaleFactor = Math.min(1 + (descendants * 0.1), 2);

  return baseFontSize * scaleFactor;
}

// Calculate text vertical position based on node size
export function getTextOffset(node) {
  // Base offset
  const baseOffset = node.parentID === null ? 30 : 25;

  // Safety check - ensure graphModel is initialized
  if (!graphModel) {
      console.error("graphModel is not initialized in getTextOffset!");
      return baseOffset;
  }

  // Get node size
  const nodeSize = getNodeSize(node);

  // Scale the offset based on the node size (add 10 for padding)
  return nodeSize + 10;
}


// Get color based on node type
export function getNodeColor(type) {

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
export function drag(simulation) {
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
export function toggleNodeSelection(node, svg) {
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


// Highlight the selected node
export function highlightSelectedNode(node) {
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
export function unhighlightSelectedNode() {
  const nodeElements = document.querySelectorAll('.nodes > g');
  nodeElements.forEach(el => {
      el.classList.remove('selected');
  });
}

// Create a pending node cursor that follows the mouse
export function createPendingNodeCursor() {
  pendingNodeCursor = document.createElement('div');
  pendingNodeCursor.className = 'pending-node-cursor';
  pendingNodeCursor.id = 'pending-node-cursor';

  // Add to the container
  container.appendChild(pendingNodeCursor);
}


// Highlight node under cursor as potential parent
export function highlightPotentialParent(event) {
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
export function createNodeWithParent(parentId) {
  console.log('Creating node with parent, text:', pendingNodeText, 'parentId:', parentId);

  if (!pendingNodeText) {
      console.error('No pending node text available');
      exitCreationMode();
      return;
  }

  // Get parent node position
  const parentNode = graphModel.findNodeById(parentId);
  if (!parentNode) {
      console.error('Parent node not found with ID:', parentId);
      exitCreationMode();
      return;
  }

  // Calculate position slightly offset from parent
  const offsetX = parentNode.x + 50;
  const offsetY = parentNode.y + 50;

  // Create new node as child of parent
  const newNode = graphModel.addNode(pendingNodeText, parentId, offsetX, offsetY);
  console.log('Created child node:', newNode);

  // Exit creation mode
  exitCreationMode();

  // Redraw the graph with appropriate sizing
  redrawGraph();

  // Show a notification about the new node
  showNotification('New node added. Press the save button to save your changes.');
}

// Create an orphan node at current cursor position
export function createOrphanNode() {
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
  const newNode = graphModel.addNode(pendingNodeText, null, graphX, graphY);
  console.log('Created orphan node:', newNode);

  // Exit creation mode
  exitCreationMode();

  // Redraw the graph with appropriate sizing
  redrawGraph();

  // Show a notification about the new node
  showNotification('New node added. Press the save button to save your changes.');
}

